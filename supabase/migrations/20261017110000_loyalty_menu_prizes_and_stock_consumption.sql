BEGIN;
SET LOCAL search_path = fullchinavzla;

-- Cada premio del ciclo apunta a un producto real del menú. La descripción se
-- conserva como snapshot para que renombrar el producto no cambie premios ya ganados.
CREATE TABLE IF NOT EXISTS fullchinavzla.loyalty_reward_sequence (
  position SMALLINT PRIMARY KEY CHECK (position BETWEEN 1 AND 20),
  sellable_product_id UUID NOT NULL REFERENCES fullchinavzla.sellable_products(id) ON DELETE RESTRICT
);
ALTER TABLE fullchinavzla.loyalty_reward_sequence ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.loyalty_reward_sequence TO service_role;

ALTER TABLE fullchinavzla.customer_loyalty_rewards
  ADD COLUMN IF NOT EXISTS sellable_product_id UUID REFERENCES fullchinavzla.sellable_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inventory_reference_id UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_loyalty_rewards_inventory_reference
  ON fullchinavzla.customer_loyalty_rewards(inventory_reference_id);

-- Para los premios anteriores, enlaza solo cuando el nombre guardado coincide
-- exactamente con un plato activo que tiene receta con ingredientes.
UPDATE fullchinavzla.customer_loyalty_rewards r
SET sellable_product_id = sp.id
FROM fullchinavzla.sellable_products sp
WHERE r.sellable_product_id IS NULL
  AND lower(btrim(r.reward_description)) = lower(btrim(sp.name))
  AND sp.is_active
  AND EXISTS (
    SELECT 1 FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = sp.id AND rc.ingredient_id IS NOT NULL
  );

-- Migra texto libre previo únicamente si coincide con nombres reales de menú.
INSERT INTO fullchinavzla.loyalty_reward_sequence(position, sellable_product_id)
SELECT choices.ordinality::SMALLINT, sp.id
FROM fullchinavzla.loyalty_settings settings
CROSS JOIN LATERAL unnest(settings.reward_sequence) WITH ORDINALITY AS choices(product_name, ordinality)
JOIN fullchinavzla.sellable_products sp ON lower(btrim(sp.name)) = lower(btrim(choices.product_name)) AND sp.is_active
WHERE settings.id = TRUE
  AND choices.ordinality BETWEEN 1 AND 20
  AND EXISTS (
    SELECT 1 FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = sp.id AND rc.ingredient_id IS NOT NULL
  )
ON CONFLICT (position) DO NOTHING;

