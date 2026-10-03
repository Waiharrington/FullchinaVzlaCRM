-- Autoriza un crédito desde el cobro de una comanda sin registrar dinero recibido.
-- El PIN es independiente del PIN personal de acceso y se valida en el servidor.
BEGIN;

-- Una comanda impaga permanece en "Por pagar" hasta que alguien autorice crédito.
DROP TRIGGER IF EXISTS trg_create_receivable_delivered_order ON fullchinavzla.orders;

ALTER TABLE fullchinavzla.orders
  ADD COLUMN IF NOT EXISTS credit_authorized BOOLEAN NOT NULL DEFAULT false;

UPDATE fullchinavzla.orders o SET credit_authorized = true
WHERE NOT o.credit_authorized AND EXISTS (
  SELECT 1 FROM fullchinavzla.credits c WHERE c.order_id = o.id
);

CREATE OR REPLACE VIEW fullchinavzla.v_orders_with_credit_status
WITH (security_invoker = true) AS
SELECT v.*, o.credit_authorized
FROM fullchinavzla.v_orders_with_items v
JOIN fullchinavzla.orders o ON o.id = v.id;
REVOKE ALL ON fullchinavzla.v_orders_with_credit_status FROM PUBLIC, anon;
GRANT SELECT ON fullchinavzla.v_orders_with_credit_status TO authenticated, service_role;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_authorize_order_credit(
  p_order_id UUID,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := fullchinavzla.get_current_user_role();
  v_customer_id UUID;
  v_customer_name TEXT;
  v_status TEXT;
  v_total NUMERIC(14,2);
  v_paid NUMERIC(14,2);
  v_credit_id UUID;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Usuario no autorizado para registrar créditos';
  END IF;
  IF p_pin IS DISTINCT FROM '1234' THEN
    RAISE EXCEPTION 'PIN de autorización incorrecto';
  END IF;

  SELECT o.customer_id, COALESCE(o.customer_name, 'Cliente'), o.status,
         COALESCE((SELECT sum(oi.quantity * oi.unit_price) FROM order_items oi WHERE oi.order_id = o.id), 0),
         COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.order_id = o.id), 0)
    INTO v_customer_id, v_customer_name, v_status, v_total, v_paid
  FROM orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'La comanda no existe'; END IF;
  IF v_status IN ('paid', 'cancelled') THEN RAISE EXCEPTION 'La comanda ya está %', v_status; END IF;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Asocia un cliente antes de autorizar el crédito'; END IF;
  IF v_total <= v_paid THEN RAISE EXCEPTION 'La comanda no tiene saldo pendiente'; END IF;

  SELECT id INTO v_credit_id FROM credits WHERE order_id = p_order_id FOR UPDATE;
  IF v_credit_id IS NULL THEN
    INSERT INTO credits(order_id, customer_id, customer_name, total_amount, notes, created_by)
    VALUES (p_order_id, v_customer_id, v_customer_name, v_total - v_paid,
            'Crédito autorizado desde Comandas', v_user_id)
    RETURNING id INTO v_credit_id;
  END IF;

  UPDATE orders SET credit_authorized = true WHERE id = p_order_id;

  RETURN jsonb_build_object('orderId', p_order_id, 'creditId', v_credit_id,
                            'balancePending', v_total - v_paid, 'status', 'authorized');
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_authorize_order_credit(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_authorize_order_credit(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
