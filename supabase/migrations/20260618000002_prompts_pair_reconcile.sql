-- Réconciliation vers le modèle PAIRE — IDEMPOTENT, quel que soit l'état de départ.
--
-- Contexte : la migration 20260618000001 a d'abord été écrite en modèle « kind/body »
-- (une ligne par type) puis RÉÉCRITE en modèle « paire » (outbound_body + inbound_body)
-- sous LE MÊME numéro de version. Si la 1re forme a été appliquée, un nouveau
-- `supabase db push` SKIPPE 001 (version déjà jouée) → la table reste en kind/body,
-- alors que le code attend outbound_body/inbound_body → crash UI + inserts cassés.
--
-- Cette migration (numéro NEUF → toujours exécutée) convertit la table en paire si
-- besoin, et ne fait rien si elle est déjà au bon format.

-- A. beneficiaries : colonne paire `prompt_id` + reprise de l'ancien `custom_prompt_id`
--    (qui pointait sur la ligne « outbound » = future ligne paire, MÊME id), puis
--    retrait des colonnes du modèle kind.
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'beneficiaries' AND column_name = 'custom_prompt_id') THEN
    UPDATE beneficiaries
       SET prompt_id = custom_prompt_id
     WHERE prompt_id IS NULL AND custom_prompt_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE beneficiaries DROP COLUMN IF EXISTS custom_prompt_id;
ALTER TABLE beneficiaries DROP COLUMN IF EXISTS inbound_prompt_id;

-- B. prompts : convertir kind/body → outbound_body/inbound_body si modèle kind détecté.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'prompts' AND column_name = 'kind') THEN

    ALTER TABLE prompts ADD COLUMN IF NOT EXISTS outbound_body TEXT;
    ALTER TABLE prompts ADD COLUMN IF NOT EXISTS inbound_body  TEXT;

    -- Chaque ligne 'outbound' devient une PAIRE : son body = outbound_body ; on lui
    -- rattache l'inbound de la même langue (défaut/plus ancien).
    UPDATE prompts o
       SET outbound_body = o.body,
           inbound_body  = COALESCE(
             (SELECT i.body FROM prompts i
               WHERE i.language = o.language AND i.kind = 'inbound'
               ORDER BY i.is_default DESC, i.created_at ASC LIMIT 1),
             o.body)
     WHERE o.kind = 'outbound';

    -- Supprimer les lignes 'inbound' (désormais fusionnées dans les paires outbound).
    DELETE FROM prompts WHERE kind = 'inbound';

    -- Filets si des lignes restaient sans corps.
    UPDATE prompts SET outbound_body = body          WHERE outbound_body IS NULL AND body IS NOT NULL;
    UPDATE prompts SET inbound_body  = outbound_body WHERE inbound_body  IS NULL;

    ALTER TABLE prompts ALTER COLUMN outbound_body SET NOT NULL;
    ALTER TABLE prompts ALTER COLUMN inbound_body  SET NOT NULL;

    DROP INDEX IF EXISTS prompts_one_default_per_lang_kind;
    ALTER TABLE prompts DROP COLUMN IF EXISTS kind;
    ALTER TABLE prompts DROP COLUMN IF EXISTS body;
  END IF;

  -- Index « 1 défaut par langue » dans tous les cas (no-op s'il existe déjà).
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'prompts_one_default_per_lang') THEN
    CREATE UNIQUE INDEX prompts_one_default_per_lang ON prompts (language) WHERE is_default;
  END IF;
END $$;
