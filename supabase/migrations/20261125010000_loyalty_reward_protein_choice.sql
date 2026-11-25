BEGIN;
SET LOCAL search_path = fullchinavzla, auth, pg_temp;

-- Premio "con elección": el cliente gana una ración genérica (p. ej. "Ración de
-- lumpias") y quien la entrega en caja elige la proteína al canjear. La lista de
-- proteínas permitidas la define el administrador. Si la lista está vacía, el
-- programa sigue funcionando con la secuencia de platos fijos de siempre.

CREATE TABLE IF NOT EXISTS fullchinavzla.loyalty_reward_choices (
  sellable_product_id UUID PRIMARY KEY REFERENCES fullchinavzla.sellable_products(id) ON DELETE RESTRICT
);
ALTER TABLE fullchinavzla.loyalty_reward_choices ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.loyalty_reward_choices TO service_role;

ALTER TABLE fullchinavzla.loyalty_settings
  ADD COLUMN IF NOT EXISTS reward_choice_label TEXT;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_loyalty_reward_choices()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', sp.id, 'name', sp.name) ORDER BY sp.name), '[]'::jsonb)
  FROM fullchinavzla.loyalty_reward_choices c
  JOIN fullchinavzla.sellable_products sp ON sp.id = c.sellable_product_id;
$$;
REVOKE ALL ON FUNCTION fullchinavzla.fn_loyalty_reward_choices() FROM PUBLIC, anon, authenticated;

-- Configuración del premio con elección.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_loyalty_choice_reward(
  p_visits INTEGER, p_label TEXT, p_sellable_product_ids UUID[]
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_valid_count INTEGER; v_label TEXT := btrim(COALESCE(p_label, ''));
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_visits NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Las visitas deben estar entre 1 y 50'; END IF;
  IF length(v_label) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Escribe el nombre del premio (hasta 120 caracteres)'; END IF;
  IF COALESCE(cardinality(p_sellable_product_ids), 0) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Selecciona entre 1 y 20 opciones del menú'; END IF;

  SELECT count(DISTINCT selected.product_id) INTO v_valid_count
  FROM unnest(p_sellable_product_ids) AS selected(product_id)
  JOIN fullchinavzla.sellable_products sp ON sp.id = selected.product_id AND sp.is_active
  WHERE EXISTS (
    SELECT 1 FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = sp.id AND rc.ingredient_id IS NOT NULL
  );
  IF v_valid_count <> (SELECT count(DISTINCT x) FROM unnest(p_sellable_product_ids) x) THEN
    RAISE EXCEPTION 'Cada opción debe ser un plato activo del menú con receta de inventario';
  END IF;

  DELETE FROM fullchinavzla.loyalty_reward_choices;
  INSERT INTO fullchinavzla.loyalty_reward_choices(sellable_product_id)
  SELECT DISTINCT x FROM unnest(p_sellable_product_ids) x;
  DELETE FROM fullchinavzla.loyalty_reward_sequence;

  UPDATE fullchinavzla.loyalty_settings
  SET visits_per_reward = p_visits,
      reward_choice_label = v_label,
      reward_description = v_label,
      reward_sequence = ARRAY[v_label],
      updated_at = now(), updated_by = auth.uid()
  WHERE id = TRUE;
END; $$;

-- La configuración de platos fijos desactiva el modo con elección.
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

  DELETE FROM fullchinavzla.loyalty_reward_choices;
  DELETE FROM fullchinavzla.loyalty_reward_sequence;
  INSERT INTO fullchinavzla.loyalty_reward_sequence(position, sellable_product_id)
  SELECT selected.ordinality::SMALLINT, selected.product_id
  FROM unnest(p_sellable_product_ids) WITH ORDINALITY AS selected(product_id, ordinality);

  UPDATE fullchinavzla.loyalty_settings
  SET visits_per_reward = p_visits,
      reward_choice_label = NULL,
      reward_description = (SELECT sp.name FROM fullchinavzla.loyalty_reward_sequence sequence JOIN fullchinavzla.sellable_products sp ON sp.id = sequence.sellable_product_id WHERE sequence.position = 1),
      reward_sequence = ARRAY(
        SELECT sp.name FROM fullchinavzla.loyalty_reward_sequence sequence
        JOIN fullchinavzla.sellable_products sp ON sp.id = sequence.sellable_product_id
        ORDER BY sequence.position
      ),
      updated_at = now(), updated_by = auth.uid()
  WHERE id = TRUE;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_get_loyalty_reward_config()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN jsonb_build_object(
    'visits_per_reward', (SELECT s.visits_per_reward FROM fullchinavzla.loyalty_settings s WHERE s.id = TRUE),
    'mode', CASE WHEN EXISTS (SELECT 1 FROM fullchinavzla.loyalty_reward_choices) THEN 'choice' ELSE 'fixed' END,
    'choice_label', (SELECT s.reward_choice_label FROM fullchinavzla.loyalty_settings s WHERE s.id = TRUE),
    'choices', fullchinavzla.fn_loyalty_reward_choices(),
    'sequence', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('product_id', sp.id, 'name', sp.name, 'category', sp.category) ORDER BY sequence.position)
      FROM fullchinavzla.loyalty_reward_sequence sequence
      JOIN fullchinavzla.sellable_products sp ON sp.id = sequence.sellable_product_id
    ), '[]'::JSONB)
  );
