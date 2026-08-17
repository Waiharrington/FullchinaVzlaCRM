-- =============================================================================
-- FULL CHINA VZLA - Estado de pago en compras (cuentas por pagar a proveedor)
-- =============================================================================
-- Agrega purchases.is_paid para marcar si la factura del proveedor ya se pagó.
-- "Recibido" no se modela como columna: registrar una compra ya genera el stock
-- (trigger fn_purchase_item_to_stock), así que toda compra registrada está
-- recibida por definición. is_paid default true (la mayoría se paga al recibir).
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

ALTER TABLE fullchinavzla.purchases
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN fullchinavzla.purchases.is_paid IS
  'Si la factura del proveedor ya fue pagada (cuentas por pagar)';

RESET ROLE;

COMMIT;

-- ROLLBACK: ALTER TABLE fullchinavzla.purchases DROP COLUMN IF EXISTS is_paid;
