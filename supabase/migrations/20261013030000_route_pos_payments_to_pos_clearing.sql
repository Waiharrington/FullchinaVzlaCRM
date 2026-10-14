-- Punto de venta liquida primero en su cuenta puente; el depósito a Banesco
-- se registra después como transferencia manual desde Finanzas.
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
    SELECT id INTO NEW.account_id FROM fullchinavzla.financial_accounts
    WHERE name = 'Punto de venta' AND account_type = 'pos' AND currency = 'VES'
      AND is_active AND accepts_customer_payments
    LIMIT 1;
    IF NEW.account_id IS NULL THEN RAISE EXCEPTION 'La cuenta Punto de venta no esta activa o no existe'; END IF;
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

-- Los cobros son inmutables: se conserva su cuenta original y se registra una
-- transferencia de reclasificación con trazabilidad, sin alterar los pagos.
DO $migration$
DECLARE
  v_banesco uuid;
  v_pos uuid;
  v_actor uuid;
  v_amount_usd numeric(14,2);
  v_amount_ves numeric(14,2);
  v_orders text;
BEGIN
  SELECT id INTO v_banesco FROM fullchinavzla.financial_accounts
    WHERE name = 'Banesco' AND currency = 'VES' AND is_active LIMIT 1;
  SELECT id INTO v_pos FROM fullchinavzla.financial_accounts
    WHERE name = 'Punto de venta' AND currency = 'VES' AND account_type = 'pos'
      AND is_active AND accepts_customer_payments LIMIT 1;
  SELECT id INTO v_actor FROM fullchinavzla.profiles WHERE role = 'owner' AND is_active LIMIT 1;

  IF v_banesco IS NULL OR v_pos IS NULL OR v_actor IS NULL THEN
    RAISE EXCEPTION 'No se puede reclasificar: falta Banesco, Punto de venta o un perfil owner activo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fullchinavzla.financial_operations
    WHERE reference_number = 'POS-RECLASS-20261012'
  ) THEN
    SELECT round(coalesce(sum(p.amount), 0), 2),
           round(coalesce(sum(round(p.amount * coalesce(o.bcv_rate, 1), 2)), 0), 2),
           string_agg(DISTINCT '#' || o.order_number::text, ', ' ORDER BY '#' || o.order_number::text)
      INTO v_amount_usd, v_amount_ves, v_orders
      FROM fullchinavzla.payments p
      JOIN fullchinavzla.orders o ON o.id = p.order_id
     WHERE p.method = 'card'
       AND p.account_id = v_banesco
       AND timezone('America/Caracas', p.created_at)::date >= DATE '2026-10-12';

    IF v_amount_usd > 0 AND v_amount_ves > 0 THEN
      INSERT INTO fullchinavzla.financial_operations
        (operation_type, concept, operation_date, amount_usd, original_currency, original_amount,
         exchange_rate, from_account_id, to_account_id, reference_number, affects_profit,
         notes, created_by, status)
      VALUES
        ('transfer', 'Reclasificación de cobros Punto de venta desde el 12/10/2026',
         timezone('America/Caracas', now())::date, v_amount_usd, 'VES', v_amount_ves,
         v_amount_ves / v_amount_usd, v_banesco, v_pos, 'POS-RECLASS-20261012', false,
         'Ajuste contable por cambio de enrutamiento; pagos originales sin modificar. Comandas: ' || coalesce(v_orders, 'sin detalle'),
         v_actor, 'confirmed');
    END IF;
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