END; $$;

-- Visita 10, 20, 30...: desbloquea el premio (fijo o con elección).
CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_loyalty_visit_for_paid_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_threshold INTEGER;
  v_customer_id UUID;
  v_new_total_visits INTEGER;
  v_cycle_number INTEGER;
  v_reward_product_id UUID;
  v_reward_description TEXT;
  v_sequence_count INTEGER;
  v_choice_count INTEGER;
  v_choice_label TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status <> 'paid' OR OLD.status = 'paid' OR NEW.customer_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.customer_accounts account
    WHERE account.customer_id = NEW.customer_id
      AND account.status = 'active'
      AND NEW.created_at >= account.created_at
  ) THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM fullchinavzla.order_items item
    JOIN fullchinavzla.sellable_products product ON product.id = item.sellable_product_id
    WHERE item.order_id = NEW.id
      AND lower(COALESCE(product.category, '')) NOT IN ('bebida', 'bebidas', 'drink', 'drinks', 'agua', 'aguas')
      AND lower(COALESCE(product.name, '')) NOT LIKE '%agua%'
      AND lower(COALESCE(product.name, '')) NOT LIKE '%refresco%'
  ) THEN RETURN NEW; END IF;

  v_customer_id := NEW.customer_id;
  INSERT INTO fullchinavzla.customer_loyalty_visits(customer_id, order_id)
  VALUES (v_customer_id, NEW.id)
  ON CONFLICT (order_id) DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT greatest(1, COALESCE(settings.visits_per_reward, 10)),
         (SELECT count(*) FROM fullchinavzla.loyalty_reward_sequence),
         (SELECT count(*) FROM fullchinavzla.loyalty_reward_choices),
         NULLIF(btrim(settings.reward_choice_label), '')
  INTO v_threshold, v_sequence_count, v_choice_count, v_choice_label
  FROM fullchinavzla.loyalty_settings settings
  WHERE settings.id = TRUE;
  v_threshold := greatest(1, COALESCE(v_threshold, 10));
  v_sequence_count := COALESCE(v_sequence_count, 0);
  v_choice_count := COALESCE(v_choice_count, 0);

  UPDATE fullchinavzla.customers customer
  SET total_visits = customer.total_visits + 1,
      rewards_unlocked = floor((customer.total_visits + 1)::numeric / v_threshold)::integer,
      last_visit = (now() AT TIME ZONE 'America/Caracas')::date,
      updated_at = now()
  WHERE customer.id = v_customer_id
  RETURNING customer.total_visits INTO v_new_total_visits;

  IF (v_sequence_count > 0 OR v_choice_count > 0) AND mod(v_new_total_visits, v_threshold) = 0 THEN
    SELECT greatest(v_new_total_visits / v_threshold,
                    COALESCE(max(reward.cycle_number), 0) + 1)
    INTO v_cycle_number
    FROM fullchinavzla.customer_loyalty_rewards reward
    WHERE reward.customer_id = v_customer_id;

    IF v_choice_count > 0 THEN
      INSERT INTO fullchinavzla.customer_loyalty_rewards(customer_id, cycle_number, reward_description)
      VALUES (v_customer_id, v_cycle_number, COALESCE(v_choice_label, 'Premio de fidelización'))
      ON CONFLICT (customer_id, cycle_number) DO NOTHING;
    ELSE
      SELECT product.id, product.name
      INTO v_reward_product_id, v_reward_description
      FROM fullchinavzla.loyalty_reward_sequence sequence
      JOIN fullchinavzla.sellable_products product ON product.id = sequence.sellable_product_id
      WHERE sequence.position = ((v_cycle_number - 1) % v_sequence_count) + 1;
      IF v_reward_product_id IS NOT NULL THEN
        INSERT INTO fullchinavzla.customer_loyalty_rewards(customer_id, cycle_number, sellable_product_id, reward_description)
        VALUES (v_customer_id, v_cycle_number, v_reward_product_id, v_reward_description)
        ON CONFLICT (customer_id, cycle_number) DO NOTHING;
      END IF;
    END IF;
  END IF;

  UPDATE fullchinavzla.customers
  SET loyalty_cycle_visits = fullchinavzla.fn_loyalty_cycle_visits(v_customer_id)
  WHERE id = v_customer_id;
  RETURN NEW;
