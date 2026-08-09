-- Invu POS migration foundation for the real `fullchinavzla` schema.
-- Schema only: no client records are stored in this repository.
-- Data is loaded separately from a private, generated bundle after backup.

BEGIN;

-- Invu uses zero-priced parent items whose sellable price lives in modifier
-- options. They are retained inactive for traceability; Caja never lists them.
ALTER TABLE fullchinavzla.sellable_products
  DROP CONSTRAINT IF EXISTS sellable_products_price_check;
ALTER TABLE fullchinavzla.sellable_products
  DROP CONSTRAINT IF EXISTS sellable_products_sale_price_check;
ALTER TABLE fullchinavzla.sellable_products
  ADD CONSTRAINT sellable_products_price_check CHECK (price >= 0);

ALTER TABLE fullchinavzla.sellable_products
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS source_code TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER,
  ADD COLUMN IF NOT EXISTS source_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sellable_products_source
  ON fullchinavzla.sellable_products (source_system, source_key)
  WHERE source_system IS NOT NULL AND source_key IS NOT NULL;

ALTER TABLE fullchinavzla.ingredients
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS source_code TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS source_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_source
  ON fullchinavzla.ingredients (source_system, source_key)
  WHERE source_system IS NOT NULL AND source_key IS NOT NULL;

ALTER TABLE fullchinavzla.suppliers
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS source_code TEXT,
  ADD COLUMN IF NOT EXISTS source_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_source
  ON fullchinavzla.suppliers (source_system, source_key)
  WHERE source_system IS NOT NULL AND source_key IS NOT NULL;

