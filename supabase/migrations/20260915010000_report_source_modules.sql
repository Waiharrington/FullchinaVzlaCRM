-- Fuentes de datos para reportes avanzados.
-- Migration local: requiere backup y autorizacion antes de aplicarse al VPS.
-- No contiene datos reales ni carga historica.

BEGIN;

-- Eventos operativos para ordenes, cocina, caja e impresiones.
CREATE TABLE IF NOT EXISTS fullchinavzla.order_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES fullchinavzla.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','status_changed','kitchen_status_changed','printed','drawer_opened','note_changed','cancelled')),
  previous_value TEXT,
  current_value TEXT,
  actor_id UUID REFERENCES fullchinavzla.profiles(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_event_logs_order_date ON fullchinavzla.order_event_logs(order_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_event_logs_type_date ON fullchinavzla.order_event_logs(event_type, occurred_at DESC);

CREATE OR REPLACE FUNCTION fullchinavzla.fn_log_order_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO fullchinavzla.order_event_logs(order_id,event_type,current_value,actor_id)
    VALUES (NEW.id,'created',NEW.status,NEW.created_by);
  ELSIF OLD.fulfillment_status IS DISTINCT FROM NEW.fulfillment_status THEN
    INSERT INTO fullchinavzla.order_event_logs(order_id,event_type,previous_value,current_value,actor_id)
    VALUES (NEW.id,'kitchen_status_changed',OLD.fulfillment_status,NEW.fulfillment_status,NEW.created_by);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO fullchinavzla.order_event_logs(order_id,event_type,previous_value,current_value,actor_id)
    VALUES (NEW.id,CASE WHEN NEW.status='cancelled' THEN 'cancelled' ELSE 'status_changed' END,OLD.status,NEW.status,NEW.created_by);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_report_order_event ON fullchinavzla.orders;
CREATE TRIGGER trg_report_order_event AFTER INSERT OR UPDATE OF status, fulfillment_status ON fullchinavzla.orders
FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_log_order_event();

-- Ajustes auditables: descuentos, impuestos, propinas y notas de credito.
CREATE TABLE IF NOT EXISTS fullchinavzla.order_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES fullchinavzla.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES fullchinavzla.order_items(id) ON DELETE SET NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('discount_item','discount_order','tax','tip','service','credit_note')),
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd >= 0),
  reason TEXT,
  employee_id UUID REFERENCES fullchinavzla.employees(id),
  created_by UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_adjustments_order ON fullchinavzla.order_adjustments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_adjustments_type ON fullchinavzla.order_adjustments(adjustment_type, created_at DESC);

-- Asistencia y comisiones para reportes laborales y de delivery.
CREATE TABLE IF NOT EXISTS fullchinavzla.employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES fullchinavzla.employees(id),
  work_date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (clock_out IS NULL OR clock_in IS NULL OR clock_out >= clock_in),
  UNIQUE(employee_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_date ON fullchinavzla.employee_attendance(work_date DESC);

-- Gift cards: saldo y movimientos inmutables para conciliacion.
CREATE TABLE IF NOT EXISTS fullchinavzla.gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  initial_amount_usd NUMERIC(14,2) NOT NULL CHECK (initial_amount_usd > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at DATE,
  created_by UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fullchinavzla.gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID NOT NULL REFERENCES fullchinavzla.gift_cards(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('issue','reload','redemption','void')),
  amount_usd NUMERIC(14,2) NOT NULL CHECK (amount_usd > 0),
  order_id UUID REFERENCES fullchinavzla.orders(id),
  reference TEXT,
  created_by UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_date ON fullchinavzla.gift_card_transactions(created_at DESC);

-- Requisiciones entre ubicaciones, para separar consumo de solicitud interna.
CREATE TABLE IF NOT EXISTS fullchinavzla.inventory_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES fullchinavzla.ingredients(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_id UUID NOT NULL REFERENCES fullchinavzla.units(id),
  from_location TEXT NOT NULL CHECK (from_location IN ('warehouse','operational')),
  to_location TEXT NOT NULL CHECK (to_location IN ('warehouse','operational')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','fulfilled','cancelled')),
  requested_by UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  fulfilled_by UUID REFERENCES fullchinavzla.profiles(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ,
  CHECK (from_location <> to_location)
);
CREATE INDEX IF NOT EXISTS idx_inventory_requisitions_date ON fullchinavzla.inventory_requisitions(requested_at DESC);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['order_event_logs','order_adjustments','employee_attendance','gift_cards','gift_card_transactions','inventory_requisitions'] LOOP
    EXECUTE format('ALTER TABLE fullchinavzla.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON fullchinavzla.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_select ON fullchinavzla.%I FOR SELECT USING (fullchinavzla.get_current_user_role() IN (''owner'',''manager''))', table_name, table_name);
  END LOOP;
END $$;

GRANT SELECT ON fullchinavzla.order_event_logs, fullchinavzla.order_adjustments,
  fullchinavzla.employee_attendance, fullchinavzla.gift_cards,
  fullchinavzla.gift_card_transactions, fullchinavzla.inventory_requisitions TO authenticated;

COMMIT;
