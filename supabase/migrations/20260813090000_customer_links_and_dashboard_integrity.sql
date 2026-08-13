-- Enlaces estables entre clientes, pedidos y créditos.
-- Conserva customer_name como instantánea visible, pero customer_id pasa a ser
-- la relación canónica para que una corrección de nombre no pierda historial.

BEGIN;

ALTER TABLE fullchinavzla.orders
  ADD COLUMN IF NOT EXISTS customer_id UUID
  REFERENCES fullchinavzla.customers(id) ON DELETE SET NULL;

ALTER TABLE fullchinavzla.credits
  ADD COLUMN IF NOT EXISTS customer_id UUID
  REFERENCES fullchinavzla.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON fullchinavzla.orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_credits_customer_id
  ON fullchinavzla.credits(customer_id);

-- Solo se enlazan nombres que identifican exactamente a un cliente. Los
-- duplicados permanecen NULL para evitar atribuir ventas o deudas a la persona
-- equivocada.
-- El guard de órdenes pagadas bloquea cualquier UPDATE. Se suspende solo para
-- completar esta nueva FK, sin cambiar importes, pagos, estado ni timestamps.
ALTER TABLE fullchinavzla.orders DISABLE TRIGGER trg_orders_amount_guard;

WITH unique_customers AS (
  SELECT
    lower(btrim(full_name)) AS name_key,
    (array_agg(id ORDER BY created_at, id))[1] AS customer_id
  FROM fullchinavzla.customers
  WHERE NULLIF(btrim(full_name), '') IS NOT NULL
  GROUP BY lower(btrim(full_name))
  HAVING count(*) = 1
)
UPDATE fullchinavzla.orders o
SET customer_id = u.customer_id
FROM unique_customers u
WHERE o.customer_id IS NULL
  AND lower(btrim(o.customer_name)) = u.name_key;

ALTER TABLE fullchinavzla.orders ENABLE TRIGGER trg_orders_amount_guard;

UPDATE fullchinavzla.credits c
SET customer_id = o.customer_id
FROM fullchinavzla.orders o
WHERE c.customer_id IS NULL
  AND c.order_id = o.id
  AND o.customer_id IS NOT NULL;

WITH unique_customers AS (
  SELECT
    lower(btrim(full_name)) AS name_key,
    (array_agg(id ORDER BY created_at, id))[1] AS customer_id
  FROM fullchinavzla.customers
  WHERE NULLIF(btrim(full_name), '') IS NOT NULL
  GROUP BY lower(btrim(full_name))
  HAVING count(*) = 1
)
UPDATE fullchinavzla.credits c
SET customer_id = u.customer_id
FROM unique_customers u
WHERE c.customer_id IS NULL
  AND lower(btrim(c.customer_name)) = u.name_key;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_assign_order_customer_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_ids UUID[];
BEGIN
  IF NEW.customer_id IS NULL AND NULLIF(btrim(NEW.customer_name), '') IS NOT NULL THEN
    SELECT array_agg(id ORDER BY created_at, id)
    INTO v_ids
    FROM fullchinavzla.customers
    WHERE lower(btrim(full_name)) = lower(btrim(NEW.customer_name));

    IF cardinality(v_ids) = 1 THEN
      NEW.customer_id := v_ids[1];
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_order_customer_id ON fullchinavzla.orders;
CREATE TRIGGER trg_assign_order_customer_id
BEFORE INSERT OR UPDATE OF customer_name, customer_id
ON fullchinavzla.orders
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_assign_order_customer_id();

REVOKE ALL ON FUNCTION fullchinavzla.fn_assign_order_customer_id() FROM PUBLIC;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_assign_credit_customer_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_ids UUID[];
  v_order_customer_id UUID;
BEGIN
  IF NEW.customer_id IS NULL THEN
    SELECT customer_id INTO v_order_customer_id
    FROM fullchinavzla.orders
    WHERE id = NEW.order_id;
    NEW.customer_id := v_order_customer_id;
  END IF;

  IF NEW.customer_id IS NULL AND NULLIF(btrim(NEW.customer_name), '') IS NOT NULL THEN
    SELECT array_agg(id ORDER BY created_at, id)
    INTO v_ids
    FROM fullchinavzla.customers
    WHERE lower(btrim(full_name)) = lower(btrim(NEW.customer_name));

    IF cardinality(v_ids) = 1 THEN
      NEW.customer_id := v_ids[1];
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_credit_customer_id ON fullchinavzla.credits;
CREATE TRIGGER trg_assign_credit_customer_id
BEFORE INSERT OR UPDATE OF customer_name, customer_id, order_id
ON fullchinavzla.credits
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_assign_credit_customer_id();

