BEGIN;

ALTER TABLE fullchinavzla.preparation_batches
  ADD COLUMN IF NOT EXISTS source_stock_location TEXT NOT NULL DEFAULT 'warehouse',
  ADD COLUMN IF NOT EXISTS output_ingredient_id UUID REFERENCES fullchinavzla.ingredients(id);

ALTER TABLE fullchinavzla.preparation_batches
  DROP CONSTRAINT IF EXISTS preparation_batches_source_stock_location_check;
ALTER TABLE fullchinavzla.preparation_batches
  ADD CONSTRAINT preparation_batches_source_stock_location_check
  CHECK (source_stock_location IN ('warehouse', 'operational'));

-- Preserve the selected origin on existing records and the two batches reported
-- by the owner. Their original consumption movements are corrected below using
-- append-only adjustments.
UPDATE fullchinavzla.preparation_batches
   SET source_stock_location = CASE
     WHEN notes ILIKE '%Origen: Food Truck%' THEN 'operational'
     WHEN notes ILIKE '%Origen: Almacén%' THEN 'warehouse'
     ELSE source_stock_location
   END
 WHERE notes ILIKE '%Origen: Food Truck%' OR notes ILIKE '%Origen: Almacén%';

UPDATE fullchinavzla.preparation_batches pb
   SET output_ingredient_id = i.id
  FROM fullchinavzla.ingredients i
 WHERE (pb.id = 'a7dedc11-cb56-4c5a-828a-8ef9a80f6e29' AND i.name = 'Pollo')
    OR (pb.id = '94baaa35-d23e-4348-a37b-23f2af7724cc' AND i.name = 'Chuleta');

-- Move the two erroneous warehouse deductions to the Food Truck. These ledger
-- corrections keep the original append-only stock movements intact.
INSERT INTO fullchinavzla.stock_movements (
  ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id,
  stock_location, notes, created_by
)
SELECT sm.ingredient_id, -sm.quantity, sm.unit_id, 'adjustment', 'preparation_batch',
       sm.reference_id, 'warehouse', 'Corrección de origen de porcionamiento: devolver al almacén', pb.created_by
  FROM fullchinavzla.stock_movements sm
  JOIN fullchinavzla.preparation_batches pb ON pb.id = sm.reference_id
 WHERE sm.reference_type = 'preparation_batch'
   AND sm.movement_type = 'consumption'
   AND sm.stock_location = 'warehouse'
   AND pb.id IN ('a7dedc11-cb56-4c5a-828a-8ef9a80f6e29', '94baaa35-d23e-4348-a37b-23f2af7724cc')
   AND NOT EXISTS (
     SELECT 1 FROM fullchinavzla.stock_movements rev
      WHERE rev.reference_type = 'preparation_batch' AND rev.reference_id = pb.id
        AND rev.stock_location = 'warehouse'
        AND rev.notes = 'Corrección de origen de porcionamiento: devolver al almacén'
   );

INSERT INTO fullchinavzla.stock_movements (
  ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id,
  stock_location, notes, created_by
)
SELECT sm.ingredient_id, sm.quantity, sm.unit_id, 'adjustment', 'preparation_batch',
       sm.reference_id, 'operational', 'Corrección de origen de porcionamiento: descontar Food Truck', pb.created_by
  FROM fullchinavzla.stock_movements sm
  JOIN fullchinavzla.preparation_batches pb ON pb.id = sm.reference_id
 WHERE sm.reference_type = 'preparation_batch'
   AND sm.movement_type = 'consumption'
   AND sm.stock_location = 'warehouse'
   AND pb.id IN ('a7dedc11-cb56-4c5a-828a-8ef9a80f6e29', '94baaa35-d23e-4348-a37b-23f2af7724cc')
   AND NOT EXISTS (
     SELECT 1 FROM fullchinavzla.stock_movements rev
      WHERE rev.reference_type = 'preparation_batch' AND rev.reference_id = pb.id
        AND rev.stock_location = 'operational'
        AND rev.notes = 'Corrección de origen de porcionamiento: descontar Food Truck'
   );

-- Add the chicken and pork portions from the two reported historical batches.
INSERT INTO fullchinavzla.stock_movements (
  ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id,
  stock_location, notes, created_by
)
SELECT pb.output_ingredient_id,
       pb.quantity_produced,
       i.unit_id, 'production_output', 'preparation_batch', pb.id, 'operational',
       'Porciones producidas (corrección de lote histórico)', pb.created_by
  FROM fullchinavzla.preparation_batches pb
  JOIN fullchinavzla.ingredients i ON i.id = pb.output_ingredient_id
 WHERE pb.id IN ('a7dedc11-cb56-4c5a-828a-8ef9a80f6e29', '94baaa35-d23e-4348-a37b-23f2af7724cc')
   AND pb.output_ingredient_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM fullchinavzla.stock_movements sm
      WHERE sm.reference_type = 'preparation_batch' AND sm.reference_id = pb.id
        AND sm.movement_type = 'production_output'
   );

