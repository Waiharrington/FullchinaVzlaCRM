-- =============================================================================
-- BEBIDAS COMO ÍTEM DE INVENTARIO (sin receta manual)
-- =============================================================================
-- Una bebida es un producto de reventa: no tiene "receta de cocina", pero al
-- venderla debe descontar 1 unidad de su propio stock. En este esquema el
-- descuento se dispara por recipe_components (producto -> ingrediente). Para que
-- el dueño NO tenga que crear recetas a mano, este trigger mantiene por detrás
-- un "ingrediente espejo" 1:1 para cada producto de categoría 'bebidas':
--   * crea el ingrediente + el recipe_component (1 und) si no existe;
--   * sincroniza el costo del producto (precio de reposición) hacia
--     ingredient_costs para la valoración de inventario.
-- Así el dueño maneja costo/venta en Menú y stock en Inventario; Recetas oculta
-- las bebidas. La venta sigue descontando por el motor de consumo ya existente.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

-- --- 1. Función de sincronización -------------------------------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_sync_beverage_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_und_unit      UUID;
  v_ingredient_id UUID;
  v_actor         UUID;
BEGIN
  -- Solo aplica a bebidas.
  IF NEW.category <> 'bebidas' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_und_unit FROM fullchinavzla.units WHERE symbol = 'und' LIMIT 1;

  -- Actor para ingredient_costs.updated_by (NOT NULL): usuario en sesión o, si
  -- corre sin sesión (migración/servidor), el owner activo como respaldo.
  v_actor := COALESCE(
    auth.uid(),
    (SELECT id FROM fullchinavzla.profiles WHERE role = 'owner' AND is_active ORDER BY created_at LIMIT 1)
  );

  -- ¿Ya tiene un ingrediente espejo (vía recipe_components)?
  SELECT rc.ingredient_id INTO v_ingredient_id
  FROM fullchinavzla.recipe_components rc
  WHERE rc.sellable_product_id = NEW.id
    AND rc.ingredient_id IS NOT NULL
  LIMIT 1;

  -- Si no existe, crear ingrediente espejo + recipe_component 1:1.
  IF v_ingredient_id IS NULL THEN
    INSERT INTO fullchinavzla.ingredients (name, unit_id, is_active)
    VALUES (NEW.name, v_und_unit, true)
    RETURNING id INTO v_ingredient_id;

    INSERT INTO fullchinavzla.recipe_components
      (sellable_product_id, ingredient_id, quantity, unit_id)
    VALUES (NEW.id, v_ingredient_id, 1, v_und_unit);
  END IF;

  -- Sincronizar costo: el costo del producto (reposición) es la fuente de verdad
  -- cuando está definido. Nunca sobrescribe con NULL.
  IF NEW.cost IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM fullchinavzla.ingredient_costs WHERE ingredient_id = v_ingredient_id) THEN
      UPDATE fullchinavzla.ingredient_costs
      SET price_per_unit = NEW.cost, last_updated = now(), updated_by = COALESCE(v_actor, updated_by)
      WHERE ingredient_id = v_ingredient_id;
    ELSE
      INSERT INTO fullchinavzla.ingredient_costs (ingredient_id, price_per_unit, updated_by)
      VALUES (v_ingredient_id, NEW.cost, v_actor);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_sync_beverage_inventory() IS
  'Mantiene el ingrediente espejo 1:1 y el costo de cada producto de categoría bebidas';

DROP TRIGGER IF EXISTS trg_sync_beverage_inventory ON fullchinavzla.sellable_products;
CREATE TRIGGER trg_sync_beverage_inventory
  AFTER INSERT OR UPDATE OF name, category, cost ON fullchinavzla.sellable_products
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_sync_beverage_inventory();

-- --- 2. Arreglar enlace roto: Refresco 2 Litros ------------------------------
-- Hoy apunta a "Vaso 107 10onzas" (un vaso de $0,03), no a su propia botella.
-- Se crea su ingrediente propio y se re-apunta el recipe_component.
DO $$
DECLARE
  v_und_unit   UUID;
  v_product_id UUID;
  v_new_ing    UUID;
