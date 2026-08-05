-- #############################################################################
-- ##  Migración: estados de cocina + vistas auxiliares para el frontend       ##
-- #############################################################################
--
-- SCHEMA: fullchinavzla
--
-- Qué hace:
--   1) Agrega estados 'preparing' y 'ready' al CHECK de orders.status
--      para soportar el flujo de cocina: open → confirmed → preparing → ready → paid
--   2) Crea vistas materializadas/consultas auxiliares para el frontend:
--      - v_orders_with_items: órdenes con items anidados
--      - fn_get_today_stats: RPC para KPIs del dashboard
--      - fn_get_daily_sales: RPC para gráficos de ventas diarias
--      - fn_get_product_ranking: RPC para ranking de productos
--      - fn_create_daily_close: RPC para cierre de caja
--   3) Agrega columna order_type a orders (delivery/takeaway/dine-in)
--   4) Agrega columna customer_name a orders
--
-- Idempotente: puede correrse múltiples veces sin daño.
-- #############################################################################

BEGIN;

-- 1) Extender estados de cocina ------------------------------------------------
ALTER TABLE fullchinavzla.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE fullchinavzla.orders
  ADD CONSTRAINT orders_status_check CHECK (status IN (
    'open', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled'
  ));

COMMENT ON COLUMN fullchinavzla.orders.status IS
  'Estado de la orden: open (carrito) → confirmed (pagada) → preparing (cocina) → ready (lista) → paid (entregada). cancelled = anulada.';

-- 2) Agregar columnas de contexto a orders -------------------------------------
ALTER TABLE fullchinavzla.orders
  ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'takeaway'
    CHECK (order_type IN ('delivery', 'takeaway', 'dine-in'));

ALTER TABLE fullchinavzla.orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT 'Cliente';

COMMENT ON COLUMN fullchinavzla.orders.order_type IS
  'Tipo de pedido: delivery, takeaway, dine-in';
COMMENT ON COLUMN fullchinavzla.orders.customer_name IS
  'Nombre del cliente para la comanda';

-- 3) Vista: órdenes con items anidados -----------------------------------------
CREATE OR REPLACE VIEW fullchinavzla.v_orders_with_items AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.notes,
  o.order_type,
  o.customer_name,
  o.bcv_rate,
  o.created_by,
  o.created_at,
  o.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', oi.id,
        'sellable_product_id', oi.sellable_product_id,
        'product_name', sp.name,
        'emoji', sp.emoji,
        'category', sp.category,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price
      )
      ORDER BY oi.created_at
    ) FILTER (WHERE oi.id IS NOT NULL),
    '[]'
  ) AS items,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount,
  COUNT(oi.id) AS item_count
FROM fullchinavzla.orders o
LEFT JOIN fullchinavzla.order_items oi ON oi.order_id = o.id
LEFT JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id
GROUP BY o.id, o.order_number, o.status, o.notes, o.order_type,
         o.customer_name, o.bcv_rate, o.created_by, o.created_at, o.updated_at;

COMMENT ON VIEW fullchinavzla.v_orders_with_items IS
  'Órdenes con items anidados en JSON; para Comandas y Cocina';

-- 4) RPC: estadísticas de hoy -------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_today_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_total_sales NUMERIC(12,2);
  v_orders_count BIGINT;
  v_pending_count BIGINT;
  v_ready_count BIGINT;
  v_avg_ticket NUMERIC(12,2);
  v_result JSON;
