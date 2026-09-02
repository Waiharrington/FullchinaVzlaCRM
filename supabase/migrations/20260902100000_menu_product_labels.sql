BEGIN;
ALTER TABLE fullchinavzla.sellable_products ADD COLUMN IF NOT EXISTS menu_label TEXT;
ALTER TABLE fullchinavzla.sellable_products DROP CONSTRAINT IF EXISTS sellable_products_menu_label_check;
ALTER TABLE fullchinavzla.sellable_products ADD CONSTRAINT sellable_products_menu_label_check CHECK (menu_label IS NULL OR menu_label IN ('top_sales', 'new', 'recommended', 'free_drink'));
COMMENT ON COLUMN fullchinavzla.sellable_products.menu_label IS 'Etiqueta manual visible en el menú público';
COMMIT;
