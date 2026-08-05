-- #############################################################################
-- ##  Seed: catálogo real de Full China Vzla                                  ##
-- #############################################################################
--
-- SCHEMA OBJETIVO:  fullchinavzla
--
-- Fuente: 29 capturas del Instagram @fullchinavzla (menús 2024–2025).
-- Moneda: TODO en USD (Opción B; la tasa BCV se estampa por orden, no aquí).
--
-- Leyenda de precios:
--   [REAL]  el precio aparece en la foto.
--   [PROV]  precio PROVISIONAL inventado — reemplazar cuando haya lista oficial.
-- Costos (cost): quedan en NULL a propósito. No se inventan porque alimentan el
--   cálculo de ganancia en Reportes; poner un número falso mostraría márgenes
--   irreales. Cargar los reales luego (UPDATE) o pedir placeholders aparte.
--
-- Promos (2 Tríos $10, Promo Clásico $9,90, Pa'Todos $22,90, De Panas $24,90,
--   Arroz Especial 1kg $11,80) NO van aquí: se manejan aparte, se diseñan
--   después.
--
-- Requiere la migración 20260805000000 (columnas cost/category/emoji).
-- Idempotente: ON CONFLICT (name) DO NOTHING. Correr del lado servidor.
-- #############################################################################

BEGIN;

