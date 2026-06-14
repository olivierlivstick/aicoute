-- Migration : identité détaillée des aidants (personne physique / morale)
--
-- Ajoute sur `profiles` :
--   - account_type : 'individual' (personne physique) | 'organization' (personne morale)
--   - first_name / last_name : identité (physique) OU contact principal (morale)
--   - company_name : raison sociale (morale uniquement, nullable)
--   - adresse postale : address_line / postal_code / city / country
--
-- `full_name` est CONSERVÉ et reste synchronisé (= « prénom nom » pour une
-- personne physique, = raison sociale pour une personne morale) afin de ne pas
-- toucher aux listes / en-têtes / emails qui le lisent déjà. Même logique que
-- birth_date → birth_year côté bénéficiaires.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (account_type IN ('individual', 'organization')),
  ADD COLUMN IF NOT EXISTS first_name   TEXT,
  ADD COLUMN IF NOT EXISTS last_name    TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS postal_code  TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS country      TEXT DEFAULT 'France';

-- Backfill best-effort des comptes existants (tous traités en personne physique) :
-- 1er mot de full_name → prénom, le reste → nom.
UPDATE profiles
SET first_name = NULLIF(split_part(full_name, ' ', 1), ''),
    last_name  = NULLIF(TRIM(regexp_replace(full_name, '^\S+\s*', '')), '')
WHERE first_name IS NULL
  AND last_name IS NULL
  AND COALESCE(full_name, '') <> '';

-- Trigger de création de profil : lit les nouveaux champs depuis les metadata
-- auth et calcule full_name. ⚠️ SET search_path = public requis (cf. bug connu).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta            jsonb := NEW.raw_user_meta_data;
  v_account_type  text  := COALESCE(meta->>'account_type', 'individual');
  v_first_name    text  := NULLIF(meta->>'first_name', '');
  v_last_name     text  := NULLIF(meta->>'last_name', '');
  v_company_name  text  := NULLIF(meta->>'company_name', '');
  v_full_name     text;
BEGIN
  IF v_account_type = 'organization' THEN
    v_full_name := COALESCE(v_company_name, NULLIF(meta->>'full_name', ''), '');
  ELSE
    v_full_name := COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ', v_first_name, v_last_name)), ''),
      NULLIF(meta->>'full_name', ''),
      ''
    );
  END IF;

  INSERT INTO profiles (id, full_name, email, role, account_type, first_name, last_name, company_name)
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    COALESCE(meta->>'role', 'caregiver'),
    v_account_type,
    v_first_name,
    v_last_name,
    CASE WHEN v_account_type = 'organization' THEN v_company_name ELSE NULL END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