-- El historial de inventario distingue premios de comandas y otros consumos.
ALTER TABLE fullchinavzla.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_reference_type_check;
ALTER TABLE fullchinavzla.stock_movements
  ADD CONSTRAINT stock_movements_reference_type_check
  CHECK (reference_type IN ('purchase_item', 'preparation_batch', 'order_item', 'manual', 'staff_meal', 'loyalty_reward'));

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_get_loyalty_menu_products()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', sp.id, 'name', sp.name, 'category', sp.category) ORDER BY sp.name)
    FROM fullchinavzla.sellable_products sp
    WHERE sp.is_active
      AND EXISTS (
        SELECT 1 FROM fullchinavzla.recipe_components rc
        WHERE rc.sellable_product_id = sp.id AND rc.ingredient_id IS NOT NULL
      )
  ), '[]'::JSONB);
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_get_loyalty_reward_config()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN jsonb_build_object(
    'visits_per_reward', (SELECT s.visits_per_reward FROM fullchinavzla.loyalty_settings s WHERE s.id = TRUE),
    'sequence', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('product_id', sp.id, 'name', sp.name, 'category', sp.category) ORDER BY sequence.position)
      FROM fullchinavzla.loyalty_reward_sequence sequence
      JOIN fullchinavzla.sellable_products sp ON sp.id = sequence.sellable_product_id
    ), '[]'::JSONB)
  );
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_loyalty_reward_config(p_visits INTEGER, p_sellable_product_ids UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_valid_count INTEGER;
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_visits NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Las visitas deben estar entre 1 y 50'; END IF;
  IF COALESCE(cardinality(p_sellable_product_ids), 0) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Selecciona entre 1 y 20 premios del menú'; END IF;

  SELECT count(*) INTO v_valid_count
  FROM unnest(p_sellable_product_ids) AS selected(product_id)
  JOIN fullchinavzla.sellable_products sp ON sp.id = selected.product_id AND sp.is_active
  WHERE EXISTS (
    SELECT 1 FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = sp.id AND rc.ingredient_id IS NOT NULL
  );
  IF v_valid_count <> cardinality(p_sellable_product_ids) THEN
    RAISE EXCEPTION 'Cada premio debe ser un plato activo del menú con receta de inventario';
  END IF;

  DELETE FROM fullchinavzla.loyalty_reward_sequence;
  INSERT INTO fullchinavzla.loyalty_reward_sequence(position, sellable_product_id)
  SELECT selected.ordinality::SMALLINT, selected.product_id
  FROM unnest(p_sellable_product_ids) WITH ORDINALITY AS selected(product_id, ordinality);

  UPDATE fullchinavzla.loyalty_settings
  SET visits_per_reward = p_visits,
      reward_description = (SELECT sp.name FROM fullchinavzla.loyalty_reward_sequence sequence JOIN fullchinavzla.sellable_products sp ON sp.id = sequence.sellable_product_id WHERE sequence.position = 1),
      reward_sequence = ARRAY(
        SELECT sp.name FROM fullchinavzla.loyalty_reward_sequence sequence
        JOIN fullchinavzla.sellable_products sp ON sp.id = sequence.sellable_product_id
        ORDER BY sequence.position
      ),
      updated_at = now(), updated_by = auth.uid()
  WHERE id = TRUE;
END; $$;

-- Compatibilidad: el antiguo RPC de texto libre ahora solo acepta nombres
-- exactos del menú y los convierte a la secuencia de productos.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_loyalty_settings(p_visits INTEGER, p_reward_description TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_ids UUID[]; v_names TEXT[];
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_visits NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Las visitas deben estar entre 1 y 50'; END IF;
  SELECT array_agg(btrim(value) ORDER BY ordinal) INTO v_names
  FROM unnest(string_to_array(replace(COALESCE(p_reward_description, ''), E'\r', ''), E'\n')) WITH ORDINALITY AS entries(value, ordinal)
  WHERE btrim(value) <> '';
  IF COALESCE(cardinality(v_names), 0) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Selecciona entre 1 y 20 premios del menú'; END IF;

  SELECT array_agg(sp.id ORDER BY names.ordinality) INTO v_ids
  FROM unnest(v_names) WITH ORDINALITY AS names(product_name, ordinality)
  JOIN fullchinavzla.sellable_products sp ON lower(btrim(sp.name)) = lower(btrim(names.product_name)) AND sp.is_active
  WHERE EXISTS (SELECT 1 FROM fullchinavzla.recipe_components rc WHERE rc.sellable_product_id = sp.id AND rc.ingredient_id IS NOT NULL);
  IF COALESCE(cardinality(v_ids), 0) <> cardinality(v_names) THEN
    RAISE EXCEPTION 'Usa nombres exactos de platos activos con receta; el programa ahora se configura desde el selector del menú';
  END IF;
  PERFORM fullchinavzla.fn_admin_set_loyalty_reward_config(p_visits, v_ids);
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_loyalty_visit_for_paid_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_threshold INTEGER;
  v_customer_id UUID;
  v_new_total_visits INTEGER;
  v_new_cycle_visits INTEGER;
  v_cycle_number INTEGER;
  v_reward_product_id UUID;
  v_reward_description TEXT;
  v_sequence_count INTEGER;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status <> 'paid' OR OLD.status = 'paid' OR NEW.customer_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.customer_accounts a WHERE a.customer_id = NEW.customer_id AND a.status = 'active') THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.order_items oi
    JOIN fullchinavzla.sellable_products sp ON sp.id = oi.sellable_product_id
    WHERE oi.order_id = NEW.id
      AND lower(COALESCE(sp.category, '')) NOT IN ('bebida', 'bebidas', 'drink', 'drinks', 'agua', 'aguas')
      AND lower(COALESCE(sp.name, '')) NOT LIKE '%agua%'
      AND lower(COALESCE(sp.name, '')) NOT LIKE '%refresco%'
  ) THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_sequence_count FROM fullchinavzla.loyalty_reward_sequence;
  -- No sumar visitas hasta que exista al menos un premio enlazado con menú y receta.
  IF v_sequence_count = 0 THEN RETURN NEW; END IF;

  v_customer_id := NEW.customer_id;
  INSERT INTO fullchinavzla.customer_loyalty_visits(customer_id, order_id)
  VALUES (v_customer_id, NEW.id) ON CONFLICT (order_id) DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT visits_per_reward INTO v_threshold FROM fullchinavzla.loyalty_settings WHERE id = TRUE;
  v_threshold := greatest(1, COALESCE(v_threshold, 10));
  UPDATE fullchinavzla.customers AS customer
  SET total_visits = customer.total_visits + 1,
      rewards_unlocked = floor((customer.total_visits + 1)::numeric / v_threshold)::integer,
      loyalty_cycle_visits = CASE WHEN EXISTS (
        SELECT 1 FROM fullchinavzla.customer_loyalty_rewards pending
        WHERE pending.customer_id = customer.id AND pending.redeemed_at IS NULL
      ) THEN customer.loyalty_cycle_visits ELSE least(customer.loyalty_cycle_visits + 1, v_threshold) END,
      last_visit = (now() AT TIME ZONE 'America/Caracas')::date,
      updated_at = now()
  WHERE customer.id = v_customer_id
  RETURNING customer.total_visits, customer.loyalty_cycle_visits INTO v_new_total_visits, v_new_cycle_visits;

  IF v_new_cycle_visits >= v_threshold AND NOT EXISTS (
    SELECT 1 FROM fullchinavzla.customer_loyalty_rewards pending
    WHERE pending.customer_id = v_customer_id AND pending.redeemed_at IS NULL
  ) THEN
    SELECT COALESCE(max(cycle_number), 0) + 1 INTO v_cycle_number
    FROM fullchinavzla.customer_loyalty_rewards WHERE customer_id = v_customer_id;
    SELECT sp.id, sp.name INTO v_reward_product_id, v_reward_description
    FROM fullchinavzla.loyalty_reward_sequence sequence
    JOIN fullchinavzla.sellable_products sp ON sp.id = sequence.sellable_product_id
    WHERE sequence.position = ((v_cycle_number - 1) % v_sequence_count) + 1;
    INSERT INTO fullchinavzla.customer_loyalty_rewards(
      customer_id, cycle_number, reward_description, sellable_product_id
    ) VALUES (
      v_customer_id, v_cycle_number, v_reward_description, v_reward_product_id
    ) ON CONFLICT (customer_id, cycle_number) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(p_reward_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_reward fullchinavzla.customer_loyalty_rewards%ROWTYPE;
  v_component RECORD;
  v_normalized NUMERIC;
  v_base_unit UUID;
  v_inserted INTEGER := 0;
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager', 'cashier') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_reward FROM fullchinavzla.customer_loyalty_rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Premio no encontrado'; END IF;
  IF v_reward.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'Este premio ya fue canjeado'; END IF;
  IF v_reward.sellable_product_id IS NULL THEN RAISE EXCEPTION 'Este premio no está vinculado a un plato del menú con receta'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = v_reward.sellable_product_id AND rc.ingredient_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'El plato del premio no tiene ingredientes de receta para descontar'; END IF;

  FOR v_component IN
    SELECT rc.ingredient_id, rc.quantity, rc.unit_id
    FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = v_reward.sellable_product_id
      AND rc.ingredient_id IS NOT NULL
  LOOP
    v_normalized := fullchinavzla.normalize_to_base_unit(
      v_component.ingredient_id, v_component.quantity, v_component.unit_id
    );
    IF v_normalized IS NULL OR v_normalized <= 0 THEN
      RAISE EXCEPTION 'No se pudo convertir un ingrediente de la receta del premio';
    END IF;
    SELECT unit_id INTO v_base_unit FROM fullchinavzla.ingredients WHERE id = v_component.ingredient_id;
    INSERT INTO fullchinavzla.stock_movements(
      ingredient_id, quantity, unit_id, movement_type, reference_type,
      reference_id, stock_location, notes, created_by
    ) VALUES (
      v_component.ingredient_id, -v_normalized, v_base_unit, 'consumption',
      'loyalty_reward', v_reward.inventory_reference_id, 'operational',
      'Premio de fidelización: ' || v_reward.reward_description || ' · tarjeta ' || v_reward.cycle_number,
      auth.uid()
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  UPDATE fullchinavzla.customer_loyalty_rewards
  SET redeemed_at = now(), redeemed_by = auth.uid()
  WHERE id = p_reward_id
  RETURNING * INTO v_reward;
  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.customer_loyalty_rewards pending
    WHERE pending.customer_id = v_reward.customer_id AND pending.redeemed_at IS NULL
  ) THEN
    UPDATE fullchinavzla.customers SET loyalty_cycle_visits = 0, updated_at = now()
    WHERE id = v_reward.customer_id;
  END IF;
  RETURN jsonb_build_object(
    'id', v_reward.id,
    'customer_id', v_reward.customer_id,
    'cycle_number', v_reward.cycle_number,
    'reward_description', v_reward.reward_description,
    'unlocked_at', v_reward.unlocked_at,
    'redeemed_at', v_reward.redeemed_at,
    'inventory_movements', v_inserted
  );
END; $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_get_loyalty_menu_products() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_get_loyalty_reward_config() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_set_loyalty_reward_config(INTEGER, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_get_loyalty_menu_products() TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_get_loyalty_reward_config() TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_loyalty_reward_config(INTEGER, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_loyalty_settings(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(BIGINT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
