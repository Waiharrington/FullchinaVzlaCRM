BEGIN;
SET LOCAL search_path = fullchinavzla;

-- El orden de esta lista define qué premio se entrega en cada tarjeta; al
-- agotarse, vuelve a empezar desde el primero.
ALTER TABLE fullchinavzla.loyalty_settings
  ADD COLUMN IF NOT EXISTS reward_sequence TEXT[] NOT NULL DEFAULT ARRAY['Plato o ración gratis']::TEXT[];
UPDATE fullchinavzla.loyalty_settings
SET reward_sequence = ARRAY[COALESCE(NULLIF(btrim(reward_description), ''), 'Premio de fidelización')]
WHERE reward_sequence IS NULL OR cardinality(reward_sequence) = 0 OR reward_sequence = ARRAY['Plato o ración gratis']::TEXT[];

-- El ciclo visible se mantiene completo mientras el premio siga pendiente.
-- Al canjearlo, vuelve a cero para que la siguiente visita inicie el ciclo nuevo.
ALTER TABLE fullchinavzla.customers
  ADD COLUMN IF NOT EXISTS loyalty_cycle_visits INTEGER NOT NULL DEFAULT 0;

-- Un registro por cada tarjeta completada. El premio queda congelado al
-- desbloquearse, aunque luego cambie la configuración del programa.
CREATE TABLE IF NOT EXISTS fullchinavzla.customer_loyalty_rewards (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES fullchinavzla.customers(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL CHECK (cycle_number > 0),
  reward_description TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id),
  CONSTRAINT customer_loyalty_rewards_customer_cycle_key UNIQUE (customer_id, cycle_number),
  CONSTRAINT customer_loyalty_rewards_redemption_pair CHECK ((redeemed_at IS NULL) = (redeemed_by IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_rewards_customer_status
  ON fullchinavzla.customer_loyalty_rewards(customer_id, redeemed_at, unlocked_at DESC);

ALTER TABLE fullchinavzla.customer_loyalty_rewards ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.customer_loyalty_rewards TO service_role;
GRANT USAGE, SELECT ON SEQUENCE fullchinavzla.customer_loyalty_rewards_id_seq TO service_role;

-- La versión anterior acumulaba recompensas como contador, sin distinguir
-- cuáles seguían pendientes. Conservamos las recompensas ya ganadas como
-- pendientes y registramos su descripción actual para no perder el saldo.
INSERT INTO fullchinavzla.customer_loyalty_rewards(customer_id, cycle_number, reward_description, unlocked_at)
SELECT c.id,
       cycles.cycle_number,
       COALESCE(NULLIF(btrim(settings.reward_sequence[((cycles.cycle_number - 1) % greatest(cardinality(settings.reward_sequence), 1)) + 1]), ''), settings.reward_description, 'Premio de fidelización'),
       COALESCE(cycle_visit.visited_at, c.updated_at, now())
FROM fullchinavzla.customers c
JOIN fullchinavzla.customer_accounts account ON account.customer_id = c.id AND account.status = 'active'
CROSS JOIN LATERAL generate_series(1, greatest(c.rewards_unlocked, 0)) AS cycles(cycle_number)
CROSS JOIN fullchinavzla.loyalty_settings settings
LEFT JOIN LATERAL (
  SELECT visits.visited_at
  FROM (
    SELECT v.visited_at, row_number() OVER (ORDER BY v.visited_at, v.id) AS visit_number
    FROM fullchinavzla.customer_loyalty_visits v
    WHERE v.customer_id = c.id
  ) visits
  WHERE visits.visit_number = cycles.cycle_number * settings.visits_per_reward
) cycle_visit ON TRUE
WHERE settings.id = TRUE
ON CONFLICT (customer_id, cycle_number) DO NOTHING;

UPDATE fullchinavzla.customers c
SET loyalty_cycle_visits = CASE
  WHEN EXISTS (SELECT 1 FROM fullchinavzla.customer_loyalty_rewards r WHERE r.customer_id = c.id AND r.redeemed_at IS NULL)
    THEN settings.visits_per_reward
  ELSE mod(greatest(c.total_visits, 0), settings.visits_per_reward)
END
FROM fullchinavzla.loyalty_settings settings
WHERE settings.id = TRUE;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_loyalty_visit_for_paid_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_threshold INTEGER;
  v_customer_id UUID;
  v_new_total_visits INTEGER;
  v_new_cycle_visits INTEGER;
  v_cycle_number INTEGER;
  v_reward_description TEXT;
  v_reward_sequence TEXT[];
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

  v_customer_id := NEW.customer_id;
  INSERT INTO fullchinavzla.customer_loyalty_visits(customer_id, order_id)
  VALUES (v_customer_id, NEW.id) ON CONFLICT (order_id) DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT visits_per_reward, reward_sequence
    INTO v_threshold, v_reward_sequence
  FROM fullchinavzla.loyalty_settings WHERE id = TRUE;
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
    v_reward_description := COALESCE(
      NULLIF(btrim(v_reward_sequence[((v_cycle_number - 1) % greatest(cardinality(v_reward_sequence), 1)) + 1]), ''),
      'Premio de fidelización'
    );
    INSERT INTO fullchinavzla.customer_loyalty_rewards(
      customer_id, cycle_number, reward_description
    ) VALUES (
      v_customer_id,
      v_cycle_number,
      COALESCE(NULLIF(btrim(v_reward_description), ''), 'Premio de fidelización')
    ) ON CONFLICT (customer_id, cycle_number) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_customer_loyalty_profile(p_page INTEGER DEFAULT 0, p_page_size INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'account_status', a.status,
    'customer', CASE WHEN a.status = 'active' THEN jsonb_build_object('first_name', c.first_name, 'last_name', c.last_name, 'full_name', c.full_name, 'phone', c.phone) ELSE '{}'::jsonb END,
    'total_visits', CASE WHEN a.status = 'active' THEN c.total_visits ELSE 0 END,
    'current_cycle_visits', CASE WHEN a.status = 'active' THEN c.loyalty_cycle_visits ELSE 0 END,
    'rewards_unlocked', CASE WHEN a.status = 'active' THEN c.rewards_unlocked ELSE 0 END,
    'reward_description', (SELECT reward_description FROM fullchinavzla.loyalty_settings WHERE id = TRUE),
    'next_reward_description', (
      SELECT COALESCE(s.reward_sequence[((COALESCE((SELECT max(r.cycle_number) FROM fullchinavzla.customer_loyalty_rewards r WHERE r.customer_id = c.id), 0) % greatest(cardinality(s.reward_sequence), 1)) + 1)], s.reward_description)
      FROM fullchinavzla.loyalty_settings s WHERE s.id = TRUE
    ),
    'visits_per_reward', (SELECT visits_per_reward FROM fullchinavzla.loyalty_settings WHERE id = TRUE),
    'available_rewards', CASE WHEN a.status = 'active' THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'cycle_number', r.cycle_number, 'reward_description', r.reward_description, 'unlocked_at', r.unlocked_at) ORDER BY r.unlocked_at, r.id)
      FROM fullchinavzla.customer_loyalty_rewards r WHERE r.customer_id = c.id AND r.redeemed_at IS NULL
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'redeemed_rewards', CASE WHEN a.status = 'active' THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'cycle_number', r.cycle_number, 'reward_description', r.reward_description, 'unlocked_at', r.unlocked_at, 'redeemed_at', r.redeemed_at) ORDER BY r.redeemed_at DESC, r.id DESC)
      FROM fullchinavzla.customer_loyalty_rewards r WHERE r.customer_id = c.id AND r.redeemed_at IS NOT NULL
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'has_more', CASE WHEN a.status = 'active' THEN EXISTS (
      SELECT 1 FROM fullchinavzla.customer_loyalty_visits v WHERE v.customer_id = c.id
      OFFSET (greatest(p_page, 0) + 1) * greatest(1, least(p_page_size, 5)) LIMIT 1
    ) ELSE FALSE END,
    'visits', CASE WHEN a.status = 'active' THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('order_id', v.order_id, 'order_number', o.order_number, 'visited_at', v.visited_at) ORDER BY v.visited_at DESC)
      FROM (
        SELECT * FROM fullchinavzla.customer_loyalty_visits WHERE customer_id = c.id
        ORDER BY visited_at DESC OFFSET greatest(p_page, 0) * greatest(1, least(p_page_size, 5)) LIMIT greatest(1, least(p_page_size, 5))
      ) v JOIN fullchinavzla.orders o ON o.id = v.order_id
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  ) INTO v_result
  FROM fullchinavzla.customer_accounts a
  JOIN fullchinavzla.customers c ON c.id = a.customer_id
  WHERE a.auth_user_id = auth.uid();
  IF v_result IS NULL THEN RAISE EXCEPTION 'La sesión no corresponde a una cuenta de cliente'; END IF;
  RETURN v_result;
