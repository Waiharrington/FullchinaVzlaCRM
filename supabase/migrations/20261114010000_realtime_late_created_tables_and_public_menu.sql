-- Complete the version feed for tables added after the original feed migration.
-- The public role can read only version metadata for customer-facing menu data;
-- it never receives rows from operational tables.
-- dashboard_alert_events is intentionally omitted: fn_sync_dashboard_alerts
-- writes it on every dashboard refresh, so observing it there would loop.
-- Push outbox/dispatch tables are worker-only and have no live UI consumers.

BEGIN;

DO $$
DECLARE
  target_table RECORD;
BEGIN
  -- Sweep every operational table that exists at deployment time, including
  -- tables added by later migrations that were not in the original feed.
  -- Alert history is excluded because syncing alerts writes it on every
  -- dashboard refresh. Push outbox/dispatch tables are worker-only.
  FOR target_table IN
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'fullchinavzla'
      AND tablename NOT IN (
        'data_change_versions',
        'dashboard_alert_events',
        'push_notification_outbox',
        'push_dispatch_settings',
        'push_order_created_events'
      )
  LOOP
    INSERT INTO fullchinavzla.data_change_versions (table_name)
    VALUES (target_table.tablename)
    ON CONFLICT (table_name) DO NOTHING;

    EXECUTE format(
      'DROP TRIGGER IF EXISTS fullchina_data_change_feed ON fullchinavzla.%I',
      target_table.tablename
    );
    EXECUTE format(
      'CREATE TRIGGER fullchina_data_change_feed '
      'AFTER INSERT OR UPDATE OR DELETE ON fullchinavzla.%I '
      'FOR EACH STATEMENT EXECUTE FUNCTION fullchinavzla.bump_data_change_version()',
      target_table.tablename
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS data_change_versions_public_menu_read
  ON fullchinavzla.data_change_versions;
CREATE POLICY data_change_versions_public_menu_read
  ON fullchinavzla.data_change_versions
  FOR SELECT TO anon
  USING (table_name IN (
    'sellable_products',
    'sellable_product_categories',
    'sellable_product_modifiers',
    'modifiers',
    'modifier_options',
    'menu_categories',
    'promotions',
    'delivery_config',
    'delivery_zones',
    'public_order_page_settings'
  ));
GRANT SELECT ON fullchinavzla.data_change_versions TO anon;

COMMIT;
