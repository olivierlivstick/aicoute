-- Fix : la policy de lecture de prompt_templates utilisait auth.role() (peu fiable
-- selon le contexte JWT) → l'écran /admin/prompt recevait 0 ligne (zone vide alors
-- que le template existe). On passe à auth.uid() IS NOT NULL (tout utilisateur connecté).
DROP POLICY IF EXISTS "authenticated_read_prompt_templates" ON prompt_templates;
CREATE POLICY "authenticated_read_prompt_templates" ON prompt_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Backfill : les bénéficiaires créés avant la feature ont custom_prompt NULL.
-- On y copie le défaut RÉSOLU (variables remplacées par leurs valeurs concrètes),
-- comme le fait le wizard pour les nouveaux. Réplique resolvePromptPlaceholders en SQL.
UPDATE beneficiaries b
SET custom_prompt = replace(
  replace(
    replace(
      replace(
        replace(t.template, '{{persona}}', COALESCE(b.ai_persona_name, '')),
      '{{prenom}}', COALESCE(b.first_name, '')),
    '{{langue}}', CASE WHEN b.language_preference = 'fr' THEN 'français'
                       ELSE COALESCE(b.language_preference, 'français') END),
  '{{style}}', CASE b.conversation_style
                 WHEN 'warm'    THEN 'chaleureux, bienveillant et affectueux'
                 WHEN 'playful' THEN 'enjoué, léger et plein d''humour doux'
                 WHEN 'calm'    THEN 'calme, posé et rassurant'
                 WHEN 'formal'  THEN 'respectueux et traditionnel, en vouvoyant'
                 ELSE 'chaleureux et bienveillant' END),
  '{{il_elle}}', CASE b.gender WHEN 'female' THEN 'elle'
                               WHEN 'male'   THEN 'il'
                               ELSE 'il/elle' END)
FROM prompt_templates t
WHERE t.id = 1 AND b.custom_prompt IS NULL;
