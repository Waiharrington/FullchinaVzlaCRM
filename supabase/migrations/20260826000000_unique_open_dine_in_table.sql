-- =============================================================================
-- FULL CHINA VZLA - Indice unico para evitar dos ordenes abiertas dine-in
-- =============================================================================
-- Garantiza a nivel de BD que no puede existir mas de una orden en estado
-- 'open' con order_type='dine-in' para el mismo table_number. Completa la
-- proteccion a nivel de trigger (fn_block_duplicate_open_table_order) con una
-- garantia fisica de unicidad: si el trigger falla o no esta activo, el indice
-- todavia rechaza el insert.
-- =============================================================================

BEGIN;

-- Indice parcial: solo cubre ordenes 'open' dine-in con table_number asignado.
-- PostgreSQL no permite UNIQUE con WHERE ni partial unique constraints a nivel
-- de tabla, asi que usamos un indice unique con WHERE.
CREATE UNIQUE INDEX IF NOT EXISTS
  uidx_orders_open_dine_in_single_table
  ON fullchinavzla.orders (table_number)
  WHERE status = 'open'
    AND order_type = 'dine-in'
    AND table_number IS NOT NULL;

COMMENT ON INDEX fullchinavzla.uidx_orders_open_dine_in_single_table IS
  'Garantiza que solo puede haber una orden abierta dine-in por mesa a la vez';

-- Revalidar el indice para asegurar que no hay duplicados existentes.
-- Si hay dos ordenes abiertas para la misma mesa, este comando fallara y el
-- admin debera resolver el conflicto manualmente antes de que la app use este
-- indice en produccion.
-- (En produccion real, ejecutar fuera de una migracion automatica si hay datos).

NOTIFY pgrst, 'reload schema';

COMMIT;
