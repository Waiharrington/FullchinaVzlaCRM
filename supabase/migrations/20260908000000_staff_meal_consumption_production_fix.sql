-- Completa el soporte de consumos de personal en instalaciones que recibieron
-- la UI antes de las funciones de base de datos.
BEGIN;

ALTER TABLE fullchinavzla.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_reference_type_check;

ALTER TABLE fullchinavzla.stock_movements
  ADD CONSTRAINT stock_movements_reference_type_check CHECK (
    reference_type IN ('purchase_item', 'preparation_batch', 'order_item', 'manual', 'staff_meal')
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
