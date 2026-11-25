BEGIN;
SET LOCAL search_path = fullchinavzla, auth, pg_temp;

-- Regla: el premio se gana cada vez que las visitas válidas llegan a un
-- múltiplo de visits_per_reward (10, 20, 30...), para siempre. Antes, mientras
-- había un premio pendiente sin canjear, las visitas nuevas no avanzaban la
-- tarjeta siguiente y se perdían. Ahora el progreso sale del total de visitas.

-- Visitas que debe mostrar la tarjeta actual: total % umbral, o la tarjeta
-- llena si el premio del múltiplo recién alcanzado sigue pendiente.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_loyalty_cycle_visits(p_customer_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT CASE
    WHEN c.total_visits > 0
     AND mod(c.total_visits, s.threshold) = 0
     AND EXISTS (
       SELECT 1 FROM fullchinavzla.customer_loyalty_rewards r
       WHERE r.customer_id = c.id AND r.redeemed_at IS NULL
     ) THEN s.threshold
    ELSE mod(greatest(c.total_visits, 0), s.threshold)
  END
  FROM fullchinavzla.customers c
  CROSS JOIN (
    SELECT greatest(1, COALESCE(
      (SELECT visits_per_reward FROM fullchinavzla.loyalty_settings WHERE id = TRUE), 10
    )) AS threshold
  ) s
  WHERE c.id = p_customer_id;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_loyalty_cycle_visits(UUID) FROM PUBLIC, anon, authenticated;

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
         (SELECT count(*) FROM fullchinavzla.loyalty_reward_sequence)
  INTO v_threshold, v_sequence_count
  FROM fullchinavzla.loyalty_settings settings
  WHERE settings.id = TRUE;
  v_threshold := greatest(1, COALESCE(v_threshold, 10));
  v_sequence_count := COALESCE(v_sequence_count, 0);

  UPDATE fullchinavzla.customers customer
  SET total_visits = customer.total_visits + 1,
      rewards_unlocked = floor((customer.total_visits + 1)::numeric / v_threshold)::integer,
      last_visit = (now() AT TIME ZONE 'America/Caracas')::date,
      updated_at = now()
  WHERE customer.id = v_customer_id
  RETURNING customer.total_visits INTO v_new_total_visits;

  -- Visita 10, 20, 30...: se desbloquea un premio (pueden acumularse si el
  -- cliente tarda en canjear).
  IF v_sequence_count > 0 AND mod(v_new_total_visits, v_threshold) = 0 THEN
    SELECT greatest(v_new_total_visits / v_threshold,
                    COALESCE(max(reward.cycle_number), 0) + 1)
    INTO v_cycle_number
    FROM fullchinavzla.customer_loyalty_rewards reward
    WHERE reward.customer_id = v_customer_id;
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

  UPDATE fullchinavzla.customers
  SET loyalty_cycle_visits = fullchinavzla.fn_loyalty_cycle_visits(v_customer_id)
  WHERE id = v_customer_id;
  RETURN NEW;
END;
$$;

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

  -- El progreso ya no se pone a cero: se recalcula desde el total de visitas
  -- para conservar las visitas hechas mientras el premio estaba pendiente.
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

REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(BIGINT) TO authenticated;

-- Reparar tarjetas ya existentes: el progreso visible pasa a salir del total.
UPDATE fullchinavzla.customers c
SET loyalty_cycle_visits = fullchinavzla.fn_loyalty_cycle_visits(c.id)
FROM fullchinavzla.customer_accounts a
WHERE a.customer_id = c.id AND a.status = 'active';

COMMIT;
