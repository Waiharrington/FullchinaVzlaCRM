-- Organización editorial del menú Full China.
-- No elimina ni desactiva productos: los nombres que no están contemplados
-- quedan visibles en la categoría "otros" para revisarlos con la dueña.
BEGIN;

WITH normalized AS (
  SELECT id,
    translate(lower(name), 'áéíóúüñ', 'aeiouun') AS product_name
  FROM fullchinavzla.sellable_products
)
UPDATE fullchinavzla.sellable_products AS product
SET category = CASE
  WHEN normalized.product_name ~ 'refresco|lipton|agua( mineral)?' THEN 'bebidas'
  WHEN normalized.product_name ~ 'promo|imperdible|pa[[:space:]]*''?[[:space:]]*todos|de panas' THEN 'promociones'
  WHEN normalized.product_name ~ 'full kilo|medio kilo|arroz con camarones y pollo|el clasico|clasico' THEN 'arroz'
  WHEN normalized.product_name ~ 'chop[[:space:]]*suey' AND normalized.product_name ~ 'veggie|mixto|especial' THEN 'chopsuey'
  WHEN normalized.product_name ~ 'pa[[:space:]]*''?[[:space:]]*dos tallarines|tallarin(es)?[[:space:]]+(especial|mixto|veggie)' THEN 'tallarines'
  WHEN normalized.product_name ~ 'vermicell?i[[:space:]]+(especial|mixto|veggie|full)' THEN 'pastas'
  WHEN normalized.product_name ~ 'pa[[:space:]]*''?[[:space:]]*mi|pa[[:space:]]*''?[[:space:]]*ti|plato[[:space:]]*[123]([^0-9]|$)|el trio|^trio([^a-z]|$)|^duo([^a-z]|$)|lomito con vegetales' THEN 'individuales'
  WHEN normalized.product_name ~ 'teque|lumpia|picadera|nuggets|pollo agridulce|costilla agridulce|camarones salteados|camarones crispy|sopa de fideos|wanton' THEN 'raciones'
  ELSE 'otros'
END
FROM normalized
WHERE product.id = normalized.id;

COMMIT;