CREATE OR REPLACE FUNCTION fullchinavzla.fn_batch_items_cost_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_creator UUID;
  v_qty NUMERIC;
  v_base UUID;
  v_batch_id UUID;
  v_source TEXT;
  v_output_ingredient UUID;
  v_output_unit UUID;
  v_output_qty NUMERIC;
  v_quantity_produced NUMERIC;
  v_unit_produced UUID;
BEGIN
  v_batch_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.preparation_batch_id ELSE OLD.preparation_batch_id END;

  IF TG_OP = 'INSERT' THEN
    PERFORM fullchinavzla.update_batch_cost(NEW.preparation_batch_id);
    SELECT created_by, source_stock_location, output_ingredient_id,
           quantity_produced, unit_produced_id
      INTO v_creator, v_source, v_output_ingredient, v_quantity_produced, v_unit_produced
      FROM fullchinavzla.preparation_batches WHERE id = NEW.preparation_batch_id;

    v_qty := fullchinavzla.normalize_to_base_unit(NEW.ingredient_id, NEW.quantity_used, NEW.unit_id);
    SELECT unit_id INTO v_base FROM fullchinavzla.ingredients WHERE id = NEW.ingredient_id;
    INSERT INTO fullchinavzla.stock_movements (
      ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id,
      stock_location, notes, created_by
    ) VALUES (
      NEW.ingredient_id, -v_qty, v_base, 'consumption', 'preparation_batch',
      NEW.preparation_batch_id, v_source, 'Consumo de materia prima por porcionamiento', v_creator
    );

    IF v_output_ingredient IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM fullchinavzla.stock_movements
       WHERE reference_type = 'preparation_batch' AND reference_id = NEW.preparation_batch_id
         AND movement_type = 'production_output'
    ) THEN
      SELECT unit_id INTO v_output_unit FROM fullchinavzla.ingredients WHERE id = v_output_ingredient;
      v_output_qty := v_quantity_produced;
      INSERT INTO fullchinavzla.stock_movements (
        ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id,
        stock_location, notes, created_by
      ) VALUES (
        v_output_ingredient, v_output_qty, v_output_unit, 'production_output',
        'preparation_batch', NEW.preparation_batch_id, 'operational',
        'Porciones producidas por lote', v_creator
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fullchinavzla.update_batch_cost(OLD.preparation_batch_id);
    SELECT created_by, source_stock_location, output_ingredient_id,
           quantity_produced, unit_produced_id
      INTO v_creator, v_source, v_output_ingredient, v_quantity_produced, v_unit_produced
      FROM fullchinavzla.preparation_batches WHERE id = OLD.preparation_batch_id;

    v_qty := fullchinavzla.normalize_to_base_unit(OLD.ingredient_id, OLD.quantity_used, OLD.unit_id);
    SELECT unit_id INTO v_base FROM fullchinavzla.ingredients WHERE id = OLD.ingredient_id;
    INSERT INTO fullchinavzla.stock_movements (
      ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id,
      stock_location, notes, created_by
    ) VALUES (
      OLD.ingredient_id, v_qty, v_base, 'adjustment', 'preparation_batch',
      OLD.preparation_batch_id, v_source, 'Reversa de consumo de materia prima por porcionamiento', v_creator
    );

    IF v_output_ingredient IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM fullchinavzla.preparation_batch_items
          WHERE preparation_batch_id = OLD.preparation_batch_id
       )
       AND EXISTS (
         SELECT 1 FROM fullchinavzla.stock_movements
          WHERE reference_type = 'preparation_batch' AND reference_id = OLD.preparation_batch_id
            AND movement_type = 'production_output'
       )
       AND NOT EXISTS (
         SELECT 1 FROM fullchinavzla.stock_movements
          WHERE reference_type = 'preparation_batch' AND reference_id = OLD.preparation_batch_id
            AND movement_type = 'adjustment'
            AND notes = 'Reversa de salida de porcionamiento'
       ) THEN
      SELECT unit_id INTO v_output_unit FROM fullchinavzla.ingredients WHERE id = v_output_ingredient;
      v_output_qty := v_quantity_produced;
      INSERT INTO fullchinavzla.stock_movements (
        ingredient_id, quantity, unit_id, movement_type, reference_type, reference_id,
        stock_location, notes, created_by
      ) VALUES (
        v_output_ingredient, -v_output_qty, v_output_unit, 'adjustment',
        'preparation_batch', OLD.preparation_batch_id, 'operational',
        'Reversa de salida de porcionamiento', v_creator
      );
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
