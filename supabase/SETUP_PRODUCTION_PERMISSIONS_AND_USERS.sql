-- =============================================================================
-- FULL CHINA VZLA - SCRIPT DE PERMISOS, ROLES Y MENÚ EN PRODUCCIÓN (VPS)
-- =============================================================================
-- Instrucciones: Copia y pega este script en el Editor SQL de tu Supabase VPS
-- (https://supabase.somosdostudio.com) y haz clic en "Run".
-- =============================================================================

-- 1. OTORGAR PERMISOS EN EL ESQUEMA fullchinavzla
GRANT USAGE ON SCHEMA fullchinavzla TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA fullchinavzla TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA fullchinavzla TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA fullchinavzla TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA fullchinavzla GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fullchinavzla GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fullchinavzla GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- 2. SIEMBRA DEL MENÚ REAL (48 Platos transcritos)
INSERT INTO fullchinavzla.sellable_products (id, name, description, price, cost, category, emoji)
VALUES
  -- Super Promos & Combos
  ('prod-sp01', 'Imperdible (Super Promo)', '1 full kg arroz frito especial (jamón, pollo, cerdo, camarón) + ración pollo agridulce (8 und) + ración lumpias vegetales (2 und) + refresco 1L gratis.', 19.99, 7.80, 'combo', '🔥'),
  ('prod-sp02', 'Promo Trío', '2 platos tríos (arroz frito jamón y pollo + 4 piezas pollo agridulce + 2 lumpias vegetales) + bebida gratis.', 14.00, 5.20, 'combo', '🍱'),
  ('prod-sp03', 'Pa'' Todos (Combo Familiar)', '1 kg arroz clásico frito (jamón, pollo, huevo) + 2 raciones pollo agridulce (16 piezas) + 300g papas fritas + refresco 1L gratis.', 22.90, 8.50, 'combo', '👨‍👩‍👧‍👦'),
  ('prod-sp04', 'De Panas (Combo Compartir)', '1 kg arroz frito camarón y pollo + 12 piezas pollo agridulce + chop suey veggie + 1 ración lumpias vegetales (2 und).', 24.90, 9.20, 'combo', '🥳'),
  ('prod-sp05', 'XL Familiar (2 Kilos)', '2 kg arroz chino frito (jamón, pollo, cerdo) + ración pollo agridulce (8 piezas) + chop suey + 2 refrescos.', 28.00, 10.50, 'combo', '🏰'),
  ('prod-sp06', 'Pa'' Dos Tallarines', '2 platos tallarines mixto (carne y pollo) + Lomito con vegetales salteados al wok.', 18.00, 6.80, 'combo', '🍜'),
  ('prod-sp07', 'Cantonés Especial', 'Full kg arroz cantonés (carne, pollo, cerdo, jamón y camarones) + ración de lumpias crujientes.', 16.50, 6.20, 'combo', '🍚'),

  -- Platos Individuales y Ejecutivos
  ('prod-pi01', 'Pa'' Mí', '350g de arroz frito especial al wok con jamón y pollo, salsas de la casa.', 3.50, 1.20, 'plato', '🥡'),
  ('prod-pi02', 'Pa'' Ti', '350g de arroz frito con jamón + media ración de pollo agridulce (4 unidades).', 5.50, 2.10, 'plato', '🍗'),
  ('prod-pi03', 'Plato 1 (Arroz + Lumpia + Costilla)', 'Arroz frito especial (jamón y pollo) + 1 lumpia + costilla agridulce.', 8.00, 3.00, 'plato', '🍖'),
  ('prod-pi04', 'Plato 2 (Arroz + Papas + Costilla)', 'Arroz frito especial (jamón y pollo) + papas fritas + costilla agridulce.', 8.00, 2.90, 'plato', '🍟'),
  ('prod-pi05', 'Plato 3 (Arroz + Chop Suey + Lumpia)', '350g de arroz frito especial con pollo y jamón + chop suey + 1 lumpia.', 7.00, 2.50, 'plato', '🥦'),
  ('prod-pi06', 'El Trío (Arroz + Pollo Agridulce + Lumpia)', '350g de arroz frito especial con pollo y jamón + 2 piezas pollo agridulce + 1 lumpia.', 7.00, 2.40, 'plato', '🍱'),
  ('prod-pi07', 'Dúo (Arroz Camarón + Lumpia)', 'Arroz frito especial con camarones salteados al wok + 1 lumpia y ricas salsas.', 8.50, 3.20, 'plato', '🦐'),
  ('prod-pe01', 'Especial de la Casa (Ejecutivo)', 'Arroz blanco salteado con cebollín + vegetales salteados + chuleta ahumada + bebida gratis.', 6.90, 2.40, 'plato', '🥩'),
  ('prod-pe02', 'Boloñesa Artesanal (Ejecutivo)', 'Receta exclusiva de carne seleccionada a fuego lento con tomates frescos, especies y hierbas + bebida gratis.', 5.00, 1.80, 'plato', '🍝'),
  ('prod-pe03', 'Full Tentación (Ejecutivo)', 'Vermicellis salteados en salsa artesanal de tomates frescos con finas tiras de carne y albahaca + bebida gratis.', 8.00, 2.90, 'plato', '🍅'),
  ('prod-pe04', 'Pasta con Camarones al Ajillo (Ejecutivo)', 'Vermicellis en cremosa salsa de ajo con camarones salteados al punto y hierbas frescas + bebida gratis.', 9.00, 3.50, 'plato', '🧄'),

  -- Arroces (Kilos y Medios Kilos)
  ('prod-ar01', 'Full Kilo Especial (1 kg)', '1 kg arroz frito especial al wok con pollo, jamón, cerdo, camarón y secreto Full China.', 11.80, 4.20, 'arroz', '🍚'),
  ('prod-ar02', 'Medio Kilo Especial (1/2 kg)', '1/2 kg arroz frito especial al wok con pollo, jamón, cerdo, camarón.', 7.00, 2.50, 'arroz', '🍚'),
  ('prod-ar03', 'Arroz con Camarones y Pollo (1 kg)', '1 kg arroz frito especial al wok con pollo, camarón y toque secreto.', 9.90, 3.60, 'arroz', '🦐'),
  ('prod-ar04', 'Arroz con Camarones y Pollo (1/2 kg)', '1/2 kg arroz frito especial al wok con pollo, camarón.', 6.00, 2.20, 'arroz', '🦐'),
  ('prod-ar05', 'El Clásico (1 kg)', '1 kg arroz frito con jamón, pollo y huevo salteado al wok.', 9.90, 3.20, 'arroz', '🍳'),
  ('prod-ar06', 'El Clásico (1/2 kg)', '1/2 kg arroz frito con jamón, pollo y huevo salteado al wok.', 6.00, 1.90, 'arroz', '🍳'),
  ('prod-ar07', 'Full Kilo Cantonés (1 kg)', '1 kg arroz con full proteínas: carne, pollo, cerdo, jamón y CAMARONES + vegetales salteados.', 13.90, 5.10, 'arroz', '👑'),
  ('prod-ar08', 'Medio Kilo Cantonés (1/2 kg)', '1/2 kg arroz cantonés con carne, pollo, cerdo, jamón y camarones + vegetales.', 9.00, 3.30, 'arroz', '👑'),

  -- Tallarines & Chow Mein
  ('prod-no01', 'Tallarines Especial', 'Tallarín full especial salteado al wok con ricas salsas + vegetales mixtos (pollo, carne, camarón).', 9.00, 3.20, 'noodles', '🍜'),
  ('prod-no02', 'Tallarín Mixto', 'Tallarín salteado al wok con ricas salsas + vegetales mixtos (pollo y carne).', 8.00, 2.80, 'noodles', '🍜'),
  ('prod-no03', 'Tallarín Veggie', 'Tallarín salteado al wok con brócoli, zanahoria, calabacín y cebolla.', 6.00, 1.80, 'noodles', '🥬'),
  ('prod-no04', 'Tallarines / Vermicelli Camarón', 'Tallarín o vermicelli salteado al wok con ricas salsas y camarones.', 9.00, 3.40, 'noodles', '🦐'),
  ('prod-no05', 'Vermicelli Mixto', 'Pasta vermicelli salteada al wok con salsas de la casa + vegetales (pollo y carne).', 7.00, 2.50, 'noodles', '🥢'),
  ('prod-no06', 'Vermicelli Veggie', 'Pasta vermicelli salteada al wok con brócoli, zanahoria, calabacín y cebolla.', 5.00, 1.50, 'noodles', '🥢'),
  ('prod-no07', 'Vermicelli Full (Especial)', 'Pasta vermicelli con vegetales salteados al wok con carne, pollo y camarón.', 9.00, 3.30, 'noodles', '🔥'),

  -- Chop Suey & Wok
  ('prod-wk01', 'Chop Suey Veggie', 'Vegetales salteados al wok: zanahoria, repollo, pimentón y cebolla.', 5.00, 1.40, 'wok', '🥗'),
  ('prod-wk02', 'Chop Suey Mixto', 'Vegetales salteados al wok con ricas proteínas de pollo y carne.', 6.50, 2.30, 'wok', '🥗'),
  ('prod-wk03', 'Chop Suey Full', 'Vegetales salteados al wok con ricas proteínas de pollo, carne y CAMARONES.', 8.00, 2.90, 'wok', '🦐'),
  ('prod-wk04', 'Camarones Salteados (200g)', '200g de camarón salteado al wok con ricas salsas y vegetales.', 9.00, 3.50, 'wok', '🦐'),
  ('prod-wk05', 'Camarones Crispy (180g)', '180g de camarones al panco empanizados fritos crujientes con salsa.', 9.80, 3.80, 'wok', '🍤'),
  ('prod-wk06', 'Lomito con Vegetales', 'Especialidad de la casa: Lomito con brócoli, pimentón, zanahoria, cebolla y calabacín al wok.', 10.00, 3.90, 'wok', '🥩'),

  -- Raciones & Entradas
  ('prod-ra01', 'Teque-Teque (6 und)', '6 unidades de tequeños de queso crujientes.', 3.50, 1.10, 'racion', '🧀'),
  ('prod-ra02', 'Lumpias Sencillas (2 und)', '2 unidades de lumpias crujientes rellenas de vegetales.', 3.50, 0.90, 'racion', '🥟'),
  ('prod-ra03', 'Lumpias Especiales (2 und)', '2 unidades de lumpias crujientes de vegetales + 1 proteína a elegir (pollo, carne, jamón, camarón).', 5.00, 1.60, 'racion', '🥟'),
  ('prod-ra04', 'Picadera Full', 'Plato variado con lumpias, papas fritas, costilla y media ración de pollo agridulce.', 9.00, 3.40, 'racion', '🍱'),
  ('prod-ra05', 'Papas Fritas (200g)', '200g de papas fritas crujientes doradas.', 3.00, 0.80, 'racion', '🍟'),
  ('prod-ra06', 'Nuggets (6 piezas + Papas)', '6 piezas de nuggets de pollo El Corral + papas fritas.', 6.00, 2.10, 'racion', '🍗'),
  ('prod-ra07', 'Pollo Agridulce (8 piezas)', '8 piezas de pechuga de pollo al estilo Full China en salsa agridulce.', 6.00, 2.20, 'racion', '🐥'),
  ('prod-ra08', 'Costilla Agridulce (2 und)', '2 unidades de costillas marinadas al horno salteadas al wok y bañadas en salsa agridulce.', 6.00, 2.30, 'racion', '🍖'),
  ('prod-ra09', 'Costilla Agridulce (4 und)', '4 unidades de costillas marinadas al horno salteadas al wok y bañadas en salsa agridulce.', 12.00, 4.50, 'racion', '🍖'),
  ('prod-ra10', 'Costilla Sal y Pimienta (2 und)', '2 unidades de costillas marinadas picantes salteadas con sal y pimienta.', 6.00, 2.30, 'racion', '🌶️'),
  ('prod-ra11', 'Costilla Sal y Pimienta (4 und)', '4 unidades de costillas marinadas picantes salteadas con sal y pimienta.', 12.00, 4.50, 'racion', '🌶️'),

  -- Extras & Bebidas
  ('prod-ex01', 'Extra Camarón', 'Adicional de camarón salteado al wok.', 3.00, 1.20, 'extra', '🦐'),
  ('prod-ex02', 'Extra Pollo / Jamón / Cerdo', 'Adicional de proteína salteada al wok.', 2.00, 0.80, 'extra', '🥩'),
  ('prod-ex03', 'Refresco 1 Litro', 'Refresco de botella 1 Litro (Pepsi / Seven Up / Colita).', 2.50, 1.00, 'extra', '🥤'),
  ('prod-ex04', 'Refresco Personal 500ml', 'Refresco personal helado.', 1.50, 0.50, 'extra', '🥤'),
  ('prod-ex05', 'Agua Mineral 500ml', 'Botella de agua mineral helada.', 1.00, 0.30, 'extra', '💧')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  cost = EXCLUDED.cost,
  category = EXCLUDED.category,
  emoji = EXCLUDED.emoji;

-- 3. ASIGNACIÓN DE ROLES A USUARIOS REALES
-- Reemplaza los UUIDs por los IDs creados en Supabase Auth (Authentication > Users)
-- Ejemplo:
-- INSERT INTO fullchinavzla.user_roles (user_id, role)
-- VALUES 
--   ('UUID_DE_LA_DUENA', 'owner'),
--   ('UUID_DEL_ENCARGADO', 'manager'),
--   ('UUID_DE_LA_CAJERA', 'cashier')
-- ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
