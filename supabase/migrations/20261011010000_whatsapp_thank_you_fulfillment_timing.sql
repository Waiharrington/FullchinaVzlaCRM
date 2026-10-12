BEGIN;

-- Permite dejar mensajes programados para que el agradecimiento de delivery
-- salga un minuto después de entregar la comanda. Los mensajes existentes
-- quedan disponibles de inmediato.
ALTER TABLE fullchinavzla.whatsapp_messages
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_queued_available
  ON fullchinavzla.whatsapp_messages (available_at, created_at)
  WHERE status = 'queued';

CREATE OR REPLACE FUNCTION fullchinavzla.claim_next_whatsapp_message()
RETURNS SETOF JSON
LANGUAGE SQL
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  WITH claimed AS (
    UPDATE fullchinavzla.whatsapp_messages m
    SET status = 'sending',
        claimed_at = now()
    WHERE m.id = (
      SELECT n.id
      FROM fullchinavzla.whatsapp_messages n
      WHERE n.status = 'queued'
        AND n.available_at <= now()
      ORDER BY n.available_at, n.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING m.*
  )
  SELECT to_jsonb(c) || jsonb_build_object('full_name', cu.full_name)
  FROM claimed c
  LEFT JOIN fullchinavzla.customers cu ON cu.id = c.customer_id
$$;

REVOKE ALL ON FUNCTION fullchinavzla.claim_next_whatsapp_message()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.claim_next_whatsapp_message()
  TO service_role;

COMMENT ON FUNCTION fullchinavzla.claim_next_whatsapp_message() IS
  'Reclama atómicamente el siguiente mensaje disponible (queued -> sending); respeta available_at. Solo el bot (service_role).';

CREATE OR REPLACE FUNCTION fullchinavzla.fn_queue_whatsapp_automations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, public
AS $$
DECLARE
  v_created_by UUID;
  v_today DATE := (now() AT TIME ZONE 'America/Caracas')::date;
  v_birthday INTEGER := 0;
  v_post_purchase INTEGER := 0;
  v_reactivation INTEGER := 0;
BEGIN
  SELECT id INTO v_created_by
  FROM fullchinavzla.profiles
  ORDER BY created_at
  LIMIT 1;

  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'No existe un perfil para registrar automatizaciones';
  END IF;

  WITH last_paid_purchase AS (
    SELECT o.customer_id,
           max((o.created_at AT TIME ZONE 'America/Caracas')::date) AS purchase_date
    FROM fullchinavzla.orders o
    WHERE o.status = 'paid' AND o.customer_id IS NOT NULL
    GROUP BY o.customer_id
  ), templates AS (
    SELECT t.id,
           t.category,
           t.message,
           t.created_at,
           t.updated_at,
           CASE
             WHEN lower(t.category) IN ('cumpleaños','cumpleanos','birthday') THEN 'birthday'
             WHEN lower(t.category) IN ('post-compra','post compra','post_purchase') THEN 'post_purchase'
             ELSE 'reactivation'
           END AS template_type
    FROM fullchinavzla.whatsapp_templates t
    WHERE t.is_active
      AND lower(t.category) IN (
        'cumpleaños','cumpleanos','birthday',
        'post-compra','post compra','post_purchase',
        'reactivación','reactivacion','reactivation'
      )
  ), raw_candidates AS (
    SELECT c.id AS customer_id,
           c.phone,
           c.full_name,
           t.template_type,
           t.message,
           t.created_at AS template_created_at,
           t.updated_at AS template_updated_at,
           eligible_order.id AS order_id,
           eligible_order.order_number,
           eligible_order.available_at AS order_available_at,
           lpp.purchase_date
    FROM fullchinavzla.customers c
    JOIN templates t ON true
    LEFT JOIN last_paid_purchase lpp ON lpp.customer_id = c.id
    LEFT JOIN LATERAL (
      SELECT o.id,
             o.order_number,
             CASE
               WHEN o.order_type = 'delivery' THEN o.updated_at + interval '1 minute'
               ELSE o.updated_at
             END AS available_at
      FROM fullchinavzla.orders o
      WHERE t.template_type = 'post_purchase'
        AND o.customer_id = c.id
        AND (o.updated_at AT TIME ZONE 'America/Caracas')::date = v_today
        AND (
          (o.order_type = 'dine-in' AND o.status = 'paid')
          OR (
            o.order_type = 'delivery'
            AND o.fulfillment_status = 'delivered'
          )
          OR (
            o.order_type = 'takeaway'
            AND o.fulfillment_status = 'delivered'
          )
        )
    ) eligible_order ON true
    WHERE c.is_active
      AND COALESCE(trim(c.phone), '') <> ''
      AND (
        (t.template_type = 'birthday'
          AND c.birth_date IS NOT NULL
          AND EXTRACT(MONTH FROM c.birth_date) = EXTRACT(MONTH FROM v_today)
          AND EXTRACT(DAY FROM c.birth_date) = EXTRACT(DAY FROM v_today))
        OR (t.template_type = 'post_purchase' AND eligible_order.id IS NOT NULL)
        OR (t.template_type = 'reactivation'
          AND lpp.purchase_date IS NOT NULL
          AND lpp.purchase_date <= v_today - 21)
      )
      AND (
        (t.template_type = 'post_purchase'
          AND NOT EXISTS (
            SELECT 1
            FROM fullchinavzla.whatsapp_messages w
            WHERE w.template_type = 'post_purchase'
              AND w.order_id = eligible_order.id
          ))
        OR (t.template_type = 'reactivation'
          AND NOT EXISTS (
            SELECT 1
            FROM fullchinavzla.whatsapp_messages w
            WHERE w.customer_id = c.id
              AND w.template_type = 'reactivation'
              AND w.status IN ('queued','sent')
              AND (w.created_at AT TIME ZONE 'America/Caracas')::date >= lpp.purchase_date
          ))
        OR (t.template_type = 'birthday'
          AND NOT EXISTS (
            SELECT 1
            FROM fullchinavzla.whatsapp_messages w
            WHERE w.customer_id = c.id
              AND w.template_type = 'birthday'
              AND (w.created_at AT TIME ZONE 'America/Caracas')::date = v_today
          ))
      )
  ), candidates AS (
    SELECT DISTINCT ON (customer_id, template_type, order_id)
           customer_id,
           phone,
           full_name,
           template_type,
           message,
           order_id,
           order_number,
           order_available_at
    FROM raw_candidates
    ORDER BY customer_id, template_type, order_id,
             template_updated_at DESC, template_created_at DESC
  ), inserted AS (
    INSERT INTO fullchinavzla.whatsapp_messages
      (customer_id, order_id, template_type, phone, message, status, created_by, available_at)
    SELECT customer_id,
           order_id,
           template_type,
           phone,
           replace(
             replace(message, '[Nombre]', split_part(full_name, ' ', 1)),
             '[Comanda]', COALESCE('#' || order_number::text, '')
           ),
           'queued',
           v_created_by,
           COALESCE(order_available_at, now())
    FROM candidates
    ON CONFLICT DO NOTHING
    RETURNING template_type
  )
  SELECT count(*) FILTER (WHERE template_type = 'birthday'),
         count(*) FILTER (WHERE template_type = 'post_purchase'),
         count(*) FILTER (WHERE template_type = 'reactivation')
  INTO v_birthday, v_post_purchase, v_reactivation
  FROM inserted;

  RETURN jsonb_build_object(
    'birthday', v_birthday,
    'post_purchase', v_post_purchase,
    'reactivation', v_reactivation,
    'total', v_birthday + v_post_purchase + v_reactivation
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION fullchinavzla.fn_queue_whatsapp_automations()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_queue_whatsapp_automations()
  TO authenticated, service_role;

COMMIT;
