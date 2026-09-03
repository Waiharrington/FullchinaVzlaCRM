-- Separa el stock comprado del inventario operativo.
-- Compra -> almacén; transferencia -> inventario operativo; venta -> inventario operativo.
ALTER TABLE fullchinavzla.stock_movements
  ADD COLUMN IF NOT EXISTS stock_location TEXT NOT NULL DEFAULT 'operational';

ALTER TABLE fullchinavzla.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_stock_location_check;

ALTER TABLE fullchinavzla.stock_movements
  ADD CONSTRAINT stock_movements_stock_location_check
  CHECK (stock_location IN ('warehouse', 'operational'));

CREATE INDEX IF NOT EXISTS idx_stock_movements_location_ingredient
  ON fullchinavzla.stock_movements(stock_location, ingredient_id);

CREATE OR REPLACE FUNCTION fullchinavzla.fn_purchase_item_to_stock()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_base_unit UUID;
  v_normalized NUMERIC;
  v_price NUMERIC(12,2);
  v_purchase_creator UUID;
BEGIN
  SELECT unit_id INTO v_base_unit FROM fullchinavzla.ingredients WHERE id = NEW.ingredient_id;
  v_normalized := CASE WHEN NEW.unit_id = v_base_unit
    THEN NEW.quantity
    ELSE fullchinavzla.normalize_to_base_unit(NEW.ingredient_id, NEW.quantity, NEW.unit_id)
  END;
  SELECT created_by INTO v_purchase_creator FROM fullchinavzla.purchases WHERE id = NEW.purchase_id;

  INSERT INTO fullchinavzla.stock_movements (
    ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id,
    stock_location, created_by
  ) VALUES (
    NEW.ingredient_id, v_normalized, v_base_unit, 'purchase', 'purchase_item', NEW.id,
    'warehouse', v_purchase_creator
  );

  v_price := NEW.unit_cost;
  IF NEW.unit_id <> v_base_unit THEN
    v_price := NEW.unit_cost / fullchinavzla.normalize_to_base_unit(NEW.ingredient_id, 1, NEW.unit_id);
  END IF;
  INSERT INTO fullchinavzla.ingredient_costs (ingredient_id, price_per_unit, updated_by)
  VALUES (NEW.ingredient_id, v_price, v_purchase_creator)
  ON CONFLICT (ingredient_id) DO UPDATE SET
    price_per_unit = EXCLUDED.price_per_unit, last_updated = now(), updated_by = EXCLUDED.updated_by;
  RETURN NEW;
END;
$$;

-- La producción transforma materia prima del almacén. Al borrar un detalle,
-- se registra la reversa en la misma ubicación para conservar el historial.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_batch_items_cost_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE v_creator UUID; v_qty NUMERIC; v_base UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fullchinavzla.update_batch_cost(NEW.preparation_batch_id);
    SELECT created_by INTO v_creator FROM fullchinavzla.preparation_batches WHERE id = NEW.preparation_batch_id;
    v_qty := fullchinavzla.normalize_to_base_unit(NEW.ingredient_id, NEW.quantity_used, NEW.unit_id);
    SELECT unit_id INTO v_base FROM fullchinavzla.ingredients WHERE id = NEW.ingredient_id;
    INSERT INTO fullchinavzla.stock_movements (ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id, stock_location, created_by)
      VALUES (NEW.ingredient_id, -v_qty, v_base, 'consumption', 'preparation_batch', NEW.preparation_batch_id, 'warehouse', v_creator);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fullchinavzla.update_batch_cost(OLD.preparation_batch_id);
    SELECT created_by INTO v_creator FROM fullchinavzla.preparation_batches WHERE id = OLD.preparation_batch_id;
    v_qty := fullchinavzla.normalize_to_base_unit(OLD.ingredient_id, OLD.quantity_used, OLD.unit_id);
    SELECT unit_id INTO v_base FROM fullchinavzla.ingredients WHERE id = OLD.ingredient_id;
    INSERT INTO fullchinavzla.stock_movements (ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id, stock_location, created_by)
      VALUES (OLD.ingredient_id, v_qty, v_base, 'adjustment', 'preparation_batch', OLD.preparation_batch_id, 'warehouse', v_creator);
  END IF;
  RETURN NULL;
END;
$$;