ALTER TABLE fullchinavzla.employees
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS source_code TEXT,
  ADD COLUMN IF NOT EXISTS source_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_source
  ON fullchinavzla.employees (source_system, source_key)
  WHERE source_system IS NOT NULL AND source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS fullchinavzla.customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system     TEXT,
  source_key        TEXT,
  identification    TEXT,
  check_digit       TEXT,
  first_name        TEXT,
  last_name         TEXT,
  full_name         TEXT NOT NULL,
  phone             TEXT,
  phones            JSONB NOT NULL DEFAULT '[]'::jsonb,
  email             TEXT,
  account_status    TEXT,
  credit_limit      NUMERIC(12,2),
  address           TEXT,
  birth_date        DATE,
  total_visits      INTEGER NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
  rewards_unlocked  INTEGER NOT NULL DEFAULT 0 CHECK (rewards_unlocked >= 0),
  last_visit        DATE,
  favorite_product  TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  source_payload    JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_source
  ON fullchinavzla.customers (source_system, source_key)
  WHERE source_system IS NOT NULL AND source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON fullchinavzla.customers (full_name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON fullchinavzla.customers (phone);

CREATE TABLE IF NOT EXISTS fullchinavzla.modifiers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system  TEXT NOT NULL DEFAULT 'invu',
  source_key     TEXT NOT NULL,
  code           TEXT,
  name           TEXT NOT NULL,
  modifier_type  INTEGER,
  display_order  INTEGER,
  min_selections INTEGER NOT NULL DEFAULT 0,
  max_selections INTEGER,
  allow_repeat   BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  source_payload JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_key)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.modifier_options (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id    UUID NOT NULL REFERENCES fullchinavzla.modifiers(id) ON DELETE CASCADE,
  source_system  TEXT NOT NULL DEFAULT 'invu',
  source_key     TEXT NOT NULL,
  code           TEXT,
  name           TEXT NOT NULL,
  sale_price     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  display_order  INTEGER,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  source_payload JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_key)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.sellable_product_modifiers (
  sellable_product_id UUID NOT NULL REFERENCES fullchinavzla.sellable_products(id) ON DELETE CASCADE,
  modifier_id         UUID NOT NULL REFERENCES fullchinavzla.modifiers(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sellable_product_id, modifier_id)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.modifier_option_ingredients (
  modifier_option_id UUID NOT NULL REFERENCES fullchinavzla.modifier_options(id) ON DELETE CASCADE,
  ingredient_id      UUID NOT NULL REFERENCES fullchinavzla.ingredients(id),
  quantity           NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_id            UUID NOT NULL REFERENCES fullchinavzla.units(id),
  order_type_code    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (modifier_option_id, ingredient_id, unit_id, order_type_code)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.weekly_menu_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(12,2) NOT NULL CHECK (price > 0),
  cost        NUMERIC(12,2) CHECK (cost IS NULL OR cost >= 0),
  emoji       TEXT NOT NULL DEFAULT '🍽️',
  week_tag    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fullchinavzla.whatsapp_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID REFERENCES fullchinavzla.customers(id),
  template_type TEXT NOT NULL DEFAULT 'custom',
  phone         TEXT NOT NULL,
  message       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  provider_id   TEXT,
  error_message TEXT,
  created_by    UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fullchinavzla.legacy_sales (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system    TEXT NOT NULL DEFAULT 'invu',
  source_key       TEXT NOT NULL,
  source_id        BIGINT,
  order_label      TEXT,
  invoice          TEXT,
  customer_text    TEXT,
  opened_by        TEXT,
  closed_by        TEXT,
  table_text       TEXT,
  opened_at        TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  order_type       TEXT,
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  item_discount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  order_discount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax              NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_tips       NUMERIC(14,2) NOT NULL DEFAULT 0,
  total            NUMERIC(14,2) NOT NULL DEFAULT 0,
  cash_paid        NUMERIC(14,2) NOT NULL DEFAULT 0,
  card_paid        NUMERIC(14,2) NOT NULL DEFAULT 0,
  cheque_paid      NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_paid       NUMERIC(14,2) NOT NULL DEFAULT 0,
  source_payload   JSONB,
  imported_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_key)
);

CREATE INDEX IF NOT EXISTS idx_legacy_sales_closed_at ON fullchinavzla.legacy_sales (closed_at);

CREATE TABLE IF NOT EXISTS fullchinavzla.legacy_deleted_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system  TEXT NOT NULL DEFAULT 'invu',
  source_key     TEXT NOT NULL,
  source_id      BIGINT,
  order_label    TEXT,
  closed_by      TEXT,
  created_at_invu TIMESTAMPTZ,
  description    TEXT,
  deleted_at     TIMESTAMPTZ,
  deleted_by     TEXT,
  source_payload JSONB,
  imported_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_key)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.legacy_purchase_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system  TEXT NOT NULL DEFAULT 'invu',
  source_key     TEXT NOT NULL,
  po_code        TEXT,
  supplier_text  TEXT,
  creation_date  TIMESTAMPTZ,
  po_date        TIMESTAMPTZ,
  tax            NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  import_cost    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  invoice_number TEXT,
  created_by_text TEXT,
  status         TEXT,
  notes          TEXT,
  source_payload JSONB,
  imported_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_key)
);

CREATE TABLE IF NOT EXISTS fullchinavzla.import_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system  TEXT NOT NULL,
  bundle_sha256  TEXT NOT NULL,
  manifest       JSONB NOT NULL,
  imported_by    UUID REFERENCES fullchinavzla.profiles(id),
  imported_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, bundle_sha256)
);

CREATE OR REPLACE FUNCTION fullchinavzla.fn_register_customer_visit(p_customer_id UUID)
RETURNS fullchinavzla.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_customer fullchinavzla.customers;
BEGIN
  v_role := fullchinavzla.get_current_user_role();
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'No autorizado para registrar visitas';
  END IF;

  UPDATE fullchinavzla.customers
  SET total_visits = total_visits + 1,
      rewards_unlocked = floor((total_visits + 1) / 5.0)::INTEGER,
      last_visit = CURRENT_DATE,
      updated_at = now()
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  IF v_customer.id IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;
  RETURN v_customer;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_customers ON fullchinavzla.customers;
CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON fullchinavzla.customers
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_modifiers ON fullchinavzla.modifiers;
CREATE TRIGGER set_updated_at_modifiers BEFORE UPDATE ON fullchinavzla.modifiers
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_modifier_options ON fullchinavzla.modifier_options;
CREATE TRIGGER set_updated_at_modifier_options BEFORE UPDATE ON fullchinavzla.modifier_options
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_weekly_menu ON fullchinavzla.weekly_menu_items;
CREATE TRIGGER set_updated_at_weekly_menu BEFORE UPDATE ON fullchinavzla.weekly_menu_items
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.handle_updated_at();

ALTER TABLE fullchinavzla.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.sellable_product_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.modifier_option_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.weekly_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.legacy_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.legacy_deleted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.legacy_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fullchinavzla.import_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_select ON fullchinavzla.customers;
CREATE POLICY customers_select ON fullchinavzla.customers FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));
DROP POLICY IF EXISTS customers_write ON fullchinavzla.customers;
CREATE POLICY customers_write ON fullchinavzla.customers FOR ALL TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS catalog_extensions_select ON fullchinavzla.modifiers;
CREATE POLICY catalog_extensions_select ON fullchinavzla.modifiers FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));
DROP POLICY IF EXISTS modifier_options_select ON fullchinavzla.modifier_options;
CREATE POLICY modifier_options_select ON fullchinavzla.modifier_options FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));
DROP POLICY IF EXISTS product_modifiers_select ON fullchinavzla.sellable_product_modifiers;
CREATE POLICY product_modifiers_select ON fullchinavzla.sellable_product_modifiers FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));
DROP POLICY IF EXISTS modifier_ingredients_select ON fullchinavzla.modifier_option_ingredients;
CREATE POLICY modifier_ingredients_select ON fullchinavzla.modifier_option_ingredients FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));

DROP POLICY IF EXISTS weekly_menu_select ON fullchinavzla.weekly_menu_items;
CREATE POLICY weekly_menu_select ON fullchinavzla.weekly_menu_items FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));
DROP POLICY IF EXISTS weekly_menu_write ON fullchinavzla.weekly_menu_items;
CREATE POLICY weekly_menu_write ON fullchinavzla.weekly_menu_items FOR ALL TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS whatsapp_messages_select ON fullchinavzla.whatsapp_messages;
CREATE POLICY whatsapp_messages_select ON fullchinavzla.whatsapp_messages FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS whatsapp_messages_write ON fullchinavzla.whatsapp_messages;
CREATE POLICY whatsapp_messages_write ON fullchinavzla.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS legacy_sales_select ON fullchinavzla.legacy_sales;
CREATE POLICY legacy_sales_select ON fullchinavzla.legacy_sales FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS legacy_deleted_select ON fullchinavzla.legacy_deleted_orders;
CREATE POLICY legacy_deleted_select ON fullchinavzla.legacy_deleted_orders FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));
DROP POLICY IF EXISTS legacy_purchase_select ON fullchinavzla.legacy_purchase_orders;
CREATE POLICY legacy_purchase_select ON fullchinavzla.legacy_purchase_orders FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  fullchinavzla.customers,
  fullchinavzla.weekly_menu_items
TO authenticated, service_role;
GRANT SELECT ON
  fullchinavzla.modifiers,
  fullchinavzla.modifier_options,
  fullchinavzla.sellable_product_modifiers,
  fullchinavzla.modifier_option_ingredients,
  fullchinavzla.legacy_sales,
  fullchinavzla.legacy_deleted_orders,
  fullchinavzla.legacy_purchase_orders
TO authenticated, service_role;
GRANT SELECT, INSERT ON fullchinavzla.whatsapp_messages TO authenticated, service_role;
GRANT ALL ON fullchinavzla.import_runs TO service_role;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_register_customer_visit(UUID) TO authenticated, service_role;

COMMIT;
