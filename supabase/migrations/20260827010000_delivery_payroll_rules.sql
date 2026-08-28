-- Nómina por roles y comisión de delivery.
-- No recalcula ni modifica pagos históricos; solo agrega la estructura para
-- que las nuevas operaciones queden trazables e idempotentes.

BEGIN;

ALTER TABLE fullchinavzla.employees
  ADD COLUMN IF NOT EXISTS role_code TEXT NOT NULL DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS compensation_type TEXT NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS source_key TEXT;

ALTER TABLE fullchinavzla.employees
  DROP CONSTRAINT IF EXISTS employees_compensation_type_check;
ALTER TABLE fullchinavzla.employees
  ADD CONSTRAINT employees_compensation_type_check
  CHECK (compensation_type IN ('hourly', 'salary', 'commission', 'mixed'));

ALTER TABLE fullchinavzla.employees
  DROP CONSTRAINT IF EXISTS employees_commission_percent_check;
ALTER TABLE fullchinavzla.employees
  ADD CONSTRAINT employees_commission_percent_check
  CHECK (commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100));

CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_source
  ON fullchinavzla.employees (source_system, source_key)
  WHERE source_system IS NOT NULL AND source_key IS NOT NULL;

-- Ficha base solicitada: el nombre es deliberadamente único por origen para
-- que ejecutar la migración/importación varias veces no cree otro Delivery.
INSERT INTO fullchinavzla.employees
  (full_name, position, hourly_rate, is_active, role_code, compensation_type,
   commission_percent, source_system, source_key)
SELECT 'Delivery', 'Delivery', 0, true, 'delivery', 'commission', 70,
       'fullchinavzla', 'employee:delivery'
WHERE NOT EXISTS (
  SELECT 1 FROM fullchinavzla.employees
  WHERE source_system = 'fullchinavzla' AND source_key = 'employee:delivery'
);

CREATE TABLE IF NOT EXISTS fullchinavzla.delivery_assignments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL UNIQUE REFERENCES fullchinavzla.orders(id) ON DELETE RESTRICT,
  employee_id        UUID NOT NULL REFERENCES fullchinavzla.employees(id),
  delivery_fee       NUMERIC(12,2) NOT NULL CHECK (delivery_fee >= 0),
  employee_percent   NUMERIC(5,2) NOT NULL DEFAULT 70 CHECK (employee_percent >= 0 AND employee_percent <= 100),
  employee_amount    NUMERIC(12,2) GENERATED ALWAYS AS
    (round(delivery_fee * employee_percent / 100, 2)) STORED,
  company_amount     NUMERIC(12,2) GENERATED ALWAYS AS
    (round(delivery_fee - (delivery_fee * employee_percent / 100), 2)) STORED,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  assigned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at            TIMESTAMPTZ,
  notes              TEXT,
  UNIQUE (order_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_employee
  ON fullchinavzla.delivery_assignments(employee_id, assigned_at DESC);

COMMENT ON TABLE fullchinavzla.delivery_assignments IS
  'Liquidaciones de delivery: 70% repartidor y 30% FullChina por defecto';

COMMIT;
