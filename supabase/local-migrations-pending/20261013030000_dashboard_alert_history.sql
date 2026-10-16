-- Persist dashboard alert episodes so the UI can show when each condition was
-- first observed and retain recently resolved alerts as history.
-- Local migration only: do not apply to the VPS without explicit approval,
-- backup, and deployment verification.

BEGIN;

CREATE TABLE IF NOT EXISTS fullchinavzla.dashboard_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key TEXT NOT NULL CHECK (alert_key IN ('inventory', 'credits', 'orders_delayed', 'cash_open', 'cash_discrepancy', 'production_yield')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  target_path TEXT NOT NULL CHECK (target_path IN ('/inventario', '/clientes', '/comandas', '/caja-operativa', '/produccion')),
  tone TEXT NOT NULL CHECK (tone IN ('critical', 'warning')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CHECK (
    (alert_key = 'inventory' AND target_path = '/inventario' AND tone = 'critical')
    OR (alert_key = 'credits' AND target_path = '/clientes' AND tone = 'warning')
    OR (alert_key = 'orders_delayed' AND target_path = '/comandas' AND tone = 'warning')
    OR (alert_key = 'cash_open' AND target_path = '/caja-operativa' AND tone = 'warning')
    OR (alert_key = 'cash_discrepancy' AND target_path = '/caja-operativa' AND tone = 'critical')
    OR (alert_key = 'production_yield' AND target_path = '/produccion' AND tone = 'warning')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_alert_events_one_active_key
  ON fullchinavzla.dashboard_alert_events(alert_key)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS dashboard_alert_events_detected_at
  ON fullchinavzla.dashboard_alert_events(detected_at DESC);

ALTER TABLE fullchinavzla.dashboard_alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_alert_events_read ON fullchinavzla.dashboard_alert_events;
CREATE POLICY dashboard_alert_events_read
  ON fullchinavzla.dashboard_alert_events
  FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));

GRANT SELECT ON fullchinavzla.dashboard_alert_events TO authenticated;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_sync_dashboard_alerts(p_alerts JSONB, p_observed_keys JSONB)
RETURNS TABLE (
  id UUID,
  alert_key TEXT,
  title TEXT,
  detail TEXT,
  target_path TEXT,
  tone TEXT,
  detected_at TIMESTAMPTZ,
  last_detected_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_alert JSONB;
  v_key TEXT;
  v_title TEXT;
  v_detail TEXT;
  v_path TEXT;
  v_tone TEXT;
BEGIN
  IF auth.uid() IS NULL OR fullchinavzla.get_current_user_role() NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'No autorizado para sincronizar alertas del dashboard' USING ERRCODE = '42501';
  END IF;
  IF p_alerts IS NULL OR jsonb_typeof(p_alerts) <> 'array'
     OR p_observed_keys IS NULL OR jsonb_typeof(p_observed_keys) <> 'array' THEN
    RAISE EXCEPTION 'p_alerts y p_observed_keys deben ser arreglos JSON' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_observed_keys) AS observed(alert_key)
     WHERE observed.alert_key NOT IN ('inventory', 'credits', 'orders_delayed', 'cash_open', 'cash_discrepancy', 'production_yield')
  ) THEN
    RAISE EXCEPTION 'Clave observada inválida' USING ERRCODE = '22023';
  END IF;

  UPDATE fullchinavzla.dashboard_alert_events e
     SET resolved_at = now()
   WHERE e.resolved_at IS NULL
     AND e.alert_key IN (SELECT observed.alert_key FROM jsonb_array_elements_text(p_observed_keys) AS observed(alert_key))
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_alerts) a WHERE a->>'key' = e.alert_key
     );

  FOR v_alert IN SELECT value FROM jsonb_array_elements(p_alerts)
  LOOP
    v_key := v_alert->>'key';
    v_title := left(COALESCE(v_alert->>'title', ''), 120);
    v_detail := left(COALESCE(v_alert->>'detail', ''), 500);

    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_observed_keys) AS observed(alert_key) WHERE observed.alert_key = v_key) THEN
      RAISE EXCEPTION 'No se puede sincronizar una categoría no observada' USING ERRCODE = '22023';
    END IF;

    CASE v_key
      WHEN 'inventory' THEN v_path := '/inventario'; v_tone := 'critical';
      WHEN 'credits' THEN v_path := '/clientes'; v_tone := 'warning';
      WHEN 'orders_delayed' THEN v_path := '/comandas'; v_tone := 'warning';
      WHEN 'cash_open' THEN v_path := '/caja-operativa'; v_tone := 'warning';
      WHEN 'cash_discrepancy' THEN v_path := '/caja-operativa'; v_tone := 'critical';
      WHEN 'production_yield' THEN v_path := '/produccion'; v_tone := 'warning';
      ELSE RAISE EXCEPTION 'Tipo de alerta inválido' USING ERRCODE = '22023';
    END CASE;

    IF v_title = '' OR v_detail = '' THEN
      RAISE EXCEPTION 'La alerta requiere título y detalle' USING ERRCODE = '22023';
    END IF;

    INSERT INTO fullchinavzla.dashboard_alert_events AS current_event
      (alert_key, title, detail, target_path, tone)
    VALUES (v_key, v_title, v_detail, v_path, v_tone)
    ON CONFLICT (alert_key) WHERE resolved_at IS NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      detail = EXCLUDED.detail,
      last_detected_at = now();
  END LOOP;

  RETURN QUERY
    SELECT e.id, e.alert_key, e.title, e.detail, e.target_path, e.tone,
           e.detected_at, e.last_detected_at, e.resolved_at
      FROM fullchinavzla.dashboard_alert_events e
     WHERE e.resolved_at IS NULL OR e.resolved_at >= now() - INTERVAL '30 days'
     ORDER BY e.detected_at DESC
     LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_sync_dashboard_alerts(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_sync_dashboard_alerts(JSONB, JSONB) TO authenticated;

COMMENT ON TABLE fullchinavzla.dashboard_alert_events IS
  'Historial de episodios activos y resueltos de alertas operativas del dashboard';
COMMENT ON FUNCTION fullchinavzla.fn_sync_dashboard_alerts(JSONB, JSONB) IS
  'Sincroniza las condiciones vigentes del dashboard y devuelve el historial reciente de alertas';

NOTIFY pgrst, 'reload schema';

COMMIT;
