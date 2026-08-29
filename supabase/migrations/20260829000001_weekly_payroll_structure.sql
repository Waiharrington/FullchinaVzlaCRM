-- Nómina semanal según el cuadro Pago 1 / Por cobrar.
BEGIN;

ALTER TABLE fullchinavzla.employees
  ADD COLUMN IF NOT EXISTS weekly_salary NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (weekly_salary >= 0),
  ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (overtime_rate >= 0);

ALTER TABLE fullchinavzla.payroll_entries
  ADD COLUMN IF NOT EXISTS weekly_salary NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (weekly_salary >= 0),
  ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (bonus_amount >= 0),
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (overtime_amount >= 0),
  ADD COLUMN IF NOT EXISTS transport_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (transport_amount >= 0),
  ADD COLUMN IF NOT EXISTS absence_days NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (absence_days >= 0),
  ADD COLUMN IF NOT EXISTS absence_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (absence_deduction >= 0),
  ADD COLUMN IF NOT EXISTS advance_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (advance_deduction >= 0);

COMMIT;
