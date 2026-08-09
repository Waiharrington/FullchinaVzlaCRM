\set ON_ERROR_STOP on

-- Usage (server-side psql):
--   psql -v bundle_sha256=<manifest bundle hash> \
--        -v manifest_file=/tmp/fullchina-invu/manifest.json \
--        -f load_bundle.sql
-- Copy the private bundle to /tmp/fullchina-invu inside the DB container first.
-- The CSV bundle is private and must never be committed.

BEGIN;
SET LOCAL search_path = fullchinavzla, public, pg_temp;

CREATE TEMP TABLE stg_products (
  source_key text, source_code text, name text, description text, price text,
  cost text, category text, emoji text, is_active text, barcode text,
  display_order text, source_payload text
);
CREATE TEMP TABLE stg_units (name text, symbol text);
CREATE TEMP TABLE stg_ingredients (
  source_key text, source_code text, name text, unit_name text, is_active text,
  barcode text, quantity text, cost text, source_payload text
);
CREATE TEMP TABLE stg_recipe_components (
  product_source_key text, ingredient_source_key text, quantity text, unit_name text
);
CREATE TEMP TABLE stg_modifiers (
  source_key text, code text, name text, modifier_type text, display_order text,
  min_selections text, max_selections text, allow_repeat text, is_active text,
  source_payload text
);
CREATE TEMP TABLE stg_modifier_options (
  source_key text, modifier_source_key text, code text, name text, sale_price text,
  display_order text, is_active text, source_payload text
);
CREATE TEMP TABLE stg_product_modifiers (product_source_key text, modifier_source_key text);
CREATE TEMP TABLE stg_modifier_option_ingredients (
  option_source_key text, ingredient_source_key text, quantity text,
  unit_name text, order_type_code text
);
CREATE TEMP TABLE stg_customers (
  source_key text, identification text, check_digit text, first_name text,
  last_name text, full_name text, phone text, phones text, email text,
  account_status text, credit_limit text, address text, is_active text,
  source_payload text
);
CREATE TEMP TABLE stg_suppliers (
  source_key text, source_code text, name text, contact text, phone text,
  email text, notes text, is_active text, source_payload text
);
CREATE TEMP TABLE stg_employees (
  source_key text, source_code text, full_name text, position text,
  hourly_rate text, is_active text, source_payload text
);
CREATE TEMP TABLE stg_legacy_sales (
  source_key text, source_id text, order_label text, invoice text,
  customer_text text, opened_by text, closed_by text, table_text text,
  opened_at text, closed_at text, order_type text, subtotal text,
  item_discount text, order_discount text, tax text, total_tips text,
  total text, cash_paid text, card_paid text, cheque_paid text,
  other_paid text, source_payload text
);
CREATE TEMP TABLE stg_legacy_deleted_orders (
  source_key text, source_id text, order_label text, closed_by text,
  created_at_invu text, description text, deleted_at text, deleted_by text,
  source_payload text
);
CREATE TEMP TABLE stg_legacy_purchase_orders (
  source_key text, po_code text, supplier_text text, creation_date text,
  po_date text, tax text, discount text, import_cost text, total text,
  invoice_number text, created_by_text text, status text, notes text,
  source_payload text
);

\copy stg_products FROM '/tmp/fullchina-invu/products.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_units FROM '/tmp/fullchina-invu/units.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_ingredients FROM '/tmp/fullchina-invu/ingredients.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_recipe_components FROM '/tmp/fullchina-invu/recipe_components.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_modifiers FROM '/tmp/fullchina-invu/modifiers.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_modifier_options FROM '/tmp/fullchina-invu/modifier_options.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_product_modifiers FROM '/tmp/fullchina-invu/product_modifiers.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_modifier_option_ingredients FROM '/tmp/fullchina-invu/modifier_option_ingredients.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_customers FROM '/tmp/fullchina-invu/customers.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_suppliers FROM '/tmp/fullchina-invu/suppliers.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_employees FROM '/tmp/fullchina-invu/employees.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_legacy_sales FROM '/tmp/fullchina-invu/legacy_sales.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_legacy_deleted_orders FROM '/tmp/fullchina-invu/legacy_deleted_orders.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stg_legacy_purchase_orders FROM '/tmp/fullchina-invu/legacy_purchase_orders.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

DO $$
DECLARE
  actual integer;
  expected integer;
  pair record;
