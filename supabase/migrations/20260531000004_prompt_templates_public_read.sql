-- L'écran /admin/prompt restait vide : la lecture RLS dépendait de l'auth
-- (auth.role() puis auth.uid()), peu fiable selon le contexte de la requête
-- côté client. Le template par défaut n'est PAS secret (instructions IA
-- génériques, aucune donnée personnelle) → on ouvre la lecture à tous.
-- L'écriture reste réservée aux admins (admin_update_prompt_templates).
DROP POLICY IF EXISTS "authenticated_read_prompt_templates" ON prompt_templates;
DROP POLICY IF EXISTS "read_prompt_templates" ON prompt_templates;
CREATE POLICY "read_prompt_templates" ON prompt_templates
  FOR SELECT
  USING (true);
