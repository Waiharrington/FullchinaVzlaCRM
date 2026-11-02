BEGIN;

CREATE TABLE IF NOT EXISTS fullchinavzla.delivery_payroll_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  employee_percent NUMERIC(5,2) NOT NULL DEFAULT 70 CHECK (employee_percent BETWEEN 0 AND 100)
);
INSERT INTO fullchinavzla.delivery_payroll_config (id, employee_percent) VALUES (1, 70) ON CONFLICT (id) DO NOTHING;
ALTER TABLE fullchinavzla.delivery_payroll_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_payroll_config_read ON fullchinavzla.delivery_payroll_config;
DROP POLICY IF EXISTS delivery_payroll_config_update ON fullchinavzla.delivery_payroll_config;
CREATE POLICY delivery_payroll_config_read ON fullchinavzla.delivery_payroll_config FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
CREATE POLICY delivery_payroll_config_update ON fullchinavzla.delivery_payroll_config FOR UPDATE TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
REVOKE ALL ON fullchinavzla.delivery_payroll_config FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON fullchinavzla.delivery_payroll_config TO authenticated;
GRANT SELECT ON fullchinavzla.delivery_payroll_config TO service_role;
DO $$ BEGIN
  IF to_regprocedure('fullchinavzla.bump_data_change_version()') IS NOT NULL THEN
    INSERT INTO fullchinavzla.data_change_versions (table_name) VALUES ('delivery_payroll_config') ON CONFLICT (table_name) DO NOTHING;
    DROP TRIGGER IF EXISTS fullchina_data_change_feed ON fullchinavzla.delivery_payroll_config;
    CREATE TRIGGER fullchina_data_change_feed AFTER INSERT OR UPDATE OR DELETE ON fullchinavzla.delivery_payroll_config
      FOR EACH STATEMENT EXECUTE FUNCTION fullchinavzla.bump_data_change_version();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_delivery_assignment_for_paid_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_employee_id UUID;
  v_delivery_fee NUMERIC(12,2);
  v_employee_percent NUMERIC(5,2);
BEGIN
  IF NEW.status <> 'paid' OR OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.order_type <> 'delivery' THEN
    RETURN NEW;
  END IF;
  SELECT e.id INTO v_employee_id FROM employees e
  WHERE e.role_code = 'delivery' AND e.is_active
  ORDER BY (e.source_key = 'employee:delivery') DESC, e.created_at LIMIT 1;
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No existe un empleado activo con rol delivery';
  END IF;
  SELECT ROUND(COALESCE(SUM(oi.quantity * oi.unit_price), 0), 2) INTO v_delivery_fee
  FROM order_items oi JOIN sellable_products sp ON sp.id = oi.sellable_product_id
  WHERE oi.order_id = NEW.id AND sp.is_delivery;
  IF v_delivery_fee > 0 THEN
    SELECT employee_percent INTO STRICT v_employee_percent FROM delivery_payroll_config WHERE id = 1;
    INSERT INTO delivery_assignments (order_id, employee_id, delivery_fee, employee_percent)
    VALUES (NEW.id, v_employee_id, v_delivery_fee, v_employee_percent)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
