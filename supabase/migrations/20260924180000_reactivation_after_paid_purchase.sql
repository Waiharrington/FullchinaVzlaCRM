-- Reactivacion solo para clientes con una compra pagada en el sistema nuevo
-- hace al menos 21 dias. El periodo se calcula con el calendario de Caracas.
BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_queue_whatsapp_automations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, public
AS $$
DECLARE
  v_created_by UUID;
  v_birthday INTEGER := 0;
  v_post_purchase INTEGER := 0;
  v_reactivation INTEGER := 0;
BEGIN
  SELECT id INTO v_created_by FROM fullchinavzla.profiles ORDER BY created_at LIMIT 1;
  IF v_created_by IS NULL THEN RAISE EXCEPTION 'No existe un perfil para registrar automatizaciones'; END IF;

  WITH last_paid_purchase AS (
    SELECT o.customer_id,
           max((o.created_at AT TIME ZONE 'America/Caracas')::date) AS purchase_date
    FROM fullchinavzla.orders o
    WHERE o.status = 'paid' AND o.customer_id IS NOT NULL
    GROUP BY o.customer_id
  ), candidates AS (
    SELECT c.id AS customer_id, c.phone, c.full_name, t.category, t.message,
           CASE WHEN lower(t.category) IN ('cumpleaños','cumpleanos','birthday') THEN 'birthday'
                WHEN lower(t.category) IN ('post-compra','post compra','post_purchase') THEN 'post_purchase'
                ELSE 'reactivation' END AS template_type,
           lpp.purchase_date
    FROM fullchinavzla.customers c
    JOIN fullchinavzla.whatsapp_templates t ON t.is_active
    LEFT JOIN last_paid_purchase lpp ON lpp.customer_id = c.id
    WHERE c.is_active AND COALESCE(trim(c.phone), '') <> ''
      AND ((lower(t.category) IN ('cumpleaños','cumpleanos','birthday') AND c.birth_date IS NOT NULL AND EXTRACT(MONTH FROM c.birth_date) = EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Caracas')) AND EXTRACT(DAY FROM c.birth_date) = EXTRACT(DAY FROM (now() AT TIME ZONE 'America/Caracas')))
        OR (lower(t.category) IN ('post-compra','post compra','post_purchase') AND c.last_visit = (now() AT TIME ZONE 'America/Caracas')::date)
        OR (lower(t.category) IN ('reactivación','reactivacion','reactivation')
            AND lpp.purchase_date IS NOT NULL
            AND lpp.purchase_date <= (now() AT TIME ZONE 'America/Caracas')::date - 21))
      AND (
        (lower(t.category) IN ('reactivación','reactivacion','reactivation') AND NOT EXISTS (
          SELECT 1 FROM fullchinavzla.whatsapp_messages w
          WHERE w.customer_id = c.id AND w.template_type = 'reactivation'
            AND w.status IN ('queued','sent')
            AND (w.created_at AT TIME ZONE 'America/Caracas')::date >= lpp.purchase_date
        ))
        OR
        (lower(t.category) NOT IN ('reactivación','reactivacion','reactivation') AND NOT EXISTS (
          SELECT 1 FROM fullchinavzla.whatsapp_messages w
          WHERE w.customer_id = c.id
            AND w.template_type = CASE
              WHEN lower(t.category) IN ('cumpleaños','cumpleanos','birthday') THEN 'birthday'
              WHEN lower(t.category) IN ('post-compra','post compra','post_purchase') THEN 'post_purchase'
              ELSE 'reactivation'
            END
            AND (w.created_at AT TIME ZONE 'America/Caracas')::date = (now() AT TIME ZONE 'America/Caracas')::date
        ))
      )
  ), inserted AS (
    INSERT INTO fullchinavzla.whatsapp_messages (customer_id, template_type, phone, message, status, created_by)
    SELECT customer_id, template_type, phone,
           replace(message, '[Nombre]', split_part(full_name, ' ', 1)),
           'queued', v_created_by
    FROM candidates
    RETURNING template_type
  )
  SELECT count(*) FILTER (WHERE template_type = 'birthday'),
         count(*) FILTER (WHERE template_type = 'post_purchase'),
         count(*) FILTER (WHERE template_type = 'reactivation')
    INTO v_birthday, v_post_purchase, v_reactivation
  FROM inserted;

  RETURN jsonb_build_object('birthday', v_birthday, 'post_purchase', v_post_purchase,
                            'reactivation', v_reactivation,
                            'total', v_birthday + v_post_purchase + v_reactivation);
END;
$$;

-- Retira de la cola las reactivaciones heredadas que no cumplen la regla nueva.
DELETE FROM fullchinavzla.whatsapp_messages w
WHERE w.status = 'queued' AND w.template_type = 'reactivation' AND w.sent_at IS NULL
  AND COALESCE((
    SELECT max((o.created_at AT TIME ZONE 'America/Caracas')::date)
    FROM fullchinavzla.orders o
    WHERE o.customer_id = w.customer_id AND o.status = 'paid'
  ), (now() AT TIME ZONE 'America/Caracas')::date)
  > (now() AT TIME ZONE 'America/Caracas')::date - 21;

COMMIT;
