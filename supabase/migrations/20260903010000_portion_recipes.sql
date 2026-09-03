-- Recetas de porciones reutilizables (ej. porcion de pollo = 125 g).
BEGIN;
SET LOCAL ROLE supabase_admin;

CREATE TABLE IF NOT EXISTS fullchinavzla.portion_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  ingredient_id UUID NOT NULL REFERENCES fullchinavzla.ingredients(id),
  portion_quantity NUMERIC(12,3) NOT NULL CHECK (portion_quantity > 0),
  portion_unit_id UUID NOT NULL REFERENCES fullchinavzla.units(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES fullchinavzla.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fullchinavzla.recipe_components
  ADD COLUMN IF NOT EXISTS portion_recipe_id UUID REFERENCES fullchinavzla.portion_recipes(id);

ALTER TABLE fullchinavzla.recipe_components DROP CONSTRAINT IF EXISTS check_component_type;
ALTER TABLE fullchinavzla.recipe_components ADD CONSTRAINT check_component_type CHECK (
  (ingredient_id IS NOT NULL AND preparation_batch_id IS NULL AND portion_recipe_id IS NULL) OR
  (ingredient_id IS NULL AND preparation_batch_id IS NOT NULL AND portion_recipe_id IS NULL) OR
  (ingredient_id IS NULL AND preparation_batch_id IS NULL AND portion_recipe_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_recipe_components_portion ON fullchinavzla.recipe_components(portion_recipe_id);
ALTER TABLE fullchinavzla.portion_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portion_recipes_select ON fullchinavzla.portion_recipes;
DROP POLICY IF EXISTS portion_recipes_write ON fullchinavzla.portion_recipes;
CREATE POLICY portion_recipes_select ON fullchinavzla.portion_recipes FOR SELECT USING (fullchinavzla.get_current_user_role() IN ('owner','manager','cashier'));
CREATE POLICY portion_recipes_write ON fullchinavzla.portion_recipes FOR ALL USING (fullchinavzla.get_current_user_role() IN ('owner','manager')) WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner','manager'));
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.portion_recipes TO authenticated;

RESET ROLE;
COMMIT;

-- Traduce componentes de porcion a consumo real de materia prima al vender.
BEGIN;
SET LOCAL ROLE supabase_admin;
CREATE OR REPLACE FUNCTION fullchinavzla.fn_consume_recipe_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_creator UUID; v_component RECORD; v_normalized NUMERIC; v_base_unit UUID;
BEGIN
  SELECT created_by INTO v_creator FROM fullchinavzla.orders WHERE id = NEW.order_id;
  FOR v_component IN
    SELECT rc.ingredient_id, rc.quantity * NEW.quantity AS quantity, rc.unit_id
      FROM fullchinavzla.recipe_components rc
     WHERE rc.sellable_product_id = NEW.sellable_product_id AND rc.ingredient_id IS NOT NULL
    UNION ALL
    SELECT pr.ingredient_id, pr.portion_quantity * rc.quantity * NEW.quantity, pr.portion_unit_id
      FROM fullchinavzla.recipe_components rc
      JOIN fullchinavzla.portion_recipes pr ON pr.id = rc.portion_recipe_id
     WHERE rc.sellable_product_id = NEW.sellable_product_id AND pr.is_active
  LOOP
    v_normalized := fullchinavzla.normalize_to_base_unit(v_component.ingredient_id, v_component.quantity, v_component.unit_id);
    IF v_normalized IS NULL OR v_normalized = 0 THEN CONTINUE; END IF;
    SELECT unit_id INTO v_base_unit FROM fullchinavzla.ingredients WHERE id = v_component.ingredient_id;
    INSERT INTO fullchinavzla.stock_movements (ingredient_id,quantity,unit_id,movement_type,reference_type,reference_id,notes,created_by)
    VALUES (v_component.ingredient_id,-v_normalized,v_base_unit,'consumption','order_item',NEW.id,'Consumo por venta',v_creator);
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_order_items_consume_stock ON fullchinavzla.order_items;
CREATE TRIGGER trg_order_items_consume_stock AFTER INSERT ON fullchinavzla.order_items FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_consume_recipe_stock_on_sale();
RESET ROLE;
COMMIT;
