-- =============================================================================
-- FULL CHINA VZLA - FOTOS REALES DE PRODUCTO (exportadas de INVU)
-- =============================================================================
-- Agrega sellable_products.image_url y la puebla con las 37 fotos reales de INVU
-- (recorridas las 3 paginas del menu). Las imagenes se alojan en el propio
-- despliegue (public/productos/<source_code>.<ext>), sin depender de
-- images.invupos.com. Emparejamiento por source_code. Idempotente.
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

ALTER TABLE fullchinavzla.sellable_products
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN fullchinavzla.sellable_products.image_url IS
  'Ruta/URL de la foto real del producto; NULL = usar imagen generica por categoria';

UPDATE fullchinavzla.sellable_products AS sp
   SET image_url = v.path
  FROM (VALUES
    ('M1', '/productos/M1.jpg'),
    ('M11', '/productos/M11.jpg'),
    ('M12', '/productos/M12.jpg'),
    ('M13', '/productos/M13.jpg'),
    ('M14', '/productos/M14.jpg'),
    ('M15', '/productos/M15.jpg'),
    ('M16', '/productos/M16.jpg'),
    ('M17', '/productos/M17.png'),
    ('M2', '/productos/M2.jpg'),
    ('M21', '/productos/M21.jpg'),
    ('M23', '/productos/M23.jpg'),
    ('M24', '/productos/M24.jpg'),
    ('M29', '/productos/M29.png'),
    ('M3', '/productos/M3.jpg'),
    ('M30', '/productos/M30.jpg'),
    ('M32', '/productos/M32.jpg'),
    ('M34', '/productos/M34.jpg'),
    ('M35', '/productos/M35.webp'),
    ('M4', '/productos/M4.jpg'),
    ('M42', '/productos/M42.png'),
    ('M47', '/productos/M47.jpg'),
    ('M48', '/productos/M48.jpg'),
    ('M49', '/productos/M49.jpg'),
    ('M5', '/productos/M5.jpg'),
    ('M50', '/productos/M50.jpg'),
    ('M53', '/productos/M53.jpg'),
    ('M54', '/productos/M54.jpg'),
    ('M55', '/productos/M55.jpg'),
    ('M6', '/productos/M6.jpg'),
    ('M60', '/productos/M60.jpg'),
    ('M64', '/productos/M64.jpg'),
    ('M66', '/productos/M66.jpg'),
    ('M67', '/productos/M67.jpg'),
    ('M7', '/productos/M7.jpg'),
    ('M9', '/productos/M9.jpg'),
    ('P41', '/productos/P41.jpg'),
    ('P54', '/productos/P54.jpg')
  ) AS v(source_code, path)
 WHERE sp.source_code = v.source_code
   AND sp.image_url IS DISTINCT FROM v.path;

COMMIT;

-- ROLLBACK: ALTER TABLE fullchinavzla.sellable_products DROP COLUMN IF EXISTS image_url;
