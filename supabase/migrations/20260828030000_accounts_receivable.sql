-- Cuentas por cobrar: vencimiento, límite por cliente y enlace automático
-- de comandas entregadas que aún tienen saldo pendiente.
BEGIN;

ALTER TABLE fullchinavzla.credits
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS is_indefinite BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE fullchinavzla.credits ALTER COLUMN order_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_credits_one_per_order
  ON fullchinavzla.credits(order_id);

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

  SELECT COALESCE(total_amount, 0),
         COALESCE((SELECT SUM(amount) FROM fullchinavzla.payments WHERE order_id = NEW.id), 0)
    INTO v_total, v_paid
  FROM fullchinavzla.orders WHERE id = NEW.id;

  IF v_total > v_paid THEN
    INSERT INTO fullchinavzla.credits(order_id, customer_id, customer_name, total_amount, notes, created_by)
    VALUES (NEW.id, NEW.customer_id, COALESCE(NEW.customer_name, 'Cliente'), v_total - v_paid,
            'Creado automáticamente: comanda entregada sin pago completo', NEW.created_by)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_receivable_delivered_order ON fullchinavzla.orders;
CREATE TRIGGER trg_create_receivable_delivered_order
AFTER INSERT OR UPDATE OF fulfillment_status, customer_id ON fullchinavzla.orders
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_create_receivable_for_delivered_order();

CREATE OR REPLACE VIEW fullchinavzla.v_credit_balances
WITH (security_invoker = true) AS
SELECT c.id AS credit_id, COALESCE(cu.full_name, c.customer_name) AS customer_name,
  c.total_amount, CASE WHEN COALESCE(SUM(cp.amount),0) <= 0 THEN 'pending'
    WHEN COALESCE(SUM(cp.amount),0) >= c.total_amount THEN 'paid' ELSE 'partial' END AS status,
  c.order_id, COALESCE(SUM(cp.amount),0) AS total_paid,
  c.total_amount - COALESCE(SUM(cp.amount),0) AS balance_pending,
  c.created_at, c.customer_id, c.due_date, c.is_indefinite,
  CASE WHEN c.is_indefinite OR c.due_date IS NULL THEN false ELSE c.due_date < CURRENT_DATE END AS is_overdue
FROM fullchinavzla.credits c LEFT JOIN fullchinavzla.credit_payments cp ON cp.credit_id = c.id
LEFT JOIN fullchinavzla.customers cu ON cu.id = c.customer_id
GROUP BY c.id, c.customer_name, cu.full_name, c.total_amount, c.order_id, c.created_at,
  c.customer_id, c.due_date, c.is_indefinite;

COMMIT;
