-- =============================================================================
-- FULL CHINA VZLA - MODIFICADORES EN LA COMANDA (Fase A: tabla + consumo)
-- =============================================================================
-- Registra qué opciones de modificador se eligieron por renglón de la orden, y
-- descuenta del inventario los ingredientes definidos en modifier_option_ingredients,
-- gemelo del trigger de recetas (20260816000000). Reference_type='order_item' para
-- que la reversa por cancelación existente (fn_reverse_recipe_stock_on_cancel) los
-- cubra sin cambios.
--
-- Fase ADITIVA: nadie inserta en order_item_modifiers hasta la Fase B (checkout),
-- así que esta migración no altera ninguna venta existente.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

-- --- Tabla: opciones elegidas por renglón -----------------------------------
CREATE TABLE IF NOT EXISTS fullchinavzla.order_item_modifiers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id      UUID NOT NULL REFERENCES fullchinavzla.order_items(id) ON DELETE CASCADE,
  modifier_option_id UUID NOT NULL REFERENCES fullchinavzla.modifier_options(id),
  quantity           NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fullchinavzla.order_item_modifiers IS
  'Opciones de modificador elegidas por renglón; precio sellado y driver de consumo';
CREATE INDEX IF NOT EXISTS idx_oim_order_item ON fullchinavzla.order_item_modifiers(order_item_id);
CREATE INDEX IF NOT EXISTS idx_oim_option ON fullchinavzla.order_item_modifiers(modifier_option_id);

ALTER TABLE fullchinavzla.order_item_modifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_item_modifiers_select ON fullchinavzla.order_item_modifiers;
CREATE POLICY order_item_modifiers_select ON fullchinavzla.order_item_modifiers
  FOR SELECT USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));

DROP POLICY IF EXISTS order_item_modifiers_insert ON fullchinavzla.order_item_modifiers;
CREATE POLICY order_item_modifiers_insert ON fullchinavzla.order_item_modifiers
  FOR INSERT WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));

GRANT SELECT, INSERT ON fullchinavzla.order_item_modifiers TO authenticated;

-- --- Consumo de ingredientes por modificador al vender ----------------------
CREATE OR REPLACE FUNCTION fullchinavzla.fn_consume_modifier_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_creator    UUID;
  v_order_type TEXT;
  v_item_qty   NUMERIC(12,3);
  v_ing        RECORD;
  v_normalized NUMERIC;
  v_base_unit  UUID;
BEGIN
  -- Cantidad del renglón, tipo de orden y autor (para escalar y atribuir).
  SELECT oi.quantity, o.order_type, o.created_by
    INTO v_item_qty, v_order_type, v_creator
  FROM fullchinavzla.order_items oi
  JOIN fullchinavzla.orders o ON o.id = oi.order_id
  WHERE oi.id = NEW.order_item_id;

  FOR v_ing IN
    SELECT moi.ingredient_id, moi.quantity, moi.unit_id
    FROM fullchinavzla.modifier_option_ingredients moi
    WHERE moi.modifier_option_id = NEW.modifier_option_id
      AND (moi.order_type_code IS NULL
           OR moi.order_type_code = ''
           OR moi.order_type_code = v_order_type)
  LOOP
    -- Consumo = qty del ingrediente en la opción * qty de la opción * qty del renglón.
    v_normalized := fullchinavzla.normalize_to_base_unit(
      v_ing.ingredient_id,
      v_ing.quantity * NEW.quantity * COALESCE(v_item_qty, 1),
      v_ing.unit_id
    );

    IF v_normalized IS NULL OR v_normalized = 0 THEN
      CONTINUE;
    END IF;

    SELECT unit_id INTO v_base_unit
    FROM fullchinavzla.ingredients
    WHERE id = v_ing.ingredient_id;

    INSERT INTO fullchinavzla.stock_movements (
      ingredient_id, quantity, unit_id, movement_type,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_ing.ingredient_id,
      -v_normalized,
      v_base_unit,
      'consumption',
      'order_item',
      NEW.order_item_id,
      'Consumo por modificador',
      v_creator
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fullchinavzla.fn_consume_modifier_stock_on_sale() IS
  'Descuenta los ingredientes de la opción de modificador elegida al vender';

DROP TRIGGER IF EXISTS trg_order_item_modifiers_consume_stock ON fullchinavzla.order_item_modifiers;
CREATE TRIGGER trg_order_item_modifiers_consume_stock
  AFTER INSERT ON fullchinavzla.order_item_modifiers
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_consume_modifier_stock_on_sale();

RESET ROLE;

COMMIT;

-- =============================================================================
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_order_item_modifiers_consume_stock ON fullchinavzla.order_item_modifiers;
--   DROP FUNCTION IF EXISTS fullchinavzla.fn_consume_modifier_stock_on_sale();
--   DROP TABLE IF EXISTS fullchinavzla.order_item_modifiers;  -- solo si no hay datos
-- =============================================================================
