BEGIN;
SET LOCAL ROLE supabase_admin;
INSERT INTO fullchinavzla.units (name, symbol) VALUES ('Gramos', 'g') ON CONFLICT (symbol) DO NOTHING;
DO $$ DECLARE kg UUID; g UUID; BEGIN
  SELECT id INTO kg FROM fullchinavzla.units WHERE symbol = 'kg';
  SELECT id INTO g FROM fullchinavzla.units WHERE symbol = 'g';
  IF kg IS NOT NULL AND g IS NOT NULL THEN
    INSERT INTO fullchinavzla.unit_conversions (from_unit_id,to_unit_id,conversion_factor) VALUES (kg,g,1000) ON CONFLICT DO NOTHING;
    INSERT INTO fullchinavzla.unit_conversions (from_unit_id,to_unit_id,conversion_factor) VALUES (g,kg,0.001) ON CONFLICT DO NOTHING;
  END IF;
END $$;
RESET ROLE;
COMMIT;