BEGIN
  -- Ventas pagadas de hoy
  SELECT COALESCE(SUM(p.amount), 0), COUNT(DISTINCT o.id)
  INTO v_total_sales, v_orders_count
  FROM fullchinavzla.orders o
  JOIN fullchinavzla.payments p ON p.order_id = o.id
  WHERE o.status = 'paid'
    AND o.created_at::date = v_today;

  -- Órdenes pendientes (open + confirmed + preparing)
  SELECT COUNT(*)
  INTO v_pending_count
  FROM fullchinavzla.orders
  WHERE status IN ('open', 'confirmed', 'preparing')
    AND created_at::date = v_today;

  -- Órdenes listas (ready)
  SELECT COUNT(*)
  INTO v_ready_count
  FROM fullchinavzla.orders
  WHERE status = 'ready'
    AND created_at::date = v_today;

  -- Ticket promedio
  v_avg_ticket := CASE WHEN v_orders_count > 0 THEN v_total_sales / v_orders_count ELSE 0 END;

  v_result := json_build_object(
    'totalSales', v_total_sales,
    'ordersCount', v_orders_count,
    'pendingOrders', v_pending_count,
    'readyOrders', v_ready_count,
    'avgTicket', v_avg_ticket
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_today_stats() IS
  'RPC: retorna estadísticas de ventas de hoy como JSON';

-- 5) RPC: ventas diarias (para gráficos) --------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_daily_sales(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  sale_date DATE,
  total NUMERIC(12,2),
  order_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d::date AS sale_date,
    COALESCE(SUM(p.amount), 0)::NUMERIC(12,2) AS total,
    COUNT(DISTINCT o.id)::BIGINT AS order_count
  FROM generate_series((CURRENT_DATE - (p_days - 1))::date, CURRENT_DATE, '1 day') d
  LEFT JOIN fullchinavzla.orders o ON o.created_at::date = d AND o.status = 'paid'
  LEFT JOIN fullchinavzla.payments p ON p.order_id = o.id
  GROUP BY d
  ORDER BY d;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_daily_sales(INTEGER) IS
  'RPC: retorna ventas diarias de los últimos N días';

-- 6) RPC: ranking de productos -------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_product_ranking()
RETURNS TABLE (
  product_name TEXT,
  emoji TEXT,
  total_quantity NUMERIC(12,3),
  total_revenue NUMERIC(12,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.name AS product_name,
    sp.emoji AS emoji,
    SUM(oi.quantity)::NUMERIC(12,3) AS total_quantity,
    SUM(oi.quantity * oi.unit_price)::NUMERIC(12,2) AS total_revenue
  FROM fullchinavzla.order_items oi
  JOIN fullchinavzla.orders o ON o.id = oi.order_id
  JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id
  WHERE o.status = 'paid'
  GROUP BY sp.id, sp.name, sp.emoji
  ORDER BY total_revenue DESC;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_product_ranking() IS
  'RPC: retorna ranking de productos por revenue';

-- 7) RPC: ventas por categoría -------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_category_sales()
RETURNS TABLE (
  category TEXT,
  total NUMERIC(12,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.category,
    SUM(oi.quantity * oi.unit_price)::NUMERIC(12,2) AS total
  FROM fullchinavzla.order_items oi
  JOIN fullchinavzla.orders o ON o.id = oi.order_id
  JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id
  WHERE o.status = 'paid'
  GROUP BY sp.category
  ORDER BY total DESC;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_category_sales() IS
  'RPC: retorna ventas agrupadas por categoría de producto';

-- 8) RPC: ventas por método de pago -------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_payment_method_sales()
RETURNS TABLE (
  method TEXT,
  total NUMERIC(12,2),
  count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.method,
    SUM(p.amount)::NUMERIC(12,2) AS total,
    COUNT(*)::BIGINT AS count
  FROM fullchinavzla.payments p
  JOIN fullchinavzla.orders o ON o.id = p.order_id
  WHERE o.status = 'paid'
  GROUP BY p.method
  ORDER BY total DESC;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_payment_method_sales() IS
  'RPC: retorna ventas agrupadas por método de pago';

-- 9) RPC: crear cierre de caja ------------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_create_daily_close(
  p_close_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_total_sales NUMERIC(12,2);
  v_total_payments NUMERIC(12,2);
  v_close_id UUID;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo owner/manager pueden crear cierres de caja';
  END IF;

  -- Verificar que no exista ya un cierre para esa fecha
  IF EXISTS (SELECT 1 FROM fullchinavzla.daily_closes WHERE close_date = p_close_date) THEN
    RAISE EXCEPTION 'Ya existe un cierre para la fecha %', p_close_date;
  END IF;

  -- Calcular totales del día
  SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0)
  INTO v_total_sales
  FROM fullchinavzla.orders o
  JOIN fullchinavzla.order_items oi ON oi.order_id = o.id
  WHERE o.status = 'paid' AND o.created_at::date = p_close_date;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_total_payments
  FROM fullchinavzla.payments p
  JOIN fullchinavzla.orders o ON o.id = p.order_id
  WHERE o.status = 'paid' AND o.created_at::date = p_close_date;

  INSERT INTO fullchinavzla.daily_closes (close_date, total_sales, total_payments, notes, closed_by)
  VALUES (p_close_date, v_total_sales, v_total_payments, p_notes, auth.uid())
  RETURNING id INTO v_close_id;

  -- Crear registro financiero vacío (se puede llenar después)
  INSERT INTO fullchinavzla.daily_close_financials (daily_close_id, total_expenses, total_credits, updated_by)
  VALUES (v_close_id, 0, 0, auth.uid());

  RETURN v_close_id;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_create_daily_close(DATE, TEXT) IS
  'RPC: crea un cierre de caja diario calculando totales de órdenes pagadas';

-- 10) RPC: obtener resumen de inventario bajo ----------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_low_stock_count()
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM (
    SELECT
      i.id,
      COALESCE(SUM(sm.quantity), 0) AS current_stock
    FROM fullchinavzla.ingredients i
    LEFT JOIN fullchinavzla.stock_movements sm ON sm.ingredient_id = i.id
    WHERE i.is_active = true
    GROUP BY i.id
    HAVING COALESCE(SUM(sm.quantity), 0) <= 10  -- umbral genérico
  ) sub;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_get_low_stock_count() IS
  'RPC: retorna cantidad de ingredientes con stock bajo';

COMMIT;
