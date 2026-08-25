-- =============================================================================
-- Zonas de delivery reales de Full China (reemplazan las de ejemplo).
-- Editables después desde /mas → Delivery.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

DELETE FROM fullchinavzla.delivery_zones;

INSERT INTO fullchinavzla.delivery_zones (min_km, max_km, price, sort_order) VALUES
  ( 0.00,  2.00, 1.00, 10),
  ( 2.01,  3.00, 1.50, 20),
  ( 3.01,  4.50, 2.00, 30),
  ( 4.51,  7.50, 3.00, 40),
  ( 7.51, 10.50, 4.00, 50),
  (10.51, 13.50, 5.00, 60),
  (13.51, 16.50, 6.00, 70),
  (16.51, 19.50, 7.00, 80);

COMMIT;