END;
$$;

-- Canje: si el premio es "con elección", hay que indicar la proteína entregada.
DROP FUNCTION IF EXISTS fullchinavzla.fn_admin_redeem_customer_loyalty_reward(BIGINT);
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(
  p_reward_id BIGINT, p_choice_product_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_reward fullchinavzla.customer_loyalty_rewards%ROWTYPE;
  v_component RECORD;
  v_normalized NUMERIC;
  v_base_unit UUID;
  v_inserted INTEGER := 0;
  v_product_id UUID;
  v_description TEXT;
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager', 'cashier') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_reward FROM fullchinavzla.customer_loyalty_rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Premio no encontrado'; END IF;
  IF v_reward.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'Este premio ya fue canjeado'; END IF;

  v_product_id := v_reward.sellable_product_id;
  v_description := v_reward.reward_description;
  IF v_product_id IS NULL THEN
    IF p_choice_product_id IS NULL THEN RAISE EXCEPTION 'Elige la proteína que se entrega con este premio'; END IF;
    IF NOT EXISTS (SELECT 1 FROM fullchinavzla.loyalty_reward_choices c WHERE c.sellable_product_id = p_choice_product_id) THEN
      RAISE EXCEPTION 'Esa opción no está permitida para este premio';
    END IF;
    v_product_id := p_choice_product_id;
    v_description := v_reward.reward_description || ' — ' ||
      (SELECT regexp_replace(sp.name, '^.*—\s*', '') FROM fullchinavzla.sellable_products sp WHERE sp.id = v_product_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = v_product_id AND rc.ingredient_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'El plato del premio no tiene ingredientes de receta para descontar'; END IF;

  FOR v_component IN
    SELECT rc.ingredient_id, rc.quantity, rc.unit_id
    FROM fullchinavzla.recipe_components rc
    WHERE rc.sellable_product_id = v_product_id
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
      'Premio de fidelización: ' || v_description || ' · tarjeta ' || v_reward.cycle_number,
      auth.uid()
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  UPDATE fullchinavzla.customer_loyalty_rewards
  SET redeemed_at = now(), redeemed_by = auth.uid(),
      sellable_product_id = v_product_id, reward_description = v_description
  WHERE id = p_reward_id
  RETURNING * INTO v_reward;

  UPDATE fullchinavzla.customers
  SET loyalty_cycle_visits = fullchinavzla.fn_loyalty_cycle_visits(v_reward.customer_id),
      updated_at = now()
  WHERE id = v_reward.customer_id;
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

-- Listados de caja: premios sin plato fijo traen las proteínas a elegir.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_get_customer_loyalty_rewards(p_customer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.customers WHERE id = p_customer_id) THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
  RETURN jsonb_build_object(
    'available', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'cycle_number', r.cycle_number, 'reward_description', r.reward_description, 'unlocked_at', r.unlocked_at, 'choices', CASE WHEN r.sellable_product_id IS NULL THEN fullchinavzla.fn_loyalty_reward_choices() ELSE NULL END) ORDER BY r.unlocked_at, r.id) FROM fullchinavzla.customer_loyalty_rewards r WHERE r.customer_id = p_customer_id AND r.redeemed_at IS NULL), '[]'::jsonb),
    'redeemed', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'cycle_number', r.cycle_number, 'reward_description', r.reward_description, 'unlocked_at', r.unlocked_at, 'redeemed_at', r.redeemed_at) ORDER BY r.redeemed_at DESC, r.id DESC) FROM fullchinavzla.customer_loyalty_rewards r WHERE r.customer_id = p_customer_id AND r.redeemed_at IS NOT NULL), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_list_pending_loyalty_rewards()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id,
      'customer_id', c.id,
      'customer_name', c.full_name,
      'phone', c.phone,
      'cycle_number', r.cycle_number,
      'reward_description', r.reward_description,
      'unlocked_at', r.unlocked_at,
      'choices', CASE WHEN r.sellable_product_id IS NULL THEN fullchinavzla.fn_loyalty_reward_choices() ELSE NULL END
    ) ORDER BY r.unlocked_at, c.full_name)
    FROM fullchinavzla.customer_loyalty_rewards r
    JOIN fullchinavzla.customers c ON c.id = r.customer_id
    JOIN fullchinavzla.customer_accounts account ON account.customer_id = c.id AND account.status = 'active'
    WHERE r.redeemed_at IS NULL
  ), '[]'::jsonb);
