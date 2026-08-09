-- =============================================================================
-- FULL CHINA VZLA - CHECKOUT ATOMICO DE CAJA
-- =============================================================================
-- Crea orden, items y pagos dentro de una sola transaccion. Si cualquier
-- validacion falla, no queda una orden incompleta en la base de datos.
-- Los precios siempre se toman del catalogo activo, no del navegador.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_checkout_order(
  p_items JSONB,
  p_payments JSONB,
  p_bcv_rate NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_order_type TEXT DEFAULT 'takeaway',
  p_customer_name TEXT DEFAULT 'Cliente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_order fullchinavzla.orders%ROWTYPE;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC(12,3);
  v_unit_price NUMERIC(12,2);
  v_payment_result JSONB;
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

  INSERT INTO fullchinavzla.orders (
    created_by, bcv_rate, notes, order_type, customer_name, status
  ) VALUES (
    v_user_id,
    p_bcv_rate,
    NULLIF(BTRIM(p_notes), ''),
    p_order_type,
    COALESCE(NULLIF(BTRIM(p_customer_name), ''), 'Cliente'),
    'open'
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

    INSERT INTO fullchinavzla.order_items (
      order_id, sellable_product_id, quantity, unit_price
    ) VALUES (
      v_order.id, v_product_id, v_quantity, v_unit_price
    );
  END LOOP;

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
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_checkout_order(
  JSONB, JSONB, NUMERIC, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION fullchinavzla.fn_checkout_order(
  JSONB, JSONB, NUMERIC, TEXT, TEXT, TEXT
) TO authenticated, service_role;

COMMENT ON FUNCTION fullchinavzla.fn_checkout_order(
  JSONB, JSONB, NUMERIC, TEXT, TEXT, TEXT
) IS 'Crea y cobra una orden de Caja atomicamente usando precios del catalogo';

COMMIT;