REVOKE ALL ON FUNCTION fullchinavzla.fn_assign_credit_customer_id() FROM PUBLIC;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_update_customer(
  p_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_identification TEXT,
  p_address TEXT,
  p_birth_date DATE
)
RETURNS SETOF fullchinavzla.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := fullchinavzla.get_current_user_role();

  IF auth.uid() IS NULL OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Usuario no autorizado para editar clientes';
  END IF;

  IF NULLIF(btrim(p_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio';
  END IF;

  PERFORM 1
  FROM fullchinavzla.customers
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  RETURN QUERY
  UPDATE fullchinavzla.customers SET
    full_name      = btrim(p_full_name),
    phone          = NULLIF(btrim(p_phone), ''),
    identification = NULLIF(btrim(p_identification), ''),
    address        = NULLIF(btrim(p_address), ''),
    birth_date     = p_birth_date,
    updated_at     = now()
  WHERE id = p_id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_update_customer(UUID, TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_update_customer(UUID, TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;

CREATE OR REPLACE VIEW fullchinavzla.v_credit_balances
WITH (security_invoker = true) AS
SELECT
  c.id AS credit_id,
  COALESCE(cu.full_name, c.customer_name) AS customer_name,
  c.total_amount,
  CASE
    WHEN COALESCE(SUM(cp.amount), 0) <= 0 THEN 'pending'
    WHEN COALESCE(SUM(cp.amount), 0) >= c.total_amount THEN 'paid'
    ELSE 'partial'
  END AS status,
  c.order_id,
  COALESCE(SUM(cp.amount), 0) AS total_paid,
  c.total_amount - COALESCE(SUM(cp.amount), 0) AS balance_pending,
  c.created_at,
  c.customer_id
FROM fullchinavzla.credits c
LEFT JOIN fullchinavzla.credit_payments cp ON cp.credit_id = c.id
LEFT JOIN fullchinavzla.customers cu ON cu.id = c.customer_id
GROUP BY c.id, c.customer_name, cu.full_name, c.total_amount, c.order_id, c.created_at, c.customer_id;

CREATE OR REPLACE VIEW fullchinavzla.v_orders_with_items
WITH (security_invoker = true) AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.notes,
  o.order_type,
  COALESCE(cu.full_name, o.customer_name) AS customer_name,
  o.bcv_rate,
  o.created_by,
  o.created_at,
  o.updated_at,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', oi.id,
      'sellable_product_id', oi.sellable_product_id,
      'product_name', sp.name,
      'emoji', sp.emoji,
      'category', sp.category,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price
    ) ORDER BY oi.created_at)
    FROM fullchinavzla.order_items oi
    LEFT JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id
    WHERE oi.order_id = o.id
  ), '[]'::json) AS items,
  COALESCE((
    SELECT SUM(oi.quantity * oi.unit_price)
    FROM fullchinavzla.order_items oi
    WHERE oi.order_id = o.id
  ), 0) AS total_amount,
  (
    SELECT count(*)
    FROM fullchinavzla.order_items oi
    WHERE oi.order_id = o.id
  ) AS item_count,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', p.id,
      'method', p.method,
      'amount', p.amount,
      'reference_number', p.reference_number,
      'received_amount', p.received_amount,
      'notes', p.notes,
      'created_at', p.created_at
    ) ORDER BY p.created_at)
    FROM fullchinavzla.payments p
    WHERE p.order_id = o.id
  ), '[]'::json) AS payments,
  o.fulfillment_status,
  o.customer_id
FROM fullchinavzla.orders o
LEFT JOIN fullchinavzla.customers cu ON cu.id = o.customer_id;

REVOKE ALL ON fullchinavzla.v_credit_balances FROM PUBLIC, anon;
GRANT SELECT ON fullchinavzla.v_credit_balances TO authenticated, service_role;
REVOKE ALL ON fullchinavzla.v_orders_with_items FROM PUBLIC, anon;
GRANT SELECT ON fullchinavzla.v_orders_with_items TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
