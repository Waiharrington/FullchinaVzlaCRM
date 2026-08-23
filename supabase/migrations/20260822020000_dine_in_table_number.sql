-- =============================================================================
-- FULL CHINA VZLA - Numero de mesa para pedidos "Mesa" (dine-in)
-- =============================================================================
-- Permite elegir la mesa (1..50) al crear un pedido de tipo dine-in, como en
-- el mapa de mesas de INVU. Se guarda en orders.table_number y se expone en
-- fn_checkout_order y en v_orders_with_items para Caja/Comandas.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

ALTER TABLE fullchinavzla.orders
  ADD COLUMN IF NOT EXISTS table_number smallint;

ALTER TABLE fullchinavzla.orders
  DROP CONSTRAINT IF EXISTS orders_table_number_check;
ALTER TABLE fullchinavzla.orders
  ADD CONSTRAINT orders_table_number_check
  CHECK (table_number IS NULL OR (table_number > 0 AND table_number <= 50));

CREATE INDEX IF NOT EXISTS idx_orders_open_dine_in_table
  ON fullchinavzla.orders (table_number)
  WHERE status = 'open' AND order_type = 'dine-in';

-- 1) fn_checkout_order: agregar p_table_number.
DROP FUNCTION IF EXISTS fullchinavzla.fn_checkout_order(jsonb, jsonb, numeric, text, text, text, numeric);