END; $$;

-- El mismo campo administrativo acepta una lista, un premio por línea, y
-- mantiene el RPC existente para no romper clientes ya conectados.
CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_loyalty_settings(p_visits INTEGER, p_reward_description TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_rewards TEXT[];
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_visits NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Las visitas deben estar entre 1 y 50'; END IF;
  SELECT array_agg(btrim(value) ORDER BY ordinal) INTO v_rewards
  FROM unnest(string_to_array(replace(COALESCE(p_reward_description, ''), E'\r', ''), E'\n')) WITH ORDINALITY AS entries(value, ordinal)
  WHERE btrim(value) <> '';
  IF COALESCE(cardinality(v_rewards), 0) < 1 OR cardinality(v_rewards) > 20 THEN RAISE EXCEPTION 'Escribe entre 1 y 20 premios, uno por línea'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_rewards) reward WHERE length(reward) > 120) THEN RAISE EXCEPTION 'Cada premio puede tener hasta 120 caracteres'; END IF;
  UPDATE fullchinavzla.loyalty_settings
  SET visits_per_reward = p_visits, reward_description = v_rewards[1], reward_sequence = v_rewards,
      updated_at = now(), updated_by = auth.uid()
  WHERE id = TRUE;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_get_loyalty_settings()
RETURNS TABLE(visits_per_reward INTEGER, reward_description TEXT)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN QUERY SELECT s.visits_per_reward, array_to_string(s.reward_sequence, E'\n')
  FROM fullchinavzla.loyalty_settings s WHERE s.id = TRUE;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_get_customer_loyalty_rewards(p_customer_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.customers WHERE id = p_customer_id) THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
  RETURN jsonb_build_object(
    'available', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'cycle_number', r.cycle_number, 'reward_description', r.reward_description, 'unlocked_at', r.unlocked_at) ORDER BY r.unlocked_at, r.id) FROM fullchinavzla.customer_loyalty_rewards r WHERE r.customer_id = p_customer_id AND r.redeemed_at IS NULL), '[]'::jsonb),
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
      'unlocked_at', r.unlocked_at
    ) ORDER BY r.unlocked_at, c.full_name)
    FROM fullchinavzla.customer_loyalty_rewards r
    JOIN fullchinavzla.customers c ON c.id = r.customer_id
    JOIN fullchinavzla.customer_accounts account ON account.customer_id = c.id AND account.status = 'active'
    WHERE r.redeemed_at IS NULL
  ), '[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(p_reward_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_reward fullchinavzla.customer_loyalty_rewards%ROWTYPE;
BEGIN
  IF COALESCE(fullchinavzla.get_current_user_role(), '') NOT IN ('owner', 'manager', 'cashier') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_reward FROM fullchinavzla.customer_loyalty_rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Premio no encontrado'; END IF;
  IF v_reward.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'Este premio ya fue canjeado'; END IF;
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
  RETURN jsonb_build_object('id', v_reward.id, 'customer_id', v_reward.customer_id, 'cycle_number', v_reward.cycle_number, 'reward_description', v_reward.reward_description, 'unlocked_at', v_reward.unlocked_at, 'redeemed_at', v_reward.redeemed_at);
END; $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_customer_loyalty_profile(INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_get_customer_loyalty_rewards(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_list_pending_loyalty_rewards() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_customer_loyalty_profile(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_get_customer_loyalty_rewards(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_list_pending_loyalty_rewards() TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_redeem_customer_loyalty_reward(BIGINT) TO authenticated;

COMMIT;
