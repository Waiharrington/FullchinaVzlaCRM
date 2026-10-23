-- Protect the legacy public service reference tables without breaking reads.
-- Anonymous and authenticated clients retain SELECT; only FullChina owners
-- may insert, update, or delete rows.

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_strategies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.service_categories, public.service_strategies FROM anon, authenticated;
GRANT SELECT ON TABLE public.service_categories, public.service_strategies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.service_categories, public.service_strategies TO authenticated;

DROP POLICY IF EXISTS fullchina_service_categories_read ON public.service_categories;
CREATE POLICY fullchina_service_categories_read
  ON public.service_categories FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS fullchina_service_categories_owner_write ON public.service_categories;
CREATE POLICY fullchina_service_categories_owner_write
  ON public.service_categories FOR ALL TO authenticated
  USING (fullchinavzla.get_current_user_role() = 'owner')
  WITH CHECK (fullchinavzla.get_current_user_role() = 'owner');

DROP POLICY IF EXISTS fullchina_service_strategies_read ON public.service_strategies;
CREATE POLICY fullchina_service_strategies_read
  ON public.service_strategies FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS fullchina_service_strategies_owner_write ON public.service_strategies;
CREATE POLICY fullchina_service_strategies_owner_write
  ON public.service_strategies FOR ALL TO authenticated
  USING (fullchinavzla.get_current_user_role() = 'owner')
  WITH CHECK (fullchinavzla.get_current_user_role() = 'owner');
