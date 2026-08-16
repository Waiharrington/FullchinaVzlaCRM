-- =============================================================================
-- FULL CHINA VZLA - CHECKOUT CON MODIFICADORES (Fase B)
-- =============================================================================
-- Reemplaza fn_checkout_order para aceptar, por ítem, un arreglo opcional
-- `modifiers: [{ optionId, quantity }]`. El precio efectivo del renglón se sella
-- en order_items.unit_price = precio_base + Σ(precio_opción * cantidad), tomando
-- SIEMPRE los precios del catálogo (anti-manipulación). Luego inserta las
-- opciones en order_item_modifiers, lo que dispara el consumo de inventario.
--
-- Integridad server-side: cada opción debe pertenecer a un modificador asignado
-- al producto y estar activa. Las reglas min/max se validan en la UI (no se
-- endurecen aquí para no bloquear una venta en caja). La maquinaria de totales y
-- pagos queda intacta porque sigue leyendo order_items.unit_price.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

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
  v_effective_price NUMERIC(12,2);
  v_order_item_id UUID;
  v_modifiers JSONB;
  v_mod JSONB;
  v_opt_id UUID;
  v_opt_qty NUMERIC(12,3);
  v_opt_price NUMERIC(12,2);
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

RESET ROLE;

COMMIT;

-- =============================================================================
-- ROLLBACK: restaurar la versión previa de fn_checkout_order desde
-- 20260808003000_atomic_checkout.sql (sin manejo de modificadores).
-- =============================================================================
