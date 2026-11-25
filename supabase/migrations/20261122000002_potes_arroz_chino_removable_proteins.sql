-- 3 Potes de Arroz Chino incluye Pollo, Camarón, Jamón y Cerdo (2 und c/u,
-- igual que los Full Kilo). Se le asigna el grupo compartido de proteínas
-- incluidas para que el cliente pueda pedirlo sin alguna de ellas.
BEGIN;

INSERT INTO fullchinavzla.sellable_product_modifiers (sellable_product_id, modifier_id)
SELECT p.id, m.id
  FROM fullchinavzla.sellable_products p
  CROSS JOIN fullchinavzla.modifiers m
 WHERE p.name = '3 Potes de Arroz Chino'
   AND m.source_system = 'fullchina' AND m.source_key = 'full-kilo-proteins'
ON CONFLICT DO NOTHING;

COMMIT;
