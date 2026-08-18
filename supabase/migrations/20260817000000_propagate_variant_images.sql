-- =============================================================================
-- FULL CHINA VZLA - Propagar la foto del producto padre a sus variantes
-- =============================================================================
-- Los productos vendibles reales son variantes con source_code compuesto
-- (ej. 'M1:MD2' = Arroz Cantones Fullkilo). Las fotos de INVU se asignaron al
-- padre (source_code 'M1'), dejando las variantes sin foto → el menú caía a una
-- imagen genérica equivocada. Esto copia image_url del padre a cada variante que
-- no tenga foto. Misma comida, distinto tamaño = misma foto. Idempotente.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

UPDATE fullchinavzla.sellable_products v
   SET image_url = p.image_url,
       updated_at = now()
  FROM fullchinavzla.sellable_products p
 WHERE v.image_url IS NULL
   AND v.source_code LIKE '%:%'
   AND p.source_code = split_part(v.source_code, ':', 1)
   AND p.image_url IS NOT NULL;

COMMIT;

-- ROLLBACK: no aplica limpio (no se sabe qué fotos eran heredadas); si hiciera
-- falta, poner image_url = NULL en las variantes con source_code LIKE '%:%'.
