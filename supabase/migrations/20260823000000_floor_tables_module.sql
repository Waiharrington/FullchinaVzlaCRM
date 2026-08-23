-- =============================================================================
-- FULL CHINA VZLA - Modulo "Mesas" (mapa de mesas estilo INVU)
-- =============================================================================
-- Tabla de configuracion del salon: cada fila es una mesa fisica con su
-- posicion en el mapa (pos_x/pos_y en % del lienzo), zona, forma y capacidad.
-- El vinculo con las ordenes sigue siendo por NUMERO (orders.table_number,
-- ya existente desde 20260822020000) -- floor_tables.number es ese mismo
-- numero, así que no hace falta tocar orders ni fn_checkout_order.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

CREATE TABLE IF NOT EXISTS fullchinavzla.floor_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number      SMALLINT NOT NULL CHECK (number > 0 AND number <= 50),
  zone        TEXT NOT NULL DEFAULT 'Salón',
  shape       TEXT NOT NULL DEFAULT 'square' CHECK (shape IN ('square', 'round')),
  seats       SMALLINT NOT NULL DEFAULT 4 CHECK (seats > 0),
  pos_x       NUMERIC(5,2) NOT NULL DEFAULT 10,
  pos_y       NUMERIC(5,2) NOT NULL DEFAULT 10,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (number)
);
COMMENT ON TABLE fullchinavzla.floor_tables IS 'Mapa de mesas del salon (posicion, zona, forma, capacidad)';

CREATE OR REPLACE FUNCTION fullchinavzla.fn_touch_floor_table_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_floor_tables_updated_at ON fullchinavzla.floor_tables;
CREATE TRIGGER trg_floor_tables_updated_at
  BEFORE UPDATE ON fullchinavzla.floor_tables
  FOR EACH ROW EXECUTE FUNCTION fullchinavzla.fn_touch_floor_table_updated_at();

-- Semilla: las 10 mesas que ya se usaban en el selector de Caja, en una
-- grilla de 5x2 (posiciones en % del lienzo). Solo si la tabla está vacía.
INSERT INTO fullchinavzla.floor_tables (number, zone, shape, seats, pos_x, pos_y)
SELECT n,
       'Salón',
       'square',
       4,
       10 + ((n - 1) % 5) * 18,
       15 + ((n - 1) / 5) * 35
FROM generate_series(1, 10) AS n
WHERE NOT EXISTS (SELECT 1 FROM fullchinavzla.floor_tables);

ALTER TABLE fullchinavzla.floor_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read floor tables" ON fullchinavzla.floor_tables;
CREATE POLICY "Staff can read floor tables"
  ON fullchinavzla.floor_tables
  FOR SELECT
  TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager', 'cashier'));

DROP POLICY IF EXISTS "Managers can insert floor tables" ON fullchinavzla.floor_tables;
CREATE POLICY "Managers can insert floor tables"
  ON fullchinavzla.floor_tables
  FOR INSERT
  TO authenticated
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS "Managers can update floor tables" ON fullchinavzla.floor_tables;
CREATE POLICY "Managers can update floor tables"
  ON fullchinavzla.floor_tables
  FOR UPDATE
  TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS "Managers can delete floor tables" ON fullchinavzla.floor_tables;
CREATE POLICY "Managers can delete floor tables"
  ON fullchinavzla.floor_tables
  FOR DELETE
  TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

REVOKE ALL ON fullchinavzla.floor_tables FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.floor_tables TO authenticated;
GRANT ALL ON fullchinavzla.floor_tables TO service_role;

-- Vista: mesas + estado de ocupacion (a partir de ordenes abiertas dine-in).
CREATE OR REPLACE VIEW fullchinavzla.v_floor_tables_status
WITH (security_invoker = true) AS
SELECT
  ft.id,
  ft.number,
  ft.zone,
  ft.shape,
  ft.seats,
  ft.pos_x,
  ft.pos_y,
  ft.is_active,
  o.id AS open_order_id,
  o.order_number AS open_order_number,
  o.customer_name AS open_order_customer,
  o.created_at AS open_order_created_at,
  COALESCE((
    SELECT SUM(oi.quantity * oi.unit_price)
    FROM fullchinavzla.order_items oi
    WHERE oi.order_id = o.id
  ), 0) AS open_order_total
FROM fullchinavzla.floor_tables ft
LEFT JOIN LATERAL (
  SELECT o2.id, o2.order_number, o2.customer_name, o2.created_at
  FROM fullchinavzla.orders o2
  WHERE o2.table_number = ft.number
    AND o2.order_type = 'dine-in'
    AND o2.status = 'open'
  ORDER BY o2.created_at ASC
  LIMIT 1
) o ON true;

REVOKE ALL ON fullchinavzla.v_floor_tables_status FROM PUBLIC, anon;
GRANT SELECT ON fullchinavzla.v_floor_tables_status TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