END; $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_set_loyalty_choice_reward(INTEGER, TEXT, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_loyalty_choice_reward(INTEGER, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(BIGINT, UUID) TO authenticated;

-- Configuración inicial: ración de lumpias, con la proteína a elección.
DO $$
DECLARE v_ids UUID[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.loyalty_reward_sequence)
     AND NOT EXISTS (SELECT 1 FROM fullchinavzla.loyalty_reward_choices) THEN
    SELECT array_agg(sp.id ORDER BY sp.name) INTO v_ids
    FROM fullchinavzla.sellable_products sp
    WHERE sp.is_active
      AND sp.name IN ('Lumpias — Especial Camarón', 'Lumpias — Especial Carne', 'Lumpias — Especial Cerdo', 'Lumpias — Especial Pollo')
      AND EXISTS (SELECT 1 FROM fullchinavzla.recipe_components rc WHERE rc.sellable_product_id = sp.id AND rc.ingredient_id IS NOT NULL);
    IF COALESCE(cardinality(v_ids), 0) > 0 THEN
      INSERT INTO fullchinavzla.loyalty_reward_choices(sellable_product_id)
      SELECT unnest(v_ids);
      UPDATE fullchinavzla.loyalty_settings
      SET reward_choice_label = 'Ración de lumpias',
          reward_description = 'Ración de lumpias',
          reward_sequence = ARRAY['Ración de lumpias'],
          updated_at = now()
      WHERE id = TRUE;
    END IF;
  END IF;
END $$;

COMMIT;
