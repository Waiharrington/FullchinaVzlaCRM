-- Corrige fn_create_receivable_for_delivered_order(): intentaba leer
-- "total_amount" directo de fullchinavzla.orders, pero esa columna nunca
-- existió ahí — solo existe calculada (SUM de order_items) dentro de la
-- vista v_orders_with_items. Esto hacía fallar CUALQUIER cambio de estado
-- que marcara una orden como "delivered" con el error de Postgres 42703
-- "column total_amount does not exist".
BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_receivable_for_delivered_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_total NUMERIC(14,2);
  v_paid NUMERIC(14,2);
BEGIN
  IF NEW.fulfillment_status <> 'delivered' OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE((
           SELECT SUM(oi.quantity * oi.unit_price)
           FROM fullchinavzla.order_items oi
           WHERE oi.order_id = NEW.id
         ), 0),
         COALESCE((SELECT SUM(amount) FROM fullchinavzla.payments WHERE order_id = NEW.id), 0)
    INTO v_total, v_paid;

  IF v_total > v_paid THEN
    INSERT INTO fullchinavzla.credits(order_id, customer_id, customer_name, total_amount, notes, created_by)
    VALUES (NEW.id, NEW.customer_id, COALESCE(NEW.customer_name, 'Cliente'), v_total - v_paid,
            'Creado automáticamente: comanda entregada sin pago completo', NEW.created_by)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
