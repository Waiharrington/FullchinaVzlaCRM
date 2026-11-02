BEGIN;
SET LOCAL search_path = fullchinavzla, pg_temp;

CREATE TABLE IF NOT EXISTS fullchinavzla.customer_favorites (
  customer_id UUID NOT NULL REFERENCES fullchinavzla.customer_accounts(customer_id) ON DELETE CASCADE,
  favorite_key TEXT NOT NULL CHECK (char_length(favorite_key) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, favorite_key)
);

ALTER TABLE fullchinavzla.customer_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE fullchinavzla.customer_favorites FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_customer_favorites()
RETURNS TEXT[] LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
  SELECT COALESCE(array_agg(f.favorite_key ORDER BY f.created_at, f.favorite_key), ARRAY[]::TEXT[])
  FROM fullchinavzla.customer_favorites f
  JOIN fullchinavzla.customer_accounts a ON a.customer_id = f.customer_id
  WHERE a.auth_user_id = auth.uid() AND a.status = 'active';
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_sync_customer_favorites(p_favorite_keys TEXT[])
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE
  v_customer_id UUID;
  v_keys TEXT[];
BEGIN
  SELECT customer_id INTO v_customer_id
  FROM fullchinavzla.customer_accounts
  WHERE auth_user_id = auth.uid() AND status = 'active';
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'La sesión no corresponde a una cuenta de cliente activa'; END IF;

  SELECT COALESCE(array_agg(normalized_key ORDER BY normalized_key), ARRAY[]::TEXT[])
  INTO v_keys
  FROM (
    SELECT DISTINCT btrim(input_key) AS normalized_key
    FROM unnest(COALESCE(p_favorite_keys, ARRAY[]::TEXT[])) AS input_keys(input_key)
    WHERE char_length(btrim(input_key)) BETWEEN 1 AND 200
  ) normalized_keys;
  IF cardinality(v_keys) > 200 THEN RAISE EXCEPTION 'La lista de favoritos supera el límite permitido'; END IF;

  INSERT INTO fullchinavzla.customer_favorites(customer_id, favorite_key)
  SELECT v_customer_id, input_key FROM unnest(v_keys) AS keys(input_key)
  ON CONFLICT (customer_id, favorite_key) DO NOTHING;

  DELETE FROM fullchinavzla.customer_favorites f
  WHERE f.customer_id = v_customer_id AND NOT (f.favorite_key = ANY(v_keys));

  RETURN v_keys;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_customer_favorites() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_sync_customer_favorites(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_customer_favorites() TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_sync_customer_favorites(TEXT[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