BEGIN
  FOR pair IN SELECT * FROM (VALUES
    ('stg_products', 104), ('stg_units', 4), ('stg_ingredients', 62),
    ('stg_recipe_components', 398), ('stg_modifiers', 21),
    ('stg_modifier_options', 81), ('stg_product_modifiers', 18),
    ('stg_modifier_option_ingredients', 158), ('stg_customers', 760),
    ('stg_suppliers', 11), ('stg_employees', 6), ('stg_legacy_sales', 4580),
    ('stg_legacy_deleted_orders', 608), ('stg_legacy_purchase_orders', 568)
  ) AS v(table_name, row_count)
  LOOP
    EXECUTE format('SELECT count(*) FROM %I', pair.table_name) INTO actual;
    expected := pair.row_count;
    IF actual <> expected THEN
      RAISE EXCEPTION 'Conteo invalido para %: esperado %, recibido %', pair.table_name, expected, actual;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM stg_products WHERE is_active::boolean AND price::numeric <= 0) THEN
    RAISE EXCEPTION 'El paquete contiene productos activos sin precio positivo';
  END IF;
END $$;

INSERT INTO fullchinavzla.units (name, symbol)
SELECT name, symbol FROM stg_units
ON CONFLICT (name) DO NOTHING;

-- Adopt existing catalog records by normalized name before source-key upserts.
UPDATE fullchinavzla.sellable_products p
SET source_system='invu', source_key=s.source_key, source_code=NULLIF(s.source_code,''),
    barcode=NULLIF(s.barcode,''), display_order=NULLIF(s.display_order,'')::integer,
    source_payload=s.source_payload::jsonb
