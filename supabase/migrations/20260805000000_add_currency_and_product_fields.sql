-- #############################################################################
-- ##  Migración: moneda (Opción B) + campos de producto para no perder UI     ##
-- #############################################################################
--
-- SCHEMA OBJETIVO:  fullchinavzla   (NO "foodtruck" — ver LEEME-ANTES-DE-EJECUTAR.md)
--
-- Qué hace, y por qué:
--   1) orders.bcv_rate  -> Opción B de moneda. Los precios se guardan en USD
--      (unidad natural del menú). Cada orden estampa la tasa Bs/USD del día,
--      para poder reconstruir el monto en bolívares del recibo aunque la tasa
--      cambie después. Nullable: órdenes viejas pueden no tenerla.
--   2) sellable_products.cost / category / emoji -> la app (Caja, Inventario,
--      Reportes) usa estos campos para la grilla del POS y el cálculo de
--      ganancia. La tabla original no los tenía. cost es nullable a propósito:
--      los costos reales aún no se conocen (NULL = desconocido, no 0).
--
-- Es puramente aditiva: ADD COLUMN IF NOT EXISTS. No borra nada, no toca RLS,
-- no toca GRANTs (los GRANT son a nivel de tabla y cubren columnas nuevas).
--
-- CÓMO APLICAR: correr del lado servidor con el mismo rol con que se aplican las
-- migraciones (postgres/service_role), NO por la API anon. Es idempotente:
-- correrla dos veces no hace daño.
-- #############################################################################

BEGIN;

-- 1) Moneda: tasa BCV por orden -----------------------------------------------
ALTER TABLE fullchinavzla.orders
  ADD COLUMN IF NOT EXISTS bcv_rate NUMERIC(14,4)
    CHECK (bcv_rate IS NULL OR bcv_rate > 0);

COMMENT ON COLUMN fullchinavzla.orders.bcv_rate IS
  'Tasa Bs/USD (BCV) al momento de la venta. Precios/totales se guardan en USD; '
  'total en Bs = total_usd * bcv_rate. NULL = no registrada.';

-- 2) Campos de producto para la UI --------------------------------------------
ALTER TABLE fullchinavzla.sellable_products
  ADD COLUMN IF NOT EXISTS cost     NUMERIC(12,2) CHECK (cost IS NULL OR cost >= 0),
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'plato',
  ADD COLUMN IF NOT EXISTS emoji    TEXT NOT NULL DEFAULT '🍽️';

COMMENT ON COLUMN fullchinavzla.sellable_products.cost IS
  'Costo unitario en USD. NULL = desconocido (aún sin cargar). No confundir con 0.';
COMMENT ON COLUMN fullchinavzla.sellable_products.category IS
  'Categoría para agrupar en el POS: arroz | plato | wok | pollo_camaron | racion | bebida | extra';
COMMENT ON COLUMN fullchinavzla.sellable_products.emoji IS
  'Emoji mostrado en la grilla de Caja.';

COMMIT;
