BEGIN;
SET LOCAL search_path = fullchinavzla;

CREATE TABLE IF NOT EXISTS fullchinavzla.customer_accounts (
  customer_id UUID PRIMARY KEY REFERENCES fullchinavzla.customers(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  login_email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fullchinavzla.customer_account_identifiers (
  customer_id UUID NOT NULL REFERENCES fullchinavzla.customer_accounts(customer_id) ON DELETE CASCADE,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('identification','phone','email')),
  normalized_value TEXT NOT NULL,
  PRIMARY KEY (identifier_type, normalized_value),
  UNIQUE (customer_id, identifier_type)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.loyalty_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  visits_per_reward INTEGER NOT NULL DEFAULT 10 CHECK (visits_per_reward BETWEEN 1 AND 1000),
  reward_description TEXT NOT NULL DEFAULT 'Plato o ración gratis',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
INSERT INTO fullchinavzla.loyalty_settings(id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS fullchinavzla.customer_loyalty_visits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES fullchinavzla.customers(id),
  order_id UUID NOT NULL UNIQUE REFERENCES fullchinavzla.orders(id),
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_visits_customer_date
  ON fullchinavzla.customer_loyalty_visits(customer_id, visited_at DESC);

CREATE TABLE IF NOT EXISTS fullchinavzla.customer_account_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES fullchinavzla.customers(id),
  action TEXT NOT NULL CHECK (action IN ('password_reset','disabled')),
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fullchinavzla.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.customer_account_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.customer_loyalty_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.customer_account_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_register_customer_loyalty_account(
  p_auth_user_id UUID, p_login_email TEXT, p_first_name TEXT, p_last_name TEXT,
  p_identification TEXT, p_phone TEXT, p_email TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_customer_id UUID; v_name TEXT; v_doc TEXT; v_phone TEXT; v_email TEXT;
BEGIN
  v_name := btrim(concat_ws(' ', btrim(p_first_name), btrim(p_last_name)));
  v_doc := regexp_replace(COALESCE(p_identification,''), '[^0-9]', '', 'g');
  v_phone := regexp_replace(COALESCE(p_phone,''), '\D', '', 'g');
  v_email := lower(btrim(COALESCE(p_email,'')));
  IF v_name = '' OR v_doc = '' OR v_phone = '' OR length(v_phone) < 7 THEN RAISE EXCEPTION 'Completa nombre, cédula y teléfono válidos'; END IF;

  SELECT c.id INTO v_customer_id FROM fullchinavzla.customers c
  WHERE regexp_replace(COALESCE(c.identification,''), '[^0-9]', '', 'g') = v_doc
  ORDER BY c.created_at LIMIT 1 FOR UPDATE;
  IF v_customer_id IS NULL THEN
    INSERT INTO fullchinavzla.customers(first_name,last_name,full_name,identification,phone,email)
    VALUES (btrim(p_first_name),btrim(p_last_name),v_name,btrim(p_identification),btrim(p_phone),NULLIF(v_email,''))
    RETURNING id INTO v_customer_id;
  ELSE
    -- La tarjeta arranca al registrarse en la web; conserva los datos del cliente,
    -- pero reinicia los contadores de fidelización anteriores.
    UPDATE fullchinavzla.customers SET
      first_name=btrim(p_first_name),last_name=btrim(p_last_name),full_name=v_name,
      identification=btrim(p_identification),phone=btrim(p_phone),email=NULLIF(v_email,''),
      total_visits=0,rewards_unlocked=0,last_visit=NULL,updated_at=now()
    WHERE id=v_customer_id;
  END IF;
  INSERT INTO fullchinavzla.customer_accounts(customer_id,auth_user_id,login_email,status)
  VALUES(v_customer_id,p_auth_user_id,p_login_email,'active');
  INSERT INTO fullchinavzla.customer_account_identifiers(customer_id,identifier_type,normalized_value)
  VALUES(v_customer_id,'identification',v_doc), (v_customer_id,'phone',v_phone);
  IF v_email <> '' THEN INSERT INTO fullchinavzla.customer_account_identifiers VALUES(v_customer_id,'email',v_email); END IF;
  RETURN jsonb_build_object('customer_id',v_customer_id,'status','active');
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_customer_login_email(p_identifier TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
  SELECT a.login_email FROM fullchinavzla.customer_account_identifiers i
  JOIN fullchinavzla.customer_accounts a ON a.customer_id=i.customer_id
  WHERE i.normalized_value=CASE WHEN position('@' IN p_identifier)>0 THEN lower(btrim(p_identifier)) ELSE regexp_replace(COALESCE(p_identifier,''),'[^0-9]','','g') END
    AND a.status <> 'disabled' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_customer_loyalty_profile(p_page INTEGER DEFAULT 0,p_page_size INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'account_status',a.status,
    'customer',CASE WHEN a.status='active' THEN jsonb_build_object('first_name',c.first_name,'last_name',c.last_name,'full_name',c.full_name,'phone',c.phone) ELSE '{}'::jsonb END,
    'total_visits',CASE WHEN a.status='active' THEN c.total_visits ELSE 0 END,
    'rewards_unlocked',CASE WHEN a.status='active' THEN c.rewards_unlocked ELSE 0 END,
    'reward_description',(SELECT reward_description FROM fullchinavzla.loyalty_settings WHERE id=TRUE),
    'visits_per_reward',(SELECT visits_per_reward FROM fullchinavzla.loyalty_settings WHERE id=TRUE),
    'has_more',CASE WHEN a.status='active' THEN EXISTS(SELECT 1 FROM fullchinavzla.customer_loyalty_visits v WHERE v.customer_id=c.id OFFSET (greatest(p_page,0)+1)*greatest(1,least(p_page_size,5)) LIMIT 1) ELSE FALSE END,
    'visits',CASE WHEN a.status='active' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('order_id',v.order_id,'order_number',o.order_number,'visited_at',v.visited_at) ORDER BY v.visited_at DESC)
      FROM (SELECT * FROM fullchinavzla.customer_loyalty_visits WHERE customer_id=c.id ORDER BY visited_at DESC OFFSET greatest(p_page,0)*greatest(1,least(p_page_size,5)) LIMIT greatest(1,least(p_page_size,5))) v
      JOIN fullchinavzla.orders o ON o.id=v.order_id),'[]'::jsonb) ELSE '[]'::jsonb END
  ) INTO v_result
  FROM fullchinavzla.customer_accounts a JOIN fullchinavzla.customers c ON c.id=a.customer_id
  WHERE a.auth_user_id=auth.uid();
  IF v_result IS NULL THEN RAISE EXCEPTION 'La sesión no corresponde a una cuenta de cliente'; END IF;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_record_loyalty_visit_for_paid_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
DECLARE v_threshold INTEGER; v_customer_id UUID;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status <> 'paid' OR OLD.status='paid' OR NEW.customer_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM fullchinavzla.customer_accounts a WHERE a.customer_id=NEW.customer_id AND a.status='active') THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.order_items oi JOIN fullchinavzla.sellable_products sp ON sp.id=oi.sellable_product_id
    WHERE oi.order_id=NEW.id AND lower(COALESCE(sp.category,'')) NOT IN ('bebida','bebidas','drink','drinks','agua','aguas')
      AND lower(COALESCE(sp.name,'')) NOT LIKE '%agua%'
      AND lower(COALESCE(sp.name,'')) NOT LIKE '%refresco%'
  ) THEN RETURN NEW; END IF;
  v_customer_id := NEW.customer_id;
  INSERT INTO fullchinavzla.customer_loyalty_visits(customer_id,order_id) VALUES(v_customer_id,NEW.id) ON CONFLICT(order_id) DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT visits_per_reward INTO v_threshold FROM fullchinavzla.loyalty_settings WHERE id=TRUE;
  UPDATE fullchinavzla.customers SET total_visits=total_visits+1,
    rewards_unlocked=floor((total_visits+1)::numeric/greatest(1,v_threshold))::integer,
    last_visit=(now() AT TIME ZONE 'America/Caracas')::date,updated_at=now()
  WHERE id=v_customer_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_record_loyalty_visit_for_paid_order ON fullchinavzla.orders;
