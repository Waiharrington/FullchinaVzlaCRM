-- Enqueue one post-purchase thank-you for every paid order, not once per
-- customer per day. Legacy messages are linked to one matching paid order so
-- activating this behavior never resends an already-sent thank-you.
BEGIN;

ALTER TABLE fullchinavzla.whatsapp_messages
  ADD COLUMN IF NOT EXISTS order_id UUID
  REFERENCES fullchinavzla.orders(id) ON DELETE SET NULL;

WITH legacy_messages AS (
  SELECT w.id,
         w.customer_id,
         (w.created_at AT TIME ZONE 'America/Caracas')::date AS purchase_day,
         row_number() OVER (
           PARTITION BY w.customer_id, (w.created_at AT TIME ZONE 'America/Caracas')::date
           ORDER BY COALESCE(w.sent_at, w.created_at) DESC, w.id DESC
         ) AS order_rank
  FROM fullchinavzla.whatsapp_messages w
  WHERE w.template_type = 'post_purchase'
    AND w.order_id IS NULL
    AND w.customer_id IS NOT NULL
), paid_orders AS (
  SELECT o.id,
         o.customer_id,
         (o.created_at AT TIME ZONE 'America/Caracas')::date AS purchase_day,
         row_number() OVER (
           PARTITION BY o.customer_id, (o.created_at AT TIME ZONE 'America/Caracas')::date
           ORDER BY o.created_at DESC, o.id DESC
         ) AS order_rank
  FROM fullchinavzla.orders o
  WHERE o.status = 'paid'
), legacy_post_purchase AS (
  SELECT messages.id AS message_id, orders.id AS order_id
  FROM legacy_messages messages
  JOIN paid_orders orders
    ON orders.customer_id = messages.customer_id
   AND orders.purchase_day = messages.purchase_day
   AND orders.order_rank = messages.order_rank
)
UPDATE fullchinavzla.whatsapp_messages w
SET order_id = legacy_post_purchase.order_id
FROM legacy_post_purchase
WHERE legacy_post_purchase.message_id = w.id
  AND w.order_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_post_purchase_order
  ON fullchinavzla.whatsapp_messages (order_id)
  WHERE template_type = 'post_purchase' AND order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_post_purchase_order
  ON fullchinavzla.whatsapp_messages (order_id, created_at DESC)
  WHERE template_type = 'post_purchase' AND order_id IS NOT NULL;

COMMENT ON COLUMN fullchinavzla.whatsapp_messages.order_id IS
  'Comanda asociada a un mensaje de agradecimiento postcompra; permite una notificación por comanda sin duplicados.';

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
           paid_order.id AS order_id,
           paid_order.order_number,
           lpp.purchase_date
    FROM fullchinavzla.customers c
    JOIN templates t ON true
    LEFT JOIN last_paid_purchase lpp ON lpp.customer_id = c.id
    LEFT JOIN LATERAL (
      SELECT o.id, o.order_number
      FROM fullchinavzla.orders o
      WHERE t.template_type = 'post_purchase'
        AND o.customer_id = c.id
        AND o.status = 'paid'
        AND (o.created_at AT TIME ZONE 'America/Caracas')::date = v_today
      ORDER BY o.created_at, o.id
    ) paid_order ON true
    WHERE c.is_active
      AND COALESCE(trim(c.phone), '') <> ''
      AND (
        (t.template_type = 'birthday'
          AND c.birth_date IS NOT NULL
          AND EXTRACT(MONTH FROM c.birth_date) = EXTRACT(MONTH FROM v_today)
          AND EXTRACT(DAY FROM c.birth_date) = EXTRACT(DAY FROM v_today))
        OR (t.template_type = 'post_purchase' AND paid_order.id IS NOT NULL)
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
              AND w.order_id = paid_order.id
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
           order_number
    FROM raw_candidates
    ORDER BY customer_id, template_type, order_id,
             template_updated_at DESC, template_created_at DESC
  ), inserted AS (
    INSERT INTO fullchinavzla.whatsapp_messages
      (customer_id, order_id, template_type, phone, message, status, created_by)
    SELECT customer_id,
           order_id,
           template_type,
           phone,
           replace(
             replace(message, '[Nombre]', split_part(full_name, ' ', 1)),
             '[Comanda]', COALESCE('#' || order_number::text, '')
           ),
           'queued',
           v_created_by
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
