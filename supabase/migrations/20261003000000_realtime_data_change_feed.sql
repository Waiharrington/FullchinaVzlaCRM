-- Compact change feed used by the web client to refresh only affected modules.
-- This migration is versioned locally; apply it to the VPS only through the
-- project's authorized backup and migration procedure.

CREATE TABLE IF NOT EXISTS fullchinavzla.data_change_versions (
  table_name text PRIMARY KEY,
  version bigint NOT NULL DEFAULT 0,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE fullchinavzla.data_change_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_change_versions_authenticated_read
  ON fullchinavzla.data_change_versions;
CREATE POLICY data_change_versions_authenticated_read
  ON fullchinavzla.data_change_versions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
GRANT SELECT ON fullchinavzla.data_change_versions TO authenticated;

CREATE OR REPLACE FUNCTION fullchinavzla.bump_data_change_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, fullchinavzla
AS $$
BEGIN
  INSERT INTO fullchinavzla.data_change_versions (table_name, version, changed_at)
  VALUES (TG_TABLE_NAME, 1, clock_timestamp())
  ON CONFLICT (table_name) DO UPDATE
    SET version = fullchinavzla.data_change_versions.version + 1,
        changed_at = clock_timestamp();
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  target_table record;
BEGIN
  INSERT INTO fullchinavzla.data_change_versions (table_name)
  SELECT tablename
  FROM pg_catalog.pg_tables
  WHERE schemaname = 'fullchinavzla'
    AND tablename <> 'data_change_versions'
  ON CONFLICT (table_name) DO NOTHING;

  FOR target_table IN
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'fullchinavzla'
      AND tablename <> 'data_change_versions'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS fullchina_data_change_feed ON %I.%I',
      'fullchinavzla', target_table.tablename
    );
    EXECUTE format(
      'CREATE TRIGGER fullchina_data_change_feed '
      'AFTER INSERT OR UPDATE OR DELETE ON %I.%I '
      'FOR EACH STATEMENT EXECUTE FUNCTION fullchinavzla.bump_data_change_version()',
      'fullchinavzla', target_table.tablename
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Supabase publication supabase_realtime is missing; configure Realtime before this migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'fullchinavzla'
      AND tablename = 'data_change_versions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE fullchinavzla.data_change_versions';
  END IF;
END;
$$;
