-- Audit log table for fullchinavzla schema.
-- Local migration only — do NOT apply to production VPS without backup.
-- Owner can read all logs; inserts are done by SECURITY DEFINER functions.

BEGIN;

-- 1. Tabla
CREATE TABLE IF NOT EXISTS fullchinavzla.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES fullchinavzla.profiles(id),
  actor_name    TEXT NOT NULL,
  module        TEXT NOT NULL,
  action        TEXT NOT NULL,
  details       TEXT,
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'danger')),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE fullchinavzla.audit_logs IS 'Bitácora de acciones sensibles del sistema';

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred ON fullchinavzla.audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON fullchinavzla.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON fullchinavzla.audit_logs(actor_id);

-- 2. RLS
ALTER TABLE fullchinavzla.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select_owner ON fullchinavzla.audit_logs
  FOR SELECT USING (fullchinavzla.get_current_user_role() = 'owner');

-- 3. Grants
GRANT SELECT, INSERT ON fullchinavzla.audit_logs TO authenticated;

-- 4. Función helper para insertar logs
CREATE OR REPLACE FUNCTION fullchinavzla.fn_log_audit(
  p_actor_id   UUID,
  p_actor_name TEXT,
  p_module     TEXT,
  p_action     TEXT,
  p_details    TEXT DEFAULT NULL,
  p_severity   TEXT DEFAULT 'info'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO fullchinavzla.audit_logs (actor_id, actor_name, module, action, details, severity)
  VALUES (p_actor_id, p_actor_name, p_module, p_action, p_details, p_severity)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_log_audit IS 'Inserta un registro en audit_logs (llamar desde SECURITY DEFINER triggers)';

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_log_audit(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 5. Triggers para acciones sensibles

-- 5a. Cancelación de órdenes
CREATE OR REPLACE FUNCTION fullchinavzla.fn_audit_order_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled' THEN
    PERFORM fullchinavzla.fn_log_audit(
      NEW.created_by,
      COALESCE((SELECT full_name FROM fullchinavzla.profiles WHERE id = NEW.created_by), 'Sistema'),
      'Caja',
      'Orden cancelada',
      'Orden #' || NEW.order_number || ' cancelada',
      'warning'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_order_cancellation ON fullchinavzla.orders;
CREATE TRIGGER trg_audit_order_cancellation
  AFTER UPDATE OF status ON fullchinavzla.orders
  FOR EACH ROW
  EXECUTE FUNCTION fullchinavzla.fn_audit_order_cancellation();

-- 5b. Ajustes de inventario
CREATE OR REPLACE FUNCTION fullchinavzla.fn_audit_stock_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF NEW.movement_type = 'adjustment' THEN
    PERFORM fullchinavzla.fn_log_audit(
      NEW.created_by,
      COALESCE((SELECT full_name FROM fullchinavzla.profiles WHERE id = NEW.created_by), 'Sistema'),
      'Inventario',
      'Ajuste de stock',
      NEW.notes || ' | Ingrediente: ' || (SELECT name FROM fullchinavzla.ingredients WHERE id = NEW.ingredient_id) || ' | Cantidad: ' || NEW.quantity,
      CASE WHEN NEW.quantity < 0 THEN 'warning' ELSE 'info' END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_stock_adjustment ON fullchinavzla.stock_movements;
CREATE TRIGGER trg_audit_stock_adjustment
  AFTER INSERT ON fullchinavzla.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION fullchinavzla.fn_audit_stock_adjustment();

-- 5c. Cambio de precio de productos
CREATE OR REPLACE FUNCTION fullchinavzla.fn_audit_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    PERFORM fullchinavzla.fn_log_audit(
      v_actor,
      COALESCE((SELECT full_name FROM fullchinavzla.profiles WHERE id = v_actor), 'Sistema'),
      'Menú',
      'Precio cambiado',
      NEW.name || ': $' || OLD.price::TEXT || ' → $' || NEW.price::TEXT,
      'info'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_price_change ON fullchinavzla.sellable_products;
CREATE TRIGGER trg_audit_price_change
  AFTER UPDATE OF price ON fullchinavzla.sellable_products
  FOR EACH ROW
  EXECUTE FUNCTION fullchinavzla.fn_audit_price_change();

COMMIT;
