CREATE TABLE IF NOT EXISTS fullchinavzla.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  description TEXT,
  message TEXT NOT NULL,
  schedule_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES fullchinavzla.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fullchinavzla.whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_templates_select ON fullchinavzla.whatsapp_templates;
CREATE POLICY whatsapp_templates_select ON fullchinavzla.whatsapp_templates FOR SELECT TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

DROP POLICY IF EXISTS whatsapp_templates_write ON fullchinavzla.whatsapp_templates;
CREATE POLICY whatsapp_templates_write ON fullchinavzla.whatsapp_templates FOR ALL TO authenticated
  USING (fullchinavzla.get_current_user_role() IN ('owner', 'manager'))
  WITH CHECK (fullchinavzla.get_current_user_role() IN ('owner', 'manager'));

GRANT SELECT, INSERT, UPDATE, DELETE ON fullchinavzla.whatsapp_templates TO authenticated, service_role;
