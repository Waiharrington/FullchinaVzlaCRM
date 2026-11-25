-- Trío: la opción "Con Camarón" cuesta USD 2,00 adicionales.
BEGIN;

UPDATE fullchinavzla.modifier_options o
   SET sale_price = 2.00, updated_at = now()
  FROM fullchinavzla.modifiers m
 WHERE o.modifier_id = m.id
   AND m.id IN (
     SELECT spm.modifier_id FROM fullchinavzla.sellable_product_modifiers spm
       JOIN fullchinavzla.sellable_products p ON p.id = spm.sellable_product_id
      WHERE p.name = 'Trío')
   AND o.source_system = 'invu' AND o.source_key = 'modifier-option:MD74'
   AND o.name = 'Con Camaron';

COMMIT;
