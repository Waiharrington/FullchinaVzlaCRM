-- Registra la liquidación del delivery cuando una comanda queda pagada.
-- El cobro completo permanece en la cuenta de destino; esta tabla representa
-- la distribución operativa: 70% repartidor y 30% FullChina.

BEGIN;

SET LOCAL search_path = fullchinavzla, pg_temp;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_delivery_assignment_for_paid_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_employee_id UUID;
  v_delivery_fee NUMERIC(12,2);
BEGIN
  IF NEW.status <> 'paid' OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.order_type <> 'delivery' THEN
    RETURN NEW;
  END IF;

  SELECT e.id INTO v_employee_id
  FROM employees e
  WHERE e.role_code = 'delivery' AND e.is_active
  ORDER BY (e.source_key = 'employee:delivery') DESC, e.created_at
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No existe un empleado activo con rol delivery';
  END IF;

  SELECT ROUND(COALESCE(SUM(oi.quantity * oi.unit_price), 0), 2)
    INTO v_delivery_fee
  FROM order_items oi
  JOIN sellable_products sp ON sp.id = oi.sellable_product_id
  WHERE oi.order_id = NEW.id AND sp.is_delivery;

  IF v_delivery_fee > 0 THEN
    INSERT INTO delivery_assignments (order_id, employee_id, delivery_fee, employee_percent)
    VALUES (NEW.id, v_employee_id, v_delivery_fee, 70)
    ON CONFLICT (order_id) DO UPDATE
      SET delivery_fee = EXCLUDED.delivery_fee,
          employee_id = EXCLUDED.employee_id,
          employee_percent = EXCLUDED.employee_percent
      WHERE delivery_assignments.status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_delivery_assignment_on_paid_order
  ON fullchinavzla.orders;
CREATE TRIGGER trg_create_delivery_assignment_on_paid_order
  AFTER UPDATE OF status ON fullchinavzla.orders
  FOR EACH ROW
  EXECUTE FUNCTION fullchinavzla.fn_create_delivery_assignment_for_paid_order();

-- Reconcilia órdenes delivery ya pagadas que se crearon antes de este trigger.
INSERT INTO fullchinavzla.delivery_assignments (order_id, employee_id, delivery_fee, employee_percent)
SELECT o.id, e.id,
       ROUND(SUM(oi.quantity * oi.unit_price), 2),
       70
FROM fullchinavzla.orders o
JOIN fullchinavzla.order_items oi ON oi.order_id = o.id
JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id AND sp.is_delivery
JOIN LATERAL (
  SELECT e1.id
  FROM fullchinavzla.employees e1
  WHERE e1.role_code = 'delivery' AND e1.is_active
  ORDER BY (e1.source_key = 'employee:delivery') DESC, e1.created_at
  LIMIT 1
) e ON true
WHERE o.status = 'paid'
GROUP BY o.id, e.id
ON CONFLICT (order_id) DO NOTHING;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_create_delivery_assignment_for_paid_order()
  TO authenticated, service_role;

COMMIT;