BEGIN
  SELECT id INTO v_und_unit FROM fullchinavzla.units WHERE symbol = 'und' LIMIT 1;

  SELECT id INTO v_product_id
  FROM fullchinavzla.sellable_products
  WHERE category = 'bebidas' AND name = 'Refresco 2 Litros'
  LIMIT 1;

  IF v_product_id IS NOT NULL THEN
    -- ¿Ya existe un ingrediente propio con ese nombre? (idempotencia)
    SELECT id INTO v_new_ing
    FROM fullchinavzla.ingredients
    WHERE name = 'Refresco 2 Litros'
    LIMIT 1;

    IF v_new_ing IS NULL THEN
      INSERT INTO fullchinavzla.ingredients (name, unit_id, is_active)
      VALUES ('Refresco 2 Litros', v_und_unit, true)
      RETURNING id INTO v_new_ing;
    END IF;

    -- Re-apuntar SOLO si actualmente apunta al vaso compartido.
    UPDATE fullchinavzla.recipe_components rc
    SET ingredient_id = v_new_ing, unit_id = v_und_unit, quantity = 1
    WHERE rc.sellable_product_id = v_product_id
      AND rc.ingredient_id = (SELECT id FROM fullchinavzla.ingredients WHERE name = 'Vaso 107 10onzas' LIMIT 1);
  END IF;
END $$;

-- --- 3. Backfill: traer costos de inventario existentes al producto ----------
-- Para que el dueño vea/gestione el costo de reposición desde Menú. Solo cuando
-- el producto no tiene costo aún, y usando el ingrediente espejo real.
UPDATE fullchinavzla.sellable_products sp
SET cost = ic.price_per_unit
FROM fullchinavzla.recipe_components rc
JOIN fullchinavzla.ingredient_costs ic ON ic.ingredient_id = rc.ingredient_id
WHERE rc.sellable_product_id = sp.id
  AND sp.category = 'bebidas'
  AND sp.cost IS NULL;

-- --- 4. Asegurar espejo para toda bebida existente ---------------------------
-- Crea ingrediente espejo + recipe_component para cualquier bebida que no tenga
-- (no-op para las 5 actuales, que ya lo tienen). Sincroniza costo si está.
DO $$
DECLARE
  v_und_unit UUID;
  v_prod     RECORD;
  v_ing      UUID;
  v_actor    UUID;
BEGIN
  SELECT id INTO v_und_unit FROM fullchinavzla.units WHERE symbol = 'und' LIMIT 1;
  SELECT id INTO v_actor FROM fullchinavzla.profiles WHERE role = 'owner' AND is_active ORDER BY created_at LIMIT 1;

  FOR v_prod IN
    SELECT id, name, cost FROM fullchinavzla.sellable_products WHERE category = 'bebidas'
  LOOP
    SELECT rc.ingredient_id INTO v_ing
    FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = v_prod.id AND rc.ingredient_id IS NOT NULL
    LIMIT 1;

    IF v_ing IS NULL THEN
      INSERT INTO fullchinavzla.ingredients (name, unit_id, is_active)
      VALUES (v_prod.name, v_und_unit, true)
      RETURNING id INTO v_ing;

      INSERT INTO fullchinavzla.recipe_components
        (sellable_product_id, ingredient_id, quantity, unit_id)
      VALUES (v_prod.id, v_ing, 1, v_und_unit);
    END IF;

    IF v_prod.cost IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM fullchinavzla.ingredient_costs WHERE ingredient_id = v_ing) THEN
        UPDATE fullchinavzla.ingredient_costs
        SET price_per_unit = v_prod.cost, last_updated = now()
        WHERE ingredient_id = v_ing;
      ELSE
        INSERT INTO fullchinavzla.ingredient_costs (ingredient_id, price_per_unit, updated_by)
        VALUES (v_ing, v_prod.cost, v_actor);
      END IF;
    END IF;
  END LOOP;
END $$;

RESET ROLE;

COMMIT;
