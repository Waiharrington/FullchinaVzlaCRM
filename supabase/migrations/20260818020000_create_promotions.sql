-- =============================================================================
-- FULL CHINA VZLA - Tabla de promociones para el menú público
-- =============================================================================

BEGIN;

SET LOCAL ROLE supabase_admin;

-- Tabla de promociones del catálogo público
CREATE TABLE IF NOT EXISTS fullchinavzla.promotions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tag         text NOT NULL,                         -- e.g. '🔥 PROMO', '⭐ NUEVO'
  title       text NOT NULL,                         -- e.g. 'Delivery gratis'
  subtitle    text NOT NULL DEFAULT '',               -- e.g. 'En pedidos mayores a $10'
  price       text,                                   -- e.g. '12,90'
  old_price   text,                                   -- e.g. '16,00'
  note        text NOT NULL DEFAULT '',               -- e.g. 'Válido solo delivery'
  icon        text NOT NULL DEFAULT '🎁',            -- emoji
  color       text NOT NULL DEFAULT '#1b1715',        -- hex color
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int4 NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE fullchinavzla.promotions IS 'Promociones visibles en el menú público (/pedir)';

-- RLS: solo lectura pública (el menú es anónimo)
ALTER TABLE fullchinavzla.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active promotions"
  ON fullchinavzla.promotions
  FOR SELECT
  USING (is_active = true);

-- Datos iniciales
INSERT INTO fullchinavzla.promotions (tag, title, subtitle, price, old_price, note, icon, color, sort_order) VALUES
  ('🛵 PROMO',   'Delivery gratis',        'En pedidos mayores a $10',   NULL,  NULL, 'Válido solo delivery', '🛵', '#052e16', 1),
  ('⭐ NUEVO',   'Dúo Full China',         'Elige 2 platos y ahorra',   '12,90', '16,00', 'Solo en combo',       '🍱', '#7c2d12', 2),
  ('🎉 PRIMERA', '10% OFF primer pedido',  'Tu primera vez con nosotros', NULL, NULL, 'Menciona este cupón', '🎉', '#581c87', 3),
  ('⏰ HAPPY',   '2x1 en arroces',         'De 12pm a 3pm, todos los días', NULL, NULL, 'Solo para retirar',  '🍚', '#14532d', 4)
ON CONFLICT DO NOTHING;

COMMIT;