INSERT INTO fullchinavzla.sellable_products (name, description, price, cost, category, emoji, is_active) VALUES
  -- ── Arroces ───────────────────────────────────────────────────────────────
  ('Arroz Frito Especial — Full Kilo',  'Pollo, jamón, cerdo, camarón y toque secreto FullChina. 1 kg.', 18.00, NULL, 'arroz', '🍚', true),   -- [PROV]
  ('Arroz Frito Especial — Medio Kilo', 'Pollo, jamón, cerdo, camarón y toque secreto FullChina. 1/2 kg.', 10.00, NULL, 'arroz', '🍚', true),  -- [PROV]
  ('Arroz Frito Especial — Pa''Mí (350g)', 'Pollo y jamón. Porción individual 350 g.', 6.00, NULL, 'arroz', '🍚', true),                       -- [PROV]
  ('Arroz Cantonés — Full Kilo',  'Arroz blanco con pollo, carne, jamón, camarón, chuleta ahumada y vegetales al wok. 1 kg.', 20.00, NULL, 'arroz', '🍚', true),  -- [PROV]
  ('Arroz Cantonés — Medio Kilo', 'Arroz blanco con pollo, carne, jamón, camarón, chuleta ahumada y vegetales al wok. 1/2 kg.', 11.00, NULL, 'arroz', '🍚', true), -- [PROV]

  -- ── Platos con proteína ───────────────────────────────────────────────────
  ('Trío', '350 g de arroz frito especial (pollo y jamón) + 2 piezas de pollo agridulce + 1 lumpia.', 6.00, NULL, 'plato', '🍱', true),        -- [PROV]
  ('Chuleta Ahumada', 'Arroz blanco + vegetales salteados + chuleta ahumada.', 6.90, NULL, 'plato', '🍖', true),                               -- [REAL]
  ('Costilla + Arroz Frito + Lumpia', 'Costilla agridulce + arroz frito + 1 lumpia.', 8.00, NULL, 'plato', '🍖', true),                        -- [REAL]
  ('Costilla + Arroz Frito + Papas Fritas', 'Costilla agridulce + arroz frito + papas fritas.', 8.00, NULL, 'plato', '🍖', true),              -- [REAL]
  ('Picadera', 'Costilla + pollo agridulce + lumpias + papas fritas.', 9.00, NULL, 'plato', '🍢', true),                                       -- [REAL]
  ('Costillas de Cerdo Agridulce — Full Ración', 'Costillas de cerdo agridulce. Ración completa.', 12.00, NULL, 'plato', '🍖', true),          -- [REAL]
  ('Costillas de Cerdo Agridulce — Media Ración', 'Costillas de cerdo agridulce. Media ración.', 6.00, NULL, 'plato', '🍖', true),             -- [REAL]
  ('Lomito con Vegetales', 'Lomito salteado con vegetales al wok.', 10.00, NULL, 'plato', '🥩', true),                                         -- [PROV]

  -- ── Chop Suey / Tallarín (al wok) ─────────────────────────────────────────
  ('Chop Suey Veggie', 'Vegetales salteados (zanahoria, brócoli, repollo, pimentón) y toque secreto FullChina.', 7.00, NULL, 'wok', '🥦', true),  -- [PROV]
  ('Chop Suey Mixto',  'Vegetales salteados con pollo y carne.', 9.00, NULL, 'wok', '🥡', true),                                                  -- [PROV]
  ('Chop Suey Full',   'Vegetales salteados con pollo, carne y camarón.', 11.00, NULL, 'wok', '🥡', true),                                        -- [PROV]
  ('Tallarín Veggie',    '500 g de tallarines con vegetales salteados al wok.', 7.00, NULL, 'wok', '🍜', true),                                   -- [PROV]
  ('Tallarín Mixto',     '500 g de tallarines con vegetales, pollo y carne.', 9.00, NULL, 'wok', '🍜', true),                                     -- [PROV]
  ('Tallarín Especial',  '500 g de tallarines con vegetales, pollo, cerdo y camarón.', 11.00, NULL, 'wok', '🍜', true),                           -- [PROV]

  -- ── Pollo y camarones ─────────────────────────────────────────────────────
  ('Pollo Agridulce', '7 piezas de pechuga de pollo al estilo FullChina.', 8.00, NULL, 'pollo_camaron', '🍗', true),                           -- [PROV]
  ('Camarón Salteado', '200 g de camarón al wok con vegetales salteados.', 10.00, NULL, 'pollo_camaron', '🦐', true),                          -- [PROV]
  ('Camarones Crispy', '180 g de camarón al panko con salsas de la casa.', 10.00, NULL, 'pollo_camaron', '🦐', true),                          -- [PROV]

  -- ── Raciones / entradas ───────────────────────────────────────────────────
  ('Lumpias Sencillas', 'Ración de 2 unidades.', 3.00, NULL, 'racion', '🥟', true),                                                            -- [PROV]
  ('Lumpias Especiales', 'Ración de 2 unidades.', 4.00, NULL, 'racion', '🥟', true),                                                           -- [PROV]
  ('Tequeños', '6 unidades. (También llamados Teque-Teque).', 4.00, NULL, 'racion', '🧀', true),                                               -- [PROV]
  ('Nuggets', '6 piezas + papas fritas.', 6.00, NULL, 'racion', '🍗', true),                                                                   -- [PROV]
  ('Papas Fritas', 'Porción de papas fritas.', 3.00, NULL, 'racion', '🍟', true),                                                             -- [PROV]

  -- ── Bebidas ───────────────────────────────────────────────────────────────
  ('Refresco 2 Lt', 'Refresco 2 litros.', 3.50, NULL, 'bebida', '🥤', true),                                                                  -- [PROV]
  ('Refresco 1 Lt', 'Refresco 1 litro.', 2.00, NULL, 'bebida', '🥤', true),                                                                   -- [PROV]
  ('Refresco 600 ml', 'Refresco 600 ml.', 1.50, NULL, 'bebida', '🥤', true),                                                                  -- [PROV]
  ('Agua Mineral', 'Agua mineral.', 1.00, NULL, 'bebida', '💧', true),                                                                        -- [PROV]

  -- ── Extras / adiciones (vendibles aparte) ─────────────────────────────────
  ('Extra Camarón', 'Adición de camarón.', 3.00, NULL, 'extra', '🦐', true),                                                                  -- [PROV]
  ('Extra Pollo', 'Adición de pollo.', 2.00, NULL, 'extra', '🍗', true),                                                                      -- [PROV]
  ('Extra Jamón', 'Adición de jamón.', 1.50, NULL, 'extra', '🥓', true),                                                                      -- [PROV]
  ('Extra Cerdo', 'Adición de cerdo.', 2.00, NULL, 'extra', '🥓', true)                                                                       -- [PROV]
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Verificación rápida (opcional):
--   SELECT category, count(*), min(sale_price), max(sale_price)
--   FROM fullchinavzla.sellable_products GROUP BY category ORDER BY category;
