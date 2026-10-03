-- Permite PIN de acceso de longitud variable (minimo 4 caracteres).
-- Los nuevos hashes usan SHA-256 antes de bcrypt para evitar el limite de 72
-- bytes de bcrypt. La verificacion acepta tambien los hashes bcrypt antiguos.

BEGIN;

SET LOCAL ROLE supabase_admin;

DO $$
DECLARE
  v_definition TEXT;
  v_updated TEXT;
BEGIN
  v_definition := pg_get_functiondef(
    'fullchinavzla.fn_verify_pin_login(text,text)'::regprocedure
  );
  v_updated := replace(v_definition, '^[0-9*#]{4}$', '^[0-9*#]{4,}$');
  v_updated := replace(
    v_updated,
    'extensions.crypt(p_pin, c.pin_hash) = c.pin_hash',
    '(extensions.crypt(p_pin, c.pin_hash) = c.pin_hash OR extensions.crypt(encode(extensions.digest(p_pin, ''sha256''), ''hex''), c.pin_hash) = c.pin_hash)'
  );
  IF v_updated = v_definition
     OR position('extensions.digest(p_pin' IN v_updated) = 0
     OR position('^[0-9*#]{4,}$' IN v_updated) = 0 THEN
    RAISE EXCEPTION 'No se pudo actualizar fn_verify_pin_login';
  END IF;
  EXECUTE v_updated;

  v_definition := pg_get_functiondef(
    'fullchinavzla.fn_set_user_pin(uuid,text)'::regprocedure
  );
  v_updated := replace(v_definition, '^[0-9*#]{4}$', '^[0-9*#]{4,}$');
  v_updated := replace(
    v_updated,
    'pin_must_have_four_digits',
    'pin_must_have_at_least_four_characters'
  );
  v_updated := replace(
    v_updated,
    'extensions.crypt(p_pin, pin_hash) = pin_hash',
    '(extensions.crypt(p_pin, pin_hash) = pin_hash OR extensions.crypt(encode(extensions.digest(p_pin, ''sha256''), ''hex''), pin_hash) = pin_hash)'
  );
  v_updated := replace(
    v_updated,
    'extensions.crypt(p_pin, extensions.gen_salt(''bf'', 10))',
    'extensions.crypt(encode(extensions.digest(p_pin, ''sha256''), ''hex''), extensions.gen_salt(''bf'', 10))'
  );
  IF v_updated = v_definition
     OR position('extensions.digest(p_pin' IN v_updated) = 0
     OR position('^[0-9*#]{4,}$' IN v_updated) = 0 THEN
    RAISE EXCEPTION 'No se pudo actualizar fn_set_user_pin';
  END IF;
  EXECUTE v_updated;

  v_definition := pg_get_functiondef(
    'fullchinavzla.fn_validate_my_pin(text)'::regprocedure
  );
  v_updated := replace(v_definition, '^[0-9*#]{4}$', '^[0-9*#]{4,}$');
  v_updated := replace(
    v_updated,
    'extensions.crypt(p_pin, pin_hash) = pin_hash',
    '(extensions.crypt(p_pin, pin_hash) = pin_hash OR extensions.crypt(encode(extensions.digest(p_pin, ''sha256''), ''hex''), pin_hash) = pin_hash)'
  );
  IF v_updated = v_definition
     OR position('extensions.digest(p_pin' IN v_updated) = 0
     OR position('^[0-9*#]{4,}$' IN v_updated) = 0 THEN
    RAISE EXCEPTION 'No se pudo actualizar fn_validate_my_pin';
  END IF;
  EXECUTE v_updated;
END;
$$;

COMMIT;