DROP VIEW IF EXISTS fullchinavzla.v_current_stock;
CREATE VIEW fullchinavzla.v_current_stock
WITH (security_invoker = true) AS
SELECT i.id AS ingredient_id, i.name AS ingredient_name,
  u.id AS unit_id, u.name AS unit_name, u.symbol AS unit_symbol,
  COALESCE(SUM(sm.quantity) FILTER (WHERE sm.stock_location = 'operational'), 0) AS current_stock,
  ic.price_per_unit,
  COALESCE(SUM(sm.quantity) FILTER (WHERE sm.stock_location = 'operational'), 0) * ic.price_per_unit AS stock_value
FROM fullchinavzla.ingredients i
JOIN fullchinavzla.units u ON i.unit_id = u.id
LEFT JOIN fullchinavzla.stock_movements sm ON sm.ingredient_id = i.id
LEFT JOIN fullchinavzla.ingredient_costs ic ON ic.ingredient_id = i.id
WHERE i.is_active = true
GROUP BY i.id, i.name, u.id, u.name, u.symbol, ic.price_per_unit;

DROP VIEW IF EXISTS fullchinavzla.v_warehouse_stock;
CREATE VIEW fullchinavzla.v_warehouse_stock
WITH (security_invoker = true) AS
SELECT i.id AS ingredient_id, i.name AS ingredient_name,
  u.id AS unit_id, u.name AS unit_name, u.symbol AS unit_symbol,
  COALESCE(SUM(sm.quantity) FILTER (WHERE sm.stock_location = 'warehouse'), 0) AS current_stock,
  ic.price_per_unit,
  COALESCE(SUM(sm.quantity) FILTER (WHERE sm.stock_location = 'warehouse'), 0) * ic.price_per_unit AS stock_value
FROM fullchinavzla.ingredients i
JOIN fullchinavzla.units u ON i.unit_id = u.id
LEFT JOIN fullchinavzla.stock_movements sm ON sm.ingredient_id = i.id
LEFT JOIN fullchinavzla.ingredient_costs ic ON ic.ingredient_id = i.id
WHERE i.is_active = true
GROUP BY i.id, i.name, u.id, u.name, u.symbol, ic.price_per_unit;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_transfer_stock(
  p_ingredient_id UUID, p_quantity NUMERIC, p_unit_id UUID, p_from TEXT, p_to TEXT, p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE v_base UUID; v_qty NUMERIC; v_available NUMERIC; v_ref UUID := gen_random_uuid();
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Solo owner/manager pueden transferir stock'; END IF;
  IF p_from NOT IN ('warehouse','operational') OR p_to NOT IN ('warehouse','operational') OR p_from = p_to THEN RAISE EXCEPTION 'Ubicaciones inválidas'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero'; END IF;
  SELECT unit_id INTO v_base FROM fullchinavzla.ingredients WHERE id = p_ingredient_id AND is_active = true;
  IF v_base IS NULL THEN RAISE EXCEPTION 'Insumo no encontrado'; END IF;
  v_qty := CASE WHEN p_unit_id = v_base THEN p_quantity ELSE fullchinavzla.normalize_to_base_unit(p_ingredient_id, p_quantity, p_unit_id) END;
  SELECT COALESCE(SUM(locked.quantity),0) INTO v_available
    FROM (SELECT quantity FROM fullchinavzla.stock_movements
      WHERE ingredient_id = p_ingredient_id AND stock_location = p_from FOR UPDATE) locked;
  IF v_available < v_qty THEN RAISE EXCEPTION 'Stock insuficiente en la ubicación de origen'; END IF;
  INSERT INTO fullchinavzla.stock_movements (ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id, stock_location, notes, created_by)
    VALUES (p_ingredient_id, -v_qty, v_base, 'adjustment', 'manual', v_ref, p_from, COALESCE(p_notes,'Transferencia interna'), auth.uid());
  INSERT INTO fullchinavzla.stock_movements (ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id, stock_location, notes, created_by)
    VALUES (p_ingredient_id, v_qty, v_base, 'adjustment', 'manual', v_ref, p_to, COALESCE(p_notes,'Transferencia interna'), auth.uid());
  RETURN v_ref;
END;
$$;

GRANT SELECT ON fullchinavzla.v_warehouse_stock TO authenticated;
GRANT SELECT ON fullchinavzla.v_current_stock TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_transfer_stock(UUID, NUMERIC, UUID, TEXT, TEXT, TEXT) TO authenticated;