CREATE TRIGGER trg_record_loyalty_visit_for_paid_order AFTER UPDATE OF status ON fullchinavzla.orders
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_record_loyalty_visit_for_paid_order();

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_set_loyalty_settings(p_visits INTEGER,p_reward_description TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_visits NOT BETWEEN 1 AND 50 OR btrim(COALESCE(p_reward_description,''))='' THEN RAISE EXCEPTION 'Las visitas deben estar entre 1 y 50 y debes indicar el premio'; END IF;
  UPDATE fullchinavzla.loyalty_settings SET visits_per_reward=p_visits,reward_description=btrim(p_reward_description),updated_at=now(),updated_by=auth.uid() WHERE id=TRUE;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_get_loyalty_settings()
RETURNS TABLE(visits_per_reward INTEGER,reward_description TEXT)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=fullchinavzla,pg_temp AS $$
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN QUERY SELECT s.visits_per_reward,s.reward_description FROM fullchinavzla.loyalty_settings s WHERE s.id=TRUE;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_customer_accounts()
RETURNS TABLE(customer_id UUID,customer_name TEXT,identification TEXT,phone TEXT,email TEXT,status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN QUERY SELECT c.id,c.full_name,c.identification,c.phone,c.email,a.status FROM fullchinavzla.customer_accounts a JOIN fullchinavzla.customers c ON c.id=a.customer_id ORDER BY c.full_name;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_get_loyalty_customers()
RETURNS TABLE(
  id UUID,full_name TEXT,identification TEXT,phone TEXT,address TEXT,email TEXT,
  total_visits INTEGER,rewards_unlocked INTEGER,last_visit DATE,favorite_product TEXT,
  birth_date DATE,created_at TIMESTAMPTZ,is_active BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=fullchinavzla,pg_temp AS $$
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN QUERY SELECT c.id,c.full_name,c.identification,c.phone,c.address,c.email,
    CASE WHEN a.customer_id IS NULL THEN 0 ELSE c.total_visits END,
    CASE WHEN a.customer_id IS NULL THEN 0 ELSE c.rewards_unlocked END,
    CASE WHEN a.customer_id IS NULL THEN NULL ELSE c.last_visit END,
    c.favorite_product,c.birth_date,c.created_at,c.is_active
  FROM fullchinavzla.customers c
  LEFT JOIN fullchinavzla.customer_accounts a ON a.customer_id=c.id
  ORDER BY c.full_name;
END; $$;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_admin_record_customer_password_reset(p_customer_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=fullchinavzla,pg_temp AS $$
DECLARE v_user UUID;
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner','manager') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT auth_user_id INTO v_user FROM fullchinavzla.customer_accounts WHERE customer_id=p_customer_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Cuenta no encontrada'; END IF;
  INSERT INTO fullchinavzla.customer_account_audit(customer_id,action,performed_by) VALUES(p_customer_id,'password_reset',auth.uid());
  RETURN v_user;
END; $$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_register_customer_loyalty_account(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_customer_login_email(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_customer_loyalty_profile(INTEGER,INTEGER) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_set_loyalty_settings(INTEGER,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_get_loyalty_settings() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_customer_accounts() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_get_loyalty_customers() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION fullchinavzla.fn_admin_record_customer_password_reset(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION fullchinavzla.fn_register_customer_visit(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_register_customer_loyalty_account(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_customer_login_email(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_customer_loyalty_profile(INTEGER,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_set_loyalty_settings(INTEGER,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_get_loyalty_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_customer_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_loyalty_customers() TO authenticated;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_record_customer_password_reset(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_admin_record_customer_password_reset(UUID) TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON fullchinavzla.customer_accounts,fullchinavzla.customer_account_identifiers,fullchinavzla.customer_loyalty_visits,fullchinavzla.customer_account_audit,fullchinavzla.loyalty_settings TO service_role;
GRANT USAGE,SELECT ON SEQUENCE fullchinavzla.customer_loyalty_visits_id_seq,fullchinavzla.customer_account_audit_id_seq TO service_role;

COMMIT;
