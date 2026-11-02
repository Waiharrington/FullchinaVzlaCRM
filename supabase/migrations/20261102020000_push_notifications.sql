-- Device-scoped Web Push for staff. Requires pg_net to be installed in the
-- self-hosted PostgreSQL instance before this migration is applied.
-- The endpoint receives only an unguessable outbox UUID; VAPID private keys
-- remain in the Vercel server environment.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Activa la extensión pg_net antes de instalar las notificaciones push';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS fullchinavzla.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES fullchinavzla.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) BETWEEN 20 AND 3000),
  p256dh TEXT NOT NULL CHECK (char_length(p256dh) BETWEEN 20 AND 300),
  auth TEXT NOT NULL CHECK (char_length(auth) BETWEEN 10 AND 200),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id ON fullchinavzla.push_subscriptions(user_id);
ALTER TABLE fullchinavzla.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fullchinavzla.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.push_subscriptions TO service_role;

CREATE TABLE IF NOT EXISTS fullchinavzla.push_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('web_order_new', 'order_created', 'order_paid', 'order_delivered', 'admin_activity')),
  target_roles TEXT[] NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS push_notification_outbox_pending
  ON fullchinavzla.push_notification_outbox(created_at)
  WHERE completed_at IS NULL;
ALTER TABLE fullchinavzla.push_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fullchinavzla.push_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.push_notification_outbox TO service_role;

