-- Adaptación de nómina a la hoja financiera de FullChina (Drive, agosto 2026).
-- Conserva payroll_entries/advances/bonuses existentes y agrega conceptos
-- explícitos para que cada tarjeta de empleado tenga historial auditable.

BEGIN;

ALTER TABLE fullchinavzla.employees
  ADD COLUMN IF NOT EXISTS payroll_role TEXT NOT NULL DEFAULT 'employee';

CREATE TABLE IF NOT EXISTS fullchinavzla.payroll_adjustments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID REFERENCES fullchinavzla.payroll_periods(id) ON DELETE RESTRICT,
  employee_id       UUID NOT NULL REFERENCES fullchinavzla.employees(id) ON DELETE RESTRICT,
  adjustment_type   TEXT NOT NULL CHECK (adjustment_type IN (
    'bonus', 'transport', 'overtime', 'unpaid_day', 'commission', 'other'
  )),
  amount            NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  direction         TEXT NOT NULL DEFAULT 'add' CHECK (direction IN ('add', 'deduct')),
  adjustment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  description       TEXT,
  source_system     TEXT,
  source_key        TEXT,
  created_by        UUID REFERENCES fullchinavzla.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_key)
);

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_employee_date
  ON fullchinavzla.payroll_adjustments(employee_id, adjustment_date DESC);

CREATE TABLE IF NOT EXISTS fullchinavzla.payroll_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID REFERENCES fullchinavzla.payroll_periods(id) ON DELETE RESTRICT,
  employee_id       UUID NOT NULL REFERENCES fullchinavzla.employees(id) ON DELETE RESTRICT,
  amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency          TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'Bs')),
  exchange_rate     NUMERIC(14,4) CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  payment_account   TEXT,
  payment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  reference         TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES fullchinavzla.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_system     TEXT,
  source_key        TEXT,
  UNIQUE (source_system, source_key)
);

CREATE INDEX IF NOT EXISTS idx_payroll_payments_employee_date
  ON fullchinavzla.payroll_payments(employee_id, payment_date DESC);

CREATE OR REPLACE VIEW fullchinavzla.v_employee_payroll_cards
WITH (security_invoker = true) AS
SELECT
  e.id AS employee_id,
  e.full_name,
  e.position,
  e.payroll_role,
  e.compensation_type,
  e.commission_percent,
  e.is_active,
  COALESCE(SUM(CASE WHEN pp.id IS NOT NULL THEN pp.amount ELSE 0 END), 0) AS total_paid,
  COUNT(DISTINCT pp.id) AS payment_count,
  COALESCE(SUM(CASE WHEN pa.direction = 'add' THEN pa.amount ELSE -pa.amount END), 0) AS adjustments_total
FROM fullchinavzla.employees e
LEFT JOIN fullchinavzla.payroll_payments pp ON pp.employee_id = e.id
LEFT JOIN fullchinavzla.payroll_adjustments pa ON pa.employee_id = e.id
GROUP BY e.id, e.full_name, e.position, e.payroll_role,
         e.compensation_type, e.commission_percent, e.is_active;

COMMENT ON VIEW fullchinavzla.v_employee_payroll_cards IS
  'Resumen para tarjetas de empleados: pagos, conceptos y comisión acumulada';

COMMIT;