CREATE OR REPLACE FUNCTION fullchinavzla.fn_checkout_order(
  p_items jsonb,
  p_payments jsonb,
  p_bcv_rate numeric DEFAULT NULL::numeric,
  p_notes text DEFAULT NULL::text,
  p_order_type text DEFAULT 'takeaway'::text,
  p_customer_name text DEFAULT 'Cliente'::text,
  p_delivery_fee numeric DEFAULT 0,
  p_table_number smallint DEFAULT NULL::smallint
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_order fullchinavzla.orders%ROWTYPE;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC(12,3);
  v_unit_price NUMERIC(12,2);
  v_effective_price NUMERIC(12,2);
  v_order_item_id UUID;
  v_modifiers JSONB;
  v_mod JSONB;
  v_opt_id UUID;
  v_opt_qty NUMERIC(12,3);
  v_opt_price NUMERIC(12,2);
  v_payment_result JSONB;
  v_delivery_product_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_role := fullchinavzla.get_current_user_role();

  IF v_user_id IS NULL OR v_role NOT IN ('owner', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Usuario no autorizado para cobrar ordenes';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La orden debe contener al menos un producto';
  END IF;

  IF p_order_type NOT IN ('dine-in', 'takeaway', 'delivery') THEN
    RAISE EXCEPTION 'Tipo de orden invalido: %', p_order_type;
  END IF;

  IF p_table_number IS NOT NULL AND (p_table_number < 1 OR p_table_number > 50) THEN
    RAISE EXCEPTION 'Numero de mesa invalido: %', p_table_number;
  END IF;

  INSERT INTO fullchinavzla.orders (
    created_by, bcv_rate, notes, order_type, customer_name, status, table_number
  ) VALUES (
    v_user_id,
    p_bcv_rate,
    NULLIF(BTRIM(p_notes), ''),
    p_order_type,
    COALESCE(NULLIF(BTRIM(p_customer_name), ''), 'Cliente'),
    'open',
    CASE WHEN p_order_type = 'dine-in' THEN p_table_number ELSE NULL END
  )
  RETURNING * INTO v_order;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_product_id := (v_item->>'productId')::UUID;
      v_quantity := (v_item->>'quantity')::NUMERIC(12,3);
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Producto o cantidad invalida';
    END;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'La cantidad debe ser mayor a cero';
    END IF;

    SELECT price INTO v_unit_price
    FROM fullchinavzla.sellable_products
    WHERE id = v_product_id AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no existe o esta inactivo', v_product_id;
    END IF;

    -- Precio efectivo = base + opciones de modificador (todo del catálogo).
    v_effective_price := v_unit_price;
    v_modifiers := v_item->'modifiers';

    IF v_modifiers IS NOT NULL AND jsonb_typeof(v_modifiers) = 'array' THEN
      FOR v_mod IN SELECT value FROM jsonb_array_elements(v_modifiers)
      LOOP
        BEGIN
          v_opt_id := (v_mod->>'optionId')::UUID;
          v_opt_qty := COALESCE(NULLIF(v_mod->>'quantity','')::NUMERIC(12,3), 1);
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Opcion de modificador invalida';
        END;

        IF v_opt_qty <= 0 THEN
          RAISE EXCEPTION 'La cantidad de la opcion debe ser mayor a cero';
        END IF;

        -- La opción debe pertenecer a un modificador del producto y estar activa.
        SELECT mo.sale_price INTO v_opt_price
        FROM fullchinavzla.modifier_options mo
        JOIN fullchinavzla.sellable_product_modifiers spm ON spm.modifier_id = mo.modifier_id
        WHERE mo.id = v_opt_id
          AND mo.is_active = true
          AND spm.sellable_product_id = v_product_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Opcion % no valida para el producto %', v_opt_id, v_product_id;
        END IF;

        v_effective_price := v_effective_price + v_opt_price * v_opt_qty;
      END LOOP;
    END IF;

    INSERT INTO fullchinavzla.order_items (
      order_id, sellable_product_id, quantity, unit_price
    ) VALUES (
      v_order.id, v_product_id, v_quantity, v_effective_price
    )
    RETURNING id INTO v_order_item_id;

    -- Registrar las opciones elegidas (dispara el consumo por modificador).
    IF v_modifiers IS NOT NULL AND jsonb_typeof(v_modifiers) = 'array' THEN
      FOR v_mod IN SELECT value FROM jsonb_array_elements(v_modifiers)
      LOOP
        v_opt_id := (v_mod->>'optionId')::UUID;
        v_opt_qty := COALESCE(NULLIF(v_mod->>'quantity','')::NUMERIC(12,3), 1);

        SELECT mo.sale_price INTO v_opt_price
        FROM fullchinavzla.modifier_options mo
        WHERE mo.id = v_opt_id;

        INSERT INTO fullchinavzla.order_item_modifiers (
          order_item_id, modifier_option_id, quantity, unit_price
        ) VALUES (
          v_order_item_id, v_opt_id, v_opt_qty, COALESCE(v_opt_price, 0)
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Cargo de delivery como renglón adicional (precio variable por pedido).
  IF p_order_type = 'delivery' AND COALESCE(p_delivery_fee, 0) > 0 THEN
    SELECT id INTO v_delivery_product_id
    FROM fullchinavzla.sellable_products WHERE is_delivery = true LIMIT 1;
    IF v_delivery_product_id IS NULL THEN
      RAISE EXCEPTION 'No existe el producto de Delivery configurado';
    END IF;
    INSERT INTO fullchinavzla.order_items (
      order_id, sellable_product_id, quantity, unit_price
    ) VALUES (
      v_order.id, v_delivery_product_id, 1, ROUND(p_delivery_fee, 2)
    );
  END IF;

  v_payment_result := fullchinavzla.fn_record_order_payments(
    v_order.id,
    p_payments,
    p_notes
  );

  RETURN jsonb_build_object(
    'id', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_payment_result->>'status',
    'createdAt', v_order.created_at,
    'total', v_payment_result->'totalPaid'
  );
END;
$function$;

-- 2) v_orders_with_items: exponer table_number.
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
  o.customer_id,
  o.table_number
FROM fullchinavzla.orders o
LEFT JOIN fullchinavzla.customers cu ON cu.id = o.customer_id;

REVOKE ALL ON fullchinavzla.v_orders_with_items FROM PUBLIC, anon;
GRANT SELECT ON fullchinavzla.v_orders_with_items TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
