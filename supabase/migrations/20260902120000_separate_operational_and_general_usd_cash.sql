-- Separa el efectivo USD recibido en la caja del foodtruck del efectivo USD
-- general. La cuenta general sirve para control y transferencias, no para ventas.

BEGIN;
SET LOCAL ROLE supabase_admin;
SET LOCAL search_path = fullchinavzla, pg_temp;

ALTER TABLE fullchinavzla.financial_accounts
  ADD COLUMN IF NOT EXISTS accepts_customer_payments BOOLEAN NOT NULL DEFAULT true;

UPDATE fullchinavzla.financial_accounts
SET name = 'Caja Full China',
    aliases = ARRAY['caja full china', 'efectivo dolares', 'dolares caja', 'caja usd'],
    accepts_customer_payments = true,
    updated_at = now()
WHERE name = 'Efectivo dolares' AND currency = 'USD';

INSERT INTO fullchinavzla.financial_accounts (
  name, account_type, currency, aliases, is_active, accepts_customer_payments
)
VALUES (
  'Dolares en efectivo general', 'other', 'USD',
  ARRAY['efectivo general', 'dolares general', 'caja general usd'], true, false
)
ON CONFLICT (name, currency) DO UPDATE
SET account_type = EXCLUDED.account_type,
    aliases = EXCLUDED.aliases,
    is_active = true,
    accepts_customer_payments = false,
    updated_at = now();

DROP FUNCTION IF EXISTS fullchinavzla.fn_get_financial_account_balances();
CREATE FUNCTION fullchinavzla.fn_get_financial_account_balances()
RETURNS TABLE(
  id UUID,
  name TEXT,
  account_type TEXT,
  currency TEXT,
  accepts_customer_payments BOOLEAN,
  opening_balance NUMERIC,
  current_balance NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT a.id, a.name, a.account_type, a.currency, a.accepts_customer_payments, a.opening_balance,
    a.opening_balance
    + COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN p.amount*COALESCE(o.bcv_rate,1) ELSE p.amount END) FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.account_id=a.id),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN e.amount*COALESCE(e.exchange_rate,1) ELSE e.amount END) FROM expenses e WHERE e.account_id=a.id),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN pi.total*COALESCE(pu.exchange_rate,1) ELSE pi.total END) FROM purchases pu JOIN LATERAL (SELECT sum(quantity*unit_cost) total FROM purchase_items WHERE purchase_id=pu.id) pi ON true WHERE pu.account_id=a.id AND pu.is_paid),0)
    + COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.to_account_id=a.id AND fo.status='confirmed'),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.from_account_id=a.id AND fo.status='confirmed'),0)
    AS current_balance
  FROM financial_accounts a
  WHERE a.is_active
  ORDER BY a.name;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_financial_account_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_financial_account_balances() TO authenticated, service_role;

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
    SELECT id INTO NEW.account_id FROM fullchinavzla.financial_accounts
    WHERE name = 'Banesco' AND currency = 'VES' AND is_active AND accepts_customer_payments LIMIT 1;
    IF NEW.account_id IS NULL THEN RAISE EXCEPTION 'La cuenta Banesco no esta activa o no existe'; END IF;
  ELSIF NEW.method = 'mobile' THEN
    IF NEW.account_id IS NULL THEN
      SELECT id INTO NEW.account_id FROM fullchinavzla.financial_accounts
      WHERE name = 'Banco Exterior' AND currency = 'VES' AND is_active AND accepts_customer_payments LIMIT 1;
    ELSE
      SELECT name INTO v_account_name FROM fullchinavzla.financial_accounts
      WHERE id = NEW.account_id AND currency = 'VES' AND is_active AND accepts_customer_payments;
      IF v_account_name IS NULL OR v_account_name NOT IN ('Banco Exterior', 'Banesco') THEN
        RAISE EXCEPTION 'Pago movil solo puede ingresar en Banco Exterior o Banesco';
      END IF;
    END IF;
  ELSIF NEW.method = 'cash' AND NEW.account_id IS NULL THEN
    SELECT id INTO NEW.account_id FROM fullchinavzla.financial_accounts
    WHERE name = 'Caja Full China' AND currency = 'USD' AND is_active AND accepts_customer_payments LIMIT 1;
  END IF;

  IF NEW.account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fullchinavzla.financial_accounts
    WHERE id = NEW.account_id AND is_active AND accepts_customer_payments
  ) THEN
    RAISE EXCEPTION 'La cuenta seleccionada no acepta cobros de clientes';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_route_payment_account ON fullchinavzla.payments;
CREATE TRIGGER trg_route_payment_account
BEFORE INSERT OR UPDATE OF method, account_id ON fullchinavzla.payments
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_route_payment_account();

NOTIFY pgrst, 'reload schema';
COMMIT;
