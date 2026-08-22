-- Limpieza del menú Full China:
--  1) Unifica "El clasico"/"Mk clasico" en la familia "Clásico" (agrupan por
--     presentación Full/Medio Kilo).
--  2) Saca los platos reales de la categoría "otros" a su categoría correcta,
--     y unifica presentaciones partidas entre categorías.
--  3) Desactiva insumos operativos (cucharas, vasos, envases, salsas...) que no
--     deben aparecer en el menú de venta.
-- No se borra nada: las recategorizaciones sólo cambian `category`, y los
-- insumos quedan con is_active=false (recuperables).
BEGIN;

SET LOCAL ROLE supabase_admin;

-- 1) Familia "Clásico" (arroz) — renombre para agrupar presentaciones.
UPDATE fullchinavzla.sellable_products
SET name = 'Clásico — Full Kilo', category = 'arroz'
WHERE name = 'El clasico';

UPDATE fullchinavzla.sellable_products
SET name = 'Clásico — Medio Kilo', category = 'arroz'
WHERE name = 'Mk clasico';

-- 2) Recategorizaciones desde "otros".
UPDATE fullchinavzla.sellable_products
SET category = 'arroz'
WHERE category = 'otros' AND (name LIKE 'Arroz %' OR name = 'Cantones');

UPDATE fullchinavzla.sellable_products
SET category = 'chopsuey'
WHERE category = 'otros' AND name LIKE 'Chop Suey %';

UPDATE fullchinavzla.sellable_products
SET category = 'tallarines'
WHERE category = 'otros' AND name LIKE 'Chowmein %';

UPDATE fullchinavzla.sellable_products
SET category = 'raciones'
WHERE category = 'otros' AND (name LIKE 'Costillas %' OR name = 'Papas Fritas');

UPDATE fullchinavzla.sellable_products
SET category = 'extras'
WHERE category = 'otros' AND name LIKE 'Extras De Proteinas %';

UPDATE fullchinavzla.sellable_products
SET category = 'ejecutivos'
WHERE category = 'otros' AND name LIKE 'Pasta %';

UPDATE fullchinavzla.sellable_products
SET category = 'promociones'
WHERE category = 'otros' AND (name = 'Combo Familiar' OR name LIKE 'Pa%Dos' OR name LIKE 'D%Full China');

-- 3) Desactivar insumos operativos ($0.01) del menú de venta.
UPDATE fullchinavzla.sellable_products
SET is_active = false
WHERE name IN (
  'Almuerzo o Cena', 'Bolsa De 10 Kg', 'Bolsa De Papel', 'Cucharas',
  'Envase ct1', 'Envase Ct2', 'Platos', 'Salsa Agridulce', 'Salsa Soya',
  'Tenedor', 'Vasos'
);

COMMIT;
