-- =============================================================================
-- FULL CHINA VZLA - Trigger: bloquear dos órdenes abiertas dine-in por mesa
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION fullchinavzla.fn_block_duplicate_open_table_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fullchinavzla, pg_temp
AS $$
DECLARE
  v_conflict_id UUID;
BEGIN
  IF NEW.order_type = 'dine-in' AND NEW.table_number IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      SELECT id INTO v_conflict_id
      FROM fullchinavzla.orders
      WHERE table_number = NEW.table_number
        AND order_type = 'dine-in'
        AND status = 'open'
      LIMIT 1;

      IF v_conflict_id IS NOT NULL THEN
        RAISE EXCEPTION
          'La mesa % ya tiene una orden abierta sin cobrar. Cierra o cancela esa orden primero.',
          NEW.table_number;
      END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF (NEW.table_number IS DISTINCT FROM OLD.table_number)
         OR (NEW.order_type IS DISTINCT FROM OLD.order_type)
         OR (NEW.status IS DISTINCT FROM OLD.status) THEN

        IF NEW.order_type = 'dine-in'
           AND NEW.table_number IS NOT NULL
           AND NEW.status = 'open' THEN

          SELECT id INTO v_conflict_id
          FROM fullchinavzla.orders
          WHERE table_number = NEW.table_number
            AND order_type = 'dine-in'
            AND status = 'open'
            AND id <> NEW.id
          LIMIT 1;

          IF v_conflict_id IS NOT NULL THEN
            RAISE EXCEPTION
              'La mesa % ya tiene una orden abierta sin cobrar.',
              NEW.table_number;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_duplicate_open_table_order ON fullchinavzla.orders;
CREATE TRIGGER trg_block_duplicate_open_table_order
  BEFORE INSERT OR UPDATE OF table_number, order_type, status
  ON fullchinavzla.orders
  FOR EACH ROW
  EXECUTE FUNCTION fullchinavzla.fn_block_duplicate_open_table_order();

REVOKE ALL ON FUNCTION fullchinavzla.fn_block_duplicate_open_table_order()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fullchinavzla.fn_block_duplicate_open_table_order()
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
