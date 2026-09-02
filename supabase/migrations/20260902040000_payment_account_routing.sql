-- Enrutamiento real de cobros Full China:
-- - Punto de venta siempre liquida en Banesco.
-- - Pago movil acepta Banco Exterior (predeterminado) o Banesco.

BEGIN;
SET LOCAL ROLE supabase_admin;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_route_payment_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'fullchinavzla', 'pg_temp'
AS $function$
DECLARE
  v_account_name text;
BEGIN
  IF NEW.method = 'card' THEN
    SELECT id INTO NEW.account_id
    FROM fullchinavzla.financial_accounts
    WHERE name = 'Banesco' AND currency = 'VES' AND is_active
    LIMIT 1;
    IF NEW.account_id IS NULL THEN
      RAISE EXCEPTION 'La cuenta Banesco no esta activa o no existe';
    END IF;
  ELSIF NEW.method = 'mobile' THEN
    IF NEW.account_id IS NULL THEN
      SELECT id INTO NEW.account_id
      FROM fullchinavzla.financial_accounts
      WHERE name = 'Banco Exterior' AND currency = 'VES' AND is_active
      LIMIT 1;
    ELSE
      SELECT name INTO v_account_name
      FROM fullchinavzla.financial_accounts
      WHERE id = NEW.account_id AND currency = 'VES' AND is_active;
      IF v_account_name IS NULL OR v_account_name NOT IN ('Banco Exterior', 'Banesco') THEN
        RAISE EXCEPTION 'Pago movil solo puede ingresar en Banco Exterior o Banesco';
      END IF;
    END IF;
    IF NEW.account_id IS NULL THEN
      RAISE EXCEPTION 'La cuenta Banco Exterior no esta activa o no existe';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_route_payment_account ON fullchinavzla.payments;
CREATE TRIGGER trg_route_payment_account
BEFORE INSERT OR UPDATE OF method, account_id ON fullchinavzla.payments
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_route_payment_account();

COMMIT;
