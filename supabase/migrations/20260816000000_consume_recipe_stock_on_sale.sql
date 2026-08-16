-- =============================================================================
-- FULL CHINA VZLA - CONSUMO DE INVENTARIO AL VENDER (segun receta)
-- =============================================================================
-- Cuando se agrega un producto a una orden (checkout de Caja o envio a Cocina),
-- se descuentan del inventario los INGREDIENTES de su receta, normalizados a la
-- unidad base y multiplicados por la cantidad vendida. El descuento se registra
-- como movimientos append-only en stock_movements (movement_type='consumption',
-- reference_type='order_item'), de modo que el stock derivado = SUM(quantity)
-- baja automaticamente y se refleja en Inventario/Almacen sin cambios de app.
--
-- Componentes de PORCION (preparation_batch_id) se OMITEN a proposito: su
-- materia prima ya se descuento cuando se produjo el lote. Descontarla otra vez
-- en la venta seria doble conteo. El agotamiento de porciones es un tema de
-- planificacion de produccion, no de inventario de materia prima.
--
-- Al CANCELAR una orden no pagada se revierte el consumo (movimiento de ajuste
-- positivo por cada consumo original), asumiendo que la orden no se sirvio. Si
-- una orden cancelada si se cocino, el owner puede corregir con un ajuste manual.
--
-- No bloquea la venta si el stock queda negativo: la operacion no se detiene por
-- recetas/compras incompletas. El stock negativo es una senal para alertas de
-- inventario bajo, no un freno de caja.
--
-- Efecto retroactivo: ninguno. Solo aplica a order_items insertados despues de
-- esta migracion, y solo para productos que tengan receta con ingredientes.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

-- --- Consumo al insertar cada renglon de la orden ----------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_consume_recipe_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_creator   UUID;
  v_component RECORD;
  v_normalized NUMERIC;
  v_base_unit UUID;
BEGIN
  -- Autor de la orden: se usa como created_by del movimiento de consumo.
  SELECT created_by INTO v_creator
  FROM fullchinavzla.orders
  WHERE id = NEW.order_id;

  -- Recorrer solo los componentes de INGREDIENTE de la receta del producto.
  FOR v_component IN
    SELECT rc.ingredient_id, rc.quantity, rc.unit_id
    FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = NEW.sellable_product_id
      AND rc.ingredient_id IS NOT NULL
  LOOP
    -- Cantidad total consumida = cantidad por receta * cantidad vendida,
    -- convertida a la unidad base del ingrediente.
    v_normalized := fullchinavzla.normalize_to_base_unit(
      v_component.ingredient_id,
      v_component.quantity * NEW.quantity,
      v_component.unit_id
    );

    -- Un consumo de cero no genera movimiento (quantity <> 0 en la tabla).
    IF v_normalized IS NULL OR v_normalized = 0 THEN
      CONTINUE;
    END IF;

    SELECT unit_id INTO v_base_unit
    FROM fullchinavzla.ingredients
    WHERE id = v_component.ingredient_id;

    INSERT INTO fullchinavzla.stock_movements (
      ingredient_id, quantity, unit_id, movement_type,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_component.ingredient_id,
      -v_normalized,
      v_base_unit,
      'consumption',
      'order_item',
      NEW.id,
      'Consumo por venta',
      v_creator
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_consume_recipe_stock_on_sale() IS
  'Descuenta los ingredientes de la receta al agregar un producto a una orden';

DROP TRIGGER IF EXISTS trg_order_items_consume_stock ON fullchinavzla.order_items;
CREATE TRIGGER trg_order_items_consume_stock
  AFTER INSERT ON fullchinavzla.order_items
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_consume_recipe_stock_on_sale();

-- --- Reversa del consumo al cancelar una orden -------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_reverse_recipe_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_consumption RECORD;
BEGIN
  -- Solo al transicionar HACIA cancelada (idempotente por la condicion).
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Por cada consumo de esta orden que aun no haya sido revertido, insertar un
  -- ajuste positivo que lo compense. La guarda NOT EXISTS evita doble reversa.
  FOR v_consumption IN
    SELECT sm.ingredient_id, sm.quantity, sm.unit_id, sm.reference_id, sm.created_by
    FROM fullchinavzla.stock_movements sm
    WHERE sm.movement_type = 'consumption'
      AND sm.reference_type = 'order_item'
      AND sm.reference_id IN (
        SELECT id FROM fullchinavzla.order_items WHERE order_id = NEW.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM fullchinavzla.stock_movements rev
        WHERE rev.movement_type = 'adjustment'
          AND rev.reference_type = 'order_item'
          AND rev.reference_id = sm.reference_id
          AND rev.ingredient_id = sm.ingredient_id
          AND rev.notes = 'Reversa por cancelacion'
      )
  LOOP
    INSERT INTO fullchinavzla.stock_movements (
      ingredient_id, quantity, unit_id, movement_type,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_consumption.ingredient_id,
      -v_consumption.quantity,          -- consumo es negativo; reversa positiva
      v_consumption.unit_id,
      'adjustment',
      'order_item',
      v_consumption.reference_id,
      'Reversa por cancelacion',
      v_consumption.created_by
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_reverse_recipe_stock_on_cancel() IS
  'Revierte el consumo de inventario cuando una orden pasa a cancelada';

DROP TRIGGER IF EXISTS trg_orders_reverse_stock_on_cancel ON fullchinavzla.orders;
CREATE TRIGGER trg_orders_reverse_stock_on_cancel
  AFTER UPDATE OF status ON fullchinavzla.orders
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_reverse_recipe_stock_on_cancel();

RESET ROLE;

COMMIT;

-- =============================================================================
-- ROLLBACK (si hiciera falta revertir esta migracion):
--   DROP TRIGGER IF EXISTS trg_order_items_consume_stock ON fullchinavzla.order_items;
--   DROP TRIGGER IF EXISTS trg_orders_reverse_stock_on_cancel ON fullchinavzla.orders;
--   DROP FUNCTION IF EXISTS fullchinavzla.fn_consume_recipe_stock_on_sale();
--   DROP FUNCTION IF EXISTS fullchinavzla.fn_reverse_recipe_stock_on_cancel();
-- Los movimientos de stock ya generados quedan (append-only); para deshacerlos
-- se insertan ajustes compensatorios, no se borran.
-- =============================================================================
