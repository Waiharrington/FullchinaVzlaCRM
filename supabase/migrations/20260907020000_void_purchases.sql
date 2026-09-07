BEGIN;

ALTER TABLE fullchinavzla.purchases
  ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES fullchinavzla.profiles(id);

COMMENT ON COLUMN fullchinavzla.purchases.is_voided IS
  'Anulación administrativa: conserva la compra y sus movimientos de inventario, pero la excluye de los totales financieros.';

CREATE OR REPLACE FUNCTION fullchinavzla.fn_void_purchase(p_purchase_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
BEGIN
  IF fullchinavzla.get_current_user_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Solo owner/manager pueden anular compras';
  END IF;

  UPDATE fullchinavzla.purchases
  SET is_voided = true, voided_at = now(), voided_by = auth.uid()
  WHERE id = p_purchase_id AND NOT is_voided;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra no encontrada o ya está anulada';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_void_purchase(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_void_purchase(UUID) TO authenticated;

DROP FUNCTION IF EXISTS fullchinavzla.fn_get_financial_account_balances();
CREATE FUNCTION fullchinavzla.fn_get_financial_account_balances()
RETURNS TABLE(
  id UUID, name TEXT, account_type TEXT, currency TEXT,
  accepts_customer_payments BOOLEAN, opening_balance NUMERIC, current_balance NUMERIC
)
LANGUAGE sql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
  SELECT a.id, a.name, a.account_type, a.currency, a.accepts_customer_payments, a.opening_balance,
    a.opening_balance
    + COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN p.amount*COALESCE(o.bcv_rate,1) ELSE p.amount END) FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.account_id=a.id),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN e.amount*COALESCE(e.exchange_rate,1) ELSE e.amount END) FROM expenses e WHERE e.account_id=a.id),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency='VES' THEN pi.total*COALESCE(pu.exchange_rate,1) ELSE pi.total END) FROM purchases pu JOIN LATERAL (SELECT sum(quantity*unit_cost) total FROM purchase_items WHERE purchase_id=pu.id) pi ON true WHERE pu.account_id=a.id AND pu.is_paid AND NOT pu.is_voided),0)
    + COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.to_account_id=a.id AND fo.status='confirmed'),0)
    - COALESCE((SELECT sum(CASE WHEN a.currency=fo.original_currency THEN fo.original_amount WHEN a.currency='VES' THEN fo.amount_usd*COALESCE(fo.exchange_rate,1) ELSE fo.amount_usd END) FROM financial_operations fo WHERE fo.from_account_id=a.id AND fo.status='confirmed'),0)
    AS current_balance
  FROM financial_accounts a WHERE a.is_active ORDER BY a.name;
$$;

REVOKE ALL ON FUNCTION fullchinavzla.fn_get_financial_account_balances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_get_financial_account_balances() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;
