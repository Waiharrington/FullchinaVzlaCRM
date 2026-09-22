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

  WITH candidates AS (
    SELECT c.id AS customer_id, c.phone, c.full_name, t.category, t.message,
           CASE WHEN lower(t.category) IN ('cumpleaños','cumpleanos','birthday') THEN 'birthday'
                WHEN lower(t.category) IN ('post-compra','post compra','post_purchase') THEN 'post_purchase'
                ELSE 'reactivation' END AS template_type
    FROM customers c
    JOIN whatsapp_templates t ON t.is_active
    WHERE c.is_active AND COALESCE(trim(c.phone), '') <> ''
      AND ((lower(t.category) IN ('cumpleaños','cumpleanos','birthday') AND c.birth_date IS NOT NULL AND EXTRACT(MONTH FROM c.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM c.birth_date) = EXTRACT(DAY FROM CURRENT_DATE))
        OR (lower(t.category) IN ('post-compra','post compra','post_purchase') AND c.last_visit = CURRENT_DATE)
        OR (lower(t.category) IN ('reactivación','reactivacion','reactivation') AND c.last_visit IS NOT NULL AND c.last_visit <= CURRENT_DATE - 21))
      AND NOT EXISTS (SELECT 1 FROM whatsapp_messages w WHERE w.customer_id = c.id AND w.template_type = CASE WHEN lower(t.category) IN ('cumpleaños','cumpleanos','birthday') THEN 'birthday' WHEN lower(t.category) IN ('post-compra','post compra','post_purchase') THEN 'post_purchase' ELSE 'reactivation' END AND w.created_at::date = CURRENT_DATE)
  ), inserted AS (
    INSERT INTO whatsapp_messages (customer_id, template_type, phone, message, status, created_by)
    SELECT customer_id, template_type, phone, replace(message, '[Nombre]', split_part(full_name, ' ', 1)), 'queued', v_created_by FROM candidates
    RETURNING template_type
  )
  SELECT count(*) FILTER (WHERE template_type = 'birthday'), count(*) FILTER (WHERE template_type = 'post_purchase'), count(*) FILTER (WHERE template_type = 'reactivation') INTO v_birthday, v_post_purchase, v_reactivation FROM inserted;

  RETURN jsonb_build_object('birthday', v_birthday, 'post_purchase', v_post_purchase, 'reactivation', v_reactivation, 'total', v_birthday + v_post_purchase + v_reactivation);
END;
$$;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_queue_whatsapp_automations() TO service_role, authenticated;