CREATE TABLE IF NOT EXISTS fullchinavzla.push_dispatch_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  endpoint_url TEXT NOT NULL DEFAULT 'https://fullchina-vzla-crm.vercel.app/api/push-dispatch',
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO fullchinavzla.push_dispatch_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE fullchinavzla.push_dispatch_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fullchinavzla.push_dispatch_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.push_dispatch_settings TO service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_register_push_subscription(
  p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_user_agent TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL OR fullchinavzla.get_current_user_role() NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'No autorizado para registrar este dispositivo' USING ERRCODE = '42501';
  END IF;
  IF char_length(COALESCE(p_endpoint, '')) NOT BETWEEN 20 AND 3000
     OR char_length(COALESCE(p_p256dh, '')) NOT BETWEEN 20 AND 300
     OR char_length(COALESCE(p_auth, '')) NOT BETWEEN 10 AND 200 THEN
    RAISE EXCEPTION 'Suscripción push inválida' USING ERRCODE = '22023';
  END IF;

  INSERT INTO fullchinavzla.push_subscriptions AS existing
    (user_id, endpoint, p256dh, auth, user_agent, updated_at)
  SELECT v_user_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 400), now()
  WHERE EXISTS (SELECT 1 FROM fullchinavzla.profiles p WHERE p.id = v_user_id AND p.is_active)
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_delete_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Se requiere iniciar sesión' USING ERRCODE = '42501'; END IF;
  DELETE FROM fullchinavzla.push_subscriptions
   WHERE endpoint = p_endpoint AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_push_event(
  p_event_type TEXT, p_target_roles TEXT[], p_payload JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE v_id UUID;
BEGIN
  -- Hold events until the server endpoint and VAPID keys are configured.
  -- This prevents a growing queue of undeliverable pushes after migration.
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.push_dispatch_settings WHERE id AND enabled) THEN
    RETURN NULL;
  END IF;
  INSERT INTO fullchinavzla.push_notification_outbox (event_type, target_roles, payload)
  VALUES (p_event_type, p_target_roles, p_payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_dispatch_push_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE v_url TEXT;
BEGIN
  SELECT endpoint_url INTO v_url
    FROM fullchinavzla.push_dispatch_settings
   WHERE id AND enabled;
  IF v_url IS NOT NULL AND v_url ~ '^https://[A-Za-z0-9.-]+/api/push-dispatch$' THEN
    -- Only the random event ID is sent. Never put a service key, VAPID secret,
    -- subscription endpoint or customer details in pg_net's visible queue.
    PERFORM net.http_post(
      url := v_url,
      body := jsonb_build_object('eventId', NEW.id),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 3000
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_notification_dispatch ON fullchinavzla.push_notification_outbox;
CREATE TRIGGER push_notification_dispatch
  AFTER INSERT ON fullchinavzla.push_notification_outbox
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_dispatch_push_event();

CREATE OR REPLACE FUNCTION fullchinavzla.fn_claim_push_event(p_event_id UUID)
RETURNS SETOF fullchinavzla.push_notification_outbox
LANGUAGE sql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  UPDATE fullchinavzla.push_notification_outbox e
     SET claimed_at = now(), attempts = attempts + 1
   WHERE e.id = p_event_id
     AND e.completed_at IS NULL
     AND e.attempts < 5
     AND (e.claimed_at IS NULL OR e.claimed_at < now() - INTERVAL '2 minutes')
  RETURNING e.*
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_finish_push_event(p_event_id UUID, p_error TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  UPDATE fullchinavzla.push_notification_outbox
     SET completed_at = CASE WHEN p_error IS NULL THEN now() ELSE NULL END,
         claimed_at = NULL,
         last_error = left(p_error, 1000)
   WHERE id = p_event_id AND completed_at IS NULL
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_web_order_push()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_kind TEXT := CASE NEW.order_type WHEN 'delivery' THEN 'Delivery' ELSE 'Para llevar' END;
  v_name TEXT := left(btrim(COALESCE(NEW.customer_name, 'Cliente')), 100);
BEGIN
  PERFORM fullchinavzla.fn_enqueue_push_event(
    'web_order_new', ARRAY['owner', 'manager', 'cashier'],
    jsonb_build_object(
      'title', 'Nuevo pedido web',
      'body', 'WEB-' || lpad(NEW.request_number::TEXT, 6, '0') || ' · ' || v_kind || ' · ' || v_name,
      'url', '/comandas',
      'tag', 'web-order-' || NEW.id::TEXT
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_web_order_created ON fullchinavzla.web_order_requests;
CREATE TRIGGER push_web_order_created
  AFTER INSERT ON fullchinavzla.web_order_requests
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_web_order_push();

CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_order_push()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_order JSONB := to_jsonb(NEW);
  v_number TEXT := COALESCE(v_order->>'order_number', '?');
  v_kind TEXT := CASE v_order->>'order_type'
    WHEN 'dine-in' THEN 'Mesa ' || COALESCE(v_order->>'table_number', 'sin asignar')
    WHEN 'delivery' THEN 'Delivery'
    ELSE 'Para llevar'
  END;
  v_notes TEXT := COALESCE(v_order->>'notes', '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A web request already notified all staff when it entered the inbox.
    IF v_notes LIKE '[Pedido web WEB-%' THEN RETURN NEW; END IF;
    PERFORM fullchinavzla.fn_enqueue_push_event(
      'order_created', ARRAY['owner', 'manager'],
      jsonb_build_object('title', 'Nueva comanda', 'body', 'Comanda #' || v_number || ' · ' || v_kind, 'url', '/comandas', 'tag', 'order-created-' || NEW.id::TEXT)
    );
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid' THEN
    PERFORM fullchinavzla.fn_enqueue_push_event(
      'order_paid', ARRAY['owner', 'manager'],
      jsonb_build_object('title', 'Comanda cobrada', 'body', 'La comanda #' || v_number || ' ya se cobró · ' || v_kind, 'url', '/comandas', 'tag', 'order-paid-' || NEW.id::TEXT)
    );
  END IF;
  IF OLD.fulfillment_status IS DISTINCT FROM NEW.fulfillment_status AND NEW.fulfillment_status = 'delivered' THEN
    PERFORM fullchinavzla.fn_enqueue_push_event(
      'order_delivered', ARRAY['owner', 'manager'],
      jsonb_build_object('title', 'Comanda entregada', 'body', 'La comanda #' || v_number || ' se marcó como entregada · ' || v_kind, 'url', '/comandas', 'tag', 'order-delivered-' || NEW.id::TEXT)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_order_created ON fullchinavzla.orders;
CREATE TRIGGER push_order_created AFTER INSERT ON fullchinavzla.orders
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_order_push();
DROP TRIGGER IF EXISTS push_order_status_changed ON fullchinavzla.orders;
CREATE TRIGGER push_order_status_changed AFTER UPDATE OF status, fulfillment_status ON fullchinavzla.orders
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_order_push();

CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_admin_activity_push()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, fullchinavzla, pg_temp
AS $$
DECLARE
  v_action TEXT := CASE NEW.action WHEN 'INSERT' THEN 'creó' WHEN 'DELETE' THEN 'eliminó' ELSE 'actualizó' END;
  v_module TEXT := COALESCE(NULLIF(NEW.module, ''), 'Sistema');
  v_label TEXT := NULLIF(NEW.entity_label, '');
BEGIN
  PERFORM fullchinavzla.fn_enqueue_push_event(
    'admin_activity', ARRAY['owner', 'manager'],
    jsonb_build_object(
      'title', v_module || ' · actividad',
      'body', v_action || ' un registro' || CASE WHEN v_label IS NULL THEN '' ELSE ': ' || left(v_label, 90) END,
      'url', '/auditoria',
      'tag', 'activity-' || NEW.id::TEXT
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_enqueue_admin_table_push()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, fullchinavzla, pg_temp
AS $$
DECLARE
  v_old JSONB := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_new JSONB := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  v_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN v_old ELSE v_new END;
  v_action TEXT := CASE TG_OP WHEN 'INSERT' THEN 'creó' WHEN 'DELETE' THEN 'eliminó' ELSE 'actualizó' END;
  v_module TEXT := CASE
    WHEN TG_TABLE_NAME IN ('orders', 'web_order_requests', 'customers', 'credits', 'credit_payments', 'floor_tables', 'legacy_sales') THEN 'Ventas y comandas'
    WHEN TG_TABLE_NAME IN ('purchases', 'purchase_items', 'purchase_payments', 'suppliers') THEN 'Compras'
    WHEN TG_TABLE_NAME IN ('expenses', 'expense_payments') THEN 'Gastos'
    WHEN TG_TABLE_NAME IN ('stock_movements', 'ingredients', 'ingredient_costs', 'inventory_requisitions') THEN 'Inventario'
    WHEN TG_TABLE_NAME IN ('cash_sessions', 'cash_movements', 'daily_closes', 'financial_accounts', 'financial_operations') THEN 'Caja y finanzas'
    WHEN TG_TABLE_NAME IN ('employees', 'profiles', 'employee_attendance', 'payroll_periods', 'payroll_entries', 'payroll_payments', 'advances') THEN 'Equipo y nómina'
    WHEN TG_TABLE_NAME IN ('sellable_products', 'sellable_product_categories', 'menu_categories', 'weekly_menu_items', 'promotions') THEN 'Menú y promociones'
    WHEN TG_TABLE_NAME IN ('preparation_batches', 'preparation_batch_items', 'recipe_components', 'portion_recipes') THEN 'Producción y recetas'
    WHEN TG_TABLE_NAME IN ('gift_cards', 'gift_card_transactions') THEN 'Fidelización'
    WHEN TG_TABLE_NAME IN ('whatsapp_messages', 'whatsapp_templates', 'whatsapp_segments') THEN 'Marketing y WhatsApp'
    WHEN TG_TABLE_NAME IN ('delivery_config', 'delivery_zones', 'app_settings') THEN 'Configuración'
    ELSE 'Sistema'
  END;
  v_label TEXT := COALESCE(
    NULLIF(v_row->>'order_number', ''), NULLIF(v_row->>'request_number', ''),
    NULLIF(v_row->>'invoice_number', ''), NULLIF(v_row->>'concept', ''),
    NULLIF(v_row->>'product_name', ''), NULLIF(v_row->>'name', ''),
    NULLIF(v_row->>'code', ''), NULLIF(v_row->>'title', '')
  );
BEGIN
  IF TG_OP = 'UPDATE' AND (v_old - 'updated_at') = (v_new - 'updated_at') THEN RETURN NEW; END IF;
  PERFORM fullchinavzla.fn_enqueue_push_event(
    'admin_activity', ARRAY['owner', 'manager'],
    jsonb_build_object(
      'title', v_module || ' · actividad',
      'body', v_action || CASE WHEN v_module = 'Sistema' THEN ' un registro del sistema' ELSE ' un registro de ' || lower(v_module) END || CASE WHEN v_label IS NULL THEN '' ELSE ': ' || left(v_label, 80) END,
      'url', '/auditoria',
      'tag', 'activity-' || gen_random_uuid()::TEXT
    )
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- The operational activity log is optional on older VPS schemas. When it
-- exists, its triggers already cover the operational tables without leaking
-- the row's private values into push payloads.
DO $$
DECLARE v_table RECORD;
BEGIN
  IF to_regclass('fullchinavzla.system_activity_logs') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS push_admin_activity_created ON fullchinavzla.system_activity_logs';
    EXECUTE 'CREATE TRIGGER push_admin_activity_created AFTER INSERT ON fullchinavzla.system_activity_logs FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_admin_activity_push()';
  END IF;

  -- Use the shared activity log when its trigger exists. Attach directly only
  -- to tables introduced after that logger (or installations without it).
  FOR v_table IN
    SELECT tables.tablename FROM pg_catalog.pg_tables AS tables
     WHERE tables.schemaname = 'fullchinavzla'
       AND tables.tablename NOT IN (
         'push_subscriptions', 'push_notification_outbox', 'push_dispatch_settings',
         'system_activity_logs', 'data_change_versions', 'audit_logs', 'order_event_logs',
         'web_order_requests', 'orders', 'order_items', 'order_item_modifiers',
         'web_order_items', 'payments', 'system_settings'
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_trigger AS trigger
          WHERE trigger.tgrelid = format('%I.%I', 'fullchinavzla', tables.tablename)::regclass
            AND trigger.tgname = 'trg_system_activity'
            AND NOT trigger.tgisinternal
       )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS push_admin_table_activity ON fullchinavzla.%I', v_table.tablename);
    EXECUTE format(
      'CREATE TRIGGER push_admin_table_activity AFTER INSERT OR UPDATE OR DELETE ON fullchinavzla.%I FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_enqueue_admin_table_push()',
      v_table.tablename
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_register_push_subscription(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_register_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_delete_push_subscription(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_delete_push_subscription(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_enqueue_push_event(TEXT, TEXT[], JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_dispatch_push_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_enqueue_web_order_push() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_enqueue_order_push() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_enqueue_admin_activity_push() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_enqueue_admin_table_push() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_claim_push_event(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_claim_push_event(UUID) TO service_role;
REVOKE ALL ON FUNCTION fullchinavzla.fn_finish_push_event(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_finish_push_event(UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