FROM stg_products s
WHERE p.source_system IS NULL
  AND regexp_replace(translate(lower(p.name), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '', 'g') =
      regexp_replace(translate(lower(s.name), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '', 'g');

INSERT INTO fullchinavzla.sellable_products
  (name, description, price, cost, category, emoji, is_active, source_system,
   source_key, source_code, barcode, display_order, source_payload)
SELECT name, NULLIF(description,''), price::numeric, NULLIF(cost,'')::numeric,
       category, emoji, is_active::boolean, 'invu', source_key,
       NULLIF(source_code,''), NULLIF(barcode,''), NULLIF(display_order,'')::integer,
       source_payload::jsonb
FROM stg_products
ON CONFLICT (source_system, source_key) WHERE source_system IS NOT NULL AND source_key IS NOT NULL
DO UPDATE SET name=excluded.name, description=excluded.description, price=excluded.price,
  cost=excluded.cost, category=excluded.category, emoji=excluded.emoji,
  is_active=excluded.is_active, source_code=excluded.source_code,
  barcode=excluded.barcode, display_order=excluded.display_order,
  source_payload=excluded.source_payload, updated_at=now();

UPDATE fullchinavzla.sellable_products
SET is_active=false, updated_at=now()
WHERE source_system IS DISTINCT FROM 'invu';

UPDATE fullchinavzla.ingredients i
SET source_system='invu', source_key=s.source_key, source_code=NULLIF(s.source_code,''),
    barcode=NULLIF(s.barcode,''), source_payload=s.source_payload::jsonb
FROM stg_ingredients s
WHERE i.source_system IS NULL AND lower(i.name)=lower(s.name);

INSERT INTO fullchinavzla.ingredients
  (name, unit_id, is_active, source_system, source_key, source_code, barcode, source_payload)
SELECT s.name, u.id, s.is_active::boolean, 'invu', s.source_key,
       NULLIF(s.source_code,''), NULLIF(s.barcode,''), s.source_payload::jsonb
FROM stg_ingredients s JOIN fullchinavzla.units u ON lower(u.name)=lower(s.unit_name)
ON CONFLICT (source_system, source_key) WHERE source_system IS NOT NULL AND source_key IS NOT NULL
DO UPDATE SET name=excluded.name, unit_id=excluded.unit_id, is_active=excluded.is_active,
  source_code=excluded.source_code, barcode=excluded.barcode,
  source_payload=excluded.source_payload, updated_at=now();

INSERT INTO fullchinavzla.ingredient_costs (ingredient_id, price_per_unit, updated_by)
SELECT i.id, round(s.cost::numeric, 2), owner_profile.id
FROM stg_ingredients s
JOIN fullchinavzla.ingredients i ON i.source_system='invu' AND i.source_key=s.source_key
CROSS JOIN LATERAL (
  SELECT id FROM fullchinavzla.profiles
  WHERE role='owner' AND is_active=true ORDER BY created_at LIMIT 1
) owner_profile
ON CONFLICT (ingredient_id) DO UPDATE
SET price_per_unit=excluded.price_per_unit, last_updated=now(), updated_by=excluded.updated_by;

INSERT INTO fullchinavzla.stock_movements
  (ingredient_id, quantity, unit_id, movement_type, reference_type, notes, created_by)
SELECT i.id, s.quantity::numeric, u.id, 'adjustment', 'manual',
       'Saldo inicial Invu: ' || s.source_key, owner_profile.id
FROM stg_ingredients s
JOIN fullchinavzla.ingredients i ON i.source_system='invu' AND i.source_key=s.source_key
JOIN fullchinavzla.units u ON lower(u.name)=lower(s.unit_name)
CROSS JOIN LATERAL (
  SELECT id FROM fullchinavzla.profiles
  WHERE role='owner' AND is_active=true ORDER BY created_at LIMIT 1
) owner_profile
WHERE s.quantity::numeric <> 0
  AND NOT EXISTS (
    SELECT 1 FROM fullchinavzla.stock_movements sm
    WHERE sm.ingredient_id=i.id AND sm.notes='Saldo inicial Invu: ' || s.source_key
  );

DELETE FROM fullchinavzla.recipe_components rc
USING fullchinavzla.sellable_products p
WHERE rc.sellable_product_id=p.id AND p.source_system='invu';
INSERT INTO fullchinavzla.recipe_components
  (sellable_product_id, ingredient_id, quantity, unit_id)
SELECT p.id, i.id, s.quantity::numeric, u.id
FROM stg_recipe_components s
JOIN fullchinavzla.sellable_products p ON p.source_system='invu' AND p.source_key=s.product_source_key
JOIN fullchinavzla.ingredients i ON i.source_system='invu' AND i.source_key=s.ingredient_source_key
JOIN fullchinavzla.units u ON lower(u.name)=lower(s.unit_name);

INSERT INTO fullchinavzla.modifiers
  (source_system, source_key, code, name, modifier_type, display_order,
   min_selections, max_selections, allow_repeat, is_active, source_payload)
SELECT 'invu', source_key, NULLIF(code,''), name, modifier_type::integer,
       NULLIF(display_order,'')::integer, min_selections::integer,
       NULLIF(max_selections,'')::integer, allow_repeat::boolean,
       is_active::boolean, source_payload::jsonb
FROM stg_modifiers
ON CONFLICT (source_system, source_key) DO UPDATE SET code=excluded.code,
  name=excluded.name, modifier_type=excluded.modifier_type,
  display_order=excluded.display_order, min_selections=excluded.min_selections,
  max_selections=excluded.max_selections, allow_repeat=excluded.allow_repeat,
  is_active=excluded.is_active, source_payload=excluded.source_payload,
  updated_at=now();

INSERT INTO fullchinavzla.modifier_options
  (modifier_id, source_system, source_key, code, name, sale_price,
   display_order, is_active, source_payload)
SELECT m.id, 'invu', s.source_key, NULLIF(s.code,''), s.name,
       s.sale_price::numeric, NULLIF(s.display_order,'')::integer,
       s.is_active::boolean, s.source_payload::jsonb
FROM stg_modifier_options s
JOIN fullchinavzla.modifiers m ON m.source_system='invu' AND m.source_key=s.modifier_source_key
ON CONFLICT (source_system, source_key) DO UPDATE SET modifier_id=excluded.modifier_id,
  code=excluded.code, name=excluded.name, sale_price=excluded.sale_price,
  display_order=excluded.display_order, is_active=excluded.is_active,
  source_payload=excluded.source_payload, updated_at=now();

DELETE FROM fullchinavzla.sellable_product_modifiers spm
USING fullchinavzla.sellable_products p
WHERE spm.sellable_product_id=p.id AND p.source_system='invu';
INSERT INTO fullchinavzla.sellable_product_modifiers (sellable_product_id, modifier_id)
SELECT p.id, m.id FROM stg_product_modifiers s
JOIN fullchinavzla.sellable_products p ON p.source_system='invu' AND p.source_key=s.product_source_key
JOIN fullchinavzla.modifiers m ON m.source_system='invu' AND m.source_key=s.modifier_source_key;

DELETE FROM fullchinavzla.modifier_option_ingredients moi
USING fullchinavzla.modifier_options mo
WHERE moi.modifier_option_id=mo.id AND mo.source_system='invu';
INSERT INTO fullchinavzla.modifier_option_ingredients
  (modifier_option_id, ingredient_id, quantity, unit_id, order_type_code)
SELECT mo.id, i.id, s.quantity::numeric, u.id, COALESCE(NULLIF(s.order_type_code,''), '')
FROM stg_modifier_option_ingredients s
JOIN fullchinavzla.modifier_options mo ON mo.source_system='invu' AND mo.source_key=s.option_source_key
JOIN fullchinavzla.ingredients i ON i.source_system='invu' AND i.source_key=s.ingredient_source_key
JOIN fullchinavzla.units u ON lower(u.name)=lower(s.unit_name);

INSERT INTO fullchinavzla.customers
  (source_system, source_key, identification, check_digit, first_name, last_name,
   full_name, phone, phones, email, account_status, credit_limit, address,
   is_active, source_payload)
SELECT 'invu', source_key, NULLIF(identification,''), NULLIF(check_digit,''),
       NULLIF(first_name,''), NULLIF(last_name,''), full_name, NULLIF(phone,''),
       COALESCE(NULLIF(phones,''),'[]')::jsonb, NULLIF(email,''),
       NULLIF(account_status,''), NULLIF(credit_limit,'')::numeric,
       NULLIF(address,''), is_active::boolean, source_payload::jsonb
FROM stg_customers
ON CONFLICT (source_system, source_key) WHERE source_system IS NOT NULL AND source_key IS NOT NULL
DO UPDATE SET identification=excluded.identification, check_digit=excluded.check_digit,
  first_name=excluded.first_name, last_name=excluded.last_name,
  full_name=excluded.full_name, phone=excluded.phone, phones=excluded.phones,
  email=excluded.email, account_status=excluded.account_status,
  credit_limit=excluded.credit_limit, address=excluded.address,
  is_active=excluded.is_active, source_payload=excluded.source_payload,
  updated_at=now();

INSERT INTO fullchinavzla.suppliers
  (name, contact, phone, email, notes, is_active, source_system, source_key,
   source_code, source_payload)
SELECT name, NULLIF(contact,''), NULLIF(phone,''), NULLIF(email,''), NULLIF(notes,''),
       is_active::boolean, 'invu', source_key, NULLIF(source_code,''), source_payload::jsonb
FROM stg_suppliers
ON CONFLICT (source_system, source_key) WHERE source_system IS NOT NULL AND source_key IS NOT NULL
DO UPDATE SET name=excluded.name, contact=excluded.contact, phone=excluded.phone,
  email=excluded.email, notes=excluded.notes, is_active=excluded.is_active,
  source_code=excluded.source_code, source_payload=excluded.source_payload,
  updated_at=now();

INSERT INTO fullchinavzla.employees
  (full_name, position, hourly_rate, is_active, source_system, source_key,
   source_code, source_payload)
SELECT full_name, NULLIF(position,''), hourly_rate::numeric, is_active::boolean,
       'invu', source_key, NULLIF(source_code,''), source_payload::jsonb
FROM stg_employees
ON CONFLICT (source_system, source_key) WHERE source_system IS NOT NULL AND source_key IS NOT NULL
DO UPDATE SET full_name=excluded.full_name, position=excluded.position,
  hourly_rate=excluded.hourly_rate, is_active=excluded.is_active,
  source_code=excluded.source_code, source_payload=excluded.source_payload,
  updated_at=now();

INSERT INTO fullchinavzla.legacy_sales
  (source_system, source_key, source_id, order_label, invoice, customer_text,
   opened_by, closed_by, table_text, opened_at, closed_at, order_type, subtotal,
   item_discount, order_discount, tax, total_tips, total, cash_paid, card_paid,
   cheque_paid, other_paid, source_payload)
SELECT 'invu', source_key, NULLIF(source_id,'')::bigint, NULLIF(order_label,''),
  NULLIF(invoice,''), NULLIF(customer_text,''), NULLIF(opened_by,''),
  NULLIF(closed_by,''), NULLIF(table_text,''), NULLIF(opened_at,'')::timestamptz,
  NULLIF(closed_at,'')::timestamptz, NULLIF(order_type,''), subtotal::numeric,
  item_discount::numeric, order_discount::numeric, tax::numeric,
  total_tips::numeric, total::numeric, cash_paid::numeric, card_paid::numeric,
  cheque_paid::numeric, other_paid::numeric, source_payload::jsonb
FROM stg_legacy_sales
ON CONFLICT (source_system, source_key) DO UPDATE SET
  source_id=excluded.source_id, order_label=excluded.order_label, invoice=excluded.invoice,
  customer_text=excluded.customer_text, opened_by=excluded.opened_by,
  closed_by=excluded.closed_by, table_text=excluded.table_text,
  opened_at=excluded.opened_at, closed_at=excluded.closed_at,
  order_type=excluded.order_type, subtotal=excluded.subtotal,
  item_discount=excluded.item_discount, order_discount=excluded.order_discount,
  tax=excluded.tax, total_tips=excluded.total_tips, total=excluded.total,
  cash_paid=excluded.cash_paid, card_paid=excluded.card_paid,
  cheque_paid=excluded.cheque_paid, other_paid=excluded.other_paid,
  source_payload=excluded.source_payload, imported_at=now();

INSERT INTO fullchinavzla.legacy_deleted_orders
  (source_system, source_key, source_id, order_label, closed_by, created_at_invu,
   description, deleted_at, deleted_by, source_payload)
SELECT 'invu', source_key, NULLIF(source_id,'')::bigint, NULLIF(order_label,''),
  NULLIF(closed_by,''), NULLIF(created_at_invu,'')::timestamptz,
  NULLIF(description,''), NULLIF(deleted_at,'')::timestamptz,
  NULLIF(deleted_by,''), source_payload::jsonb
FROM stg_legacy_deleted_orders
ON CONFLICT (source_system, source_key) DO UPDATE SET source_id=excluded.source_id,
  order_label=excluded.order_label, closed_by=excluded.closed_by,
  created_at_invu=excluded.created_at_invu, description=excluded.description,
  deleted_at=excluded.deleted_at, deleted_by=excluded.deleted_by,
  source_payload=excluded.source_payload, imported_at=now();

INSERT INTO fullchinavzla.legacy_purchase_orders
  (source_system, source_key, po_code, supplier_text, creation_date, po_date,
   tax, discount, import_cost, total, invoice_number, created_by_text,
   status, notes, source_payload)
SELECT 'invu', source_key, NULLIF(po_code,''), NULLIF(supplier_text,''),
  NULLIF(creation_date,'')::timestamptz, NULLIF(po_date,'')::timestamptz,
  tax::numeric, discount::numeric, import_cost::numeric, total::numeric,
  NULLIF(invoice_number,''), NULLIF(created_by_text,''), NULLIF(status,''),
  NULLIF(notes,''), source_payload::jsonb
FROM stg_legacy_purchase_orders
ON CONFLICT (source_system, source_key) DO UPDATE SET po_code=excluded.po_code,
  supplier_text=excluded.supplier_text, creation_date=excluded.creation_date,
  po_date=excluded.po_date, tax=excluded.tax, discount=excluded.discount,
  import_cost=excluded.import_cost, total=excluded.total,
  invoice_number=excluded.invoice_number, created_by_text=excluded.created_by_text,
  status=excluded.status, notes=excluded.notes, source_payload=excluded.source_payload,
  imported_at=now();

-- Bring visit counts/last visit across without manufacturing operational orders.
-- Invu prefixes the customer display with its identification number.
WITH visits AS (
  SELECT regexp_replace(split_part(customer_text, ' ', 1), '[^0-9]+', '', 'g') AS identification,
         count(*)::integer AS visits, max(closed_at)::date AS last_visit
  FROM fullchinavzla.legacy_sales
  WHERE source_system='invu' AND NULLIF(customer_text,'') IS NOT NULL
  GROUP BY 1
)
UPDATE fullchinavzla.customers c
SET total_visits=v.visits, rewards_unlocked=floor(v.visits / 5.0)::integer,
    last_visit=v.last_visit, updated_at=now()
FROM visits v
WHERE length(v.identification) >= 5
  AND regexp_replace(coalesce(c.identification,''), '[^0-9]+', '', 'g')=v.identification;

INSERT INTO fullchinavzla.import_runs
  (source_system, bundle_sha256, manifest, imported_by)
SELECT 'invu', :'bundle_sha256', pg_read_file(:'manifest_file')::jsonb, p.id
FROM fullchinavzla.profiles p
WHERE p.role='owner' AND p.is_active=true
ORDER BY p.created_at LIMIT 1
ON CONFLICT (source_system, bundle_sha256) DO NOTHING;

COMMIT;

SELECT 'products' AS entity, count(*) AS total,
       count(*) FILTER (WHERE is_active) AS active
FROM fullchinavzla.sellable_products WHERE source_system='invu'
UNION ALL SELECT 'ingredients', count(*), count(*) FILTER (WHERE is_active)
FROM fullchinavzla.ingredients WHERE source_system='invu'
UNION ALL SELECT 'customers', count(*), count(*) FILTER (WHERE is_active)
FROM fullchinavzla.customers WHERE source_system='invu'
UNION ALL SELECT 'legacy_sales', count(*), count(*)
FROM fullchinavzla.legacy_sales WHERE source_system='invu';
