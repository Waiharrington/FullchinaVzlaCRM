-- Corrige la fecha de las asignaciones creadas por la reconciliación histórica.
-- La comisión debe caer en el período de la comanda, no en el día de la migración.

BEGIN;

UPDATE fullchinavzla.delivery_assignments da
SET assigned_at = o.created_at
FROM fullchinavzla.orders o
WHERE o.id = da.order_id
  AND o.status = 'paid'
  AND o.order_type = 'delivery'
  AND da.status = 'pending'
  AND da.payroll_period_id IS NULL
  AND da.assigned_at > now() - interval '1 day'
  AND o.created_at < da.assigned_at;

COMMIT;
