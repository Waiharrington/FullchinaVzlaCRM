BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_apply_inventory_snapshot(
  p_items JSONB,
  p_source_file TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_item RECORD;
  v_location TEXT;
  v_target NUMERIC;
  v_current NUMERIC;
  v_delta NUMERIC;
  v_unit_id UUID;
  v_created INTEGER := 0;
  v_file_name TEXT := left(COALESCE(NULLIF(trim(p_source_file), ''), 'archivo Excel'), 180);
BEGIN
  IF auth.uid() IS NULL OR COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo owner/manager puede importar saldos de inventario';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La importación debe incluir al menos un producto';
  END IF;
  IF jsonb_array_length(p_items) > 1000 THEN
    RAISE EXCEPTION 'La importación no puede exceder 1000 productos';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS x(item)
    WHERE jsonb_typeof(item) <> 'object'
      OR jsonb_typeof(item->'ingredient_id') <> 'string'
      OR jsonb_typeof(item->'operational_stock') <> 'number'
      OR jsonb_typeof(item->'warehouse_stock') <> 'number'
  ) THEN
    RAISE EXCEPTION 'Cada producto necesita ID y cantidades numéricas para Producción y Depósito';
  END IF;
  IF EXISTS (
    SELECT ingredient_id
    FROM jsonb_to_recordset(p_items) AS x(ingredient_id UUID, operational_stock NUMERIC, warehouse_stock NUMERIC)
    GROUP BY ingredient_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'El archivo repite productos; corrige las filas duplicadas antes de importar';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS x(ingredient_id UUID, operational_stock NUMERIC, warehouse_stock NUMERIC)
    WHERE ingredient_id IS NULL OR operational_stock IS NULL OR warehouse_stock IS NULL
  ) THEN
    RAISE EXCEPTION 'Hay filas sin identificador o sin saldo de Producción/Depósito';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS x(ingredient_id UUID, operational_stock NUMERIC, warehouse_stock NUMERIC)
    LEFT JOIN fullchinavzla.ingredients i ON i.id=x.ingredient_id AND i.is_active=true
    WHERE i.id IS NULL OR i.inventory_class='non_inventory'
  ) THEN
    RAISE EXCEPTION 'El archivo contiene artículos inactivos o que no manejan existencias';
  END IF;

  -- Bloquea temporalmente otras escrituras de inventario para calcular todos
  -- los deltas contra un mismo corte y grabarlos sin carreras concurrentes.
  LOCK TABLE fullchinavzla.stock_movements IN SHARE ROW EXCLUSIVE MODE;

  FOR v_item IN
    SELECT ingredient_id, operational_stock, warehouse_stock
    FROM jsonb_to_recordset(p_items) AS x(ingredient_id UUID, operational_stock NUMERIC, warehouse_stock NUMERIC)
  LOOP
    SELECT unit_id INTO v_unit_id
    FROM fullchinavzla.ingredients
    WHERE id=v_item.ingredient_id AND is_active=true AND inventory_class <> 'non_inventory';

    FOREACH v_location IN ARRAY ARRAY['operational', 'warehouse'] LOOP
      v_target := CASE WHEN v_location='operational' THEN v_item.operational_stock ELSE v_item.warehouse_stock END;
      SELECT COALESCE(sum(quantity),0) INTO v_current
      FROM fullchinavzla.stock_movements
      WHERE ingredient_id=v_item.ingredient_id AND stock_location=v_location;

      v_delta := v_target-v_current;
      IF v_delta <> 0 THEN
        INSERT INTO fullchinavzla.stock_movements (
          ingredient_id, quantity, unit_id, movement_type, reference_type,
          stock_location, notes, created_by
        ) VALUES (
          v_item.ingredient_id, v_delta, v_unit_id, 'adjustment', 'manual',
          v_location,
          format('Importación de inventario desde %s; saldo objetivo %s: %s', v_file_name, v_location, v_target),
          auth.uid()
        );
        v_created := v_created+1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_apply_inventory_snapshot(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_apply_inventory_snapshot(JSONB, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
