-- Migration : réglages de fine-tuning fluidité éditables depuis /admin/sante.
--
-- Objectif : régler les seuils d'analyse WAV (offline) ET la VAD live (Gemini /
-- OpenAI) depuis le back-office, lus À CHAUD par le voice-bridge (cache rafraîchi
-- ~15 s) → plus besoin de redémarrer Render à chaque essai.
--
-- Stockage : un seul JSONB `fluidity_tuning` sur le singleton app_settings, qui ne
-- contient QUE les clés explicitement surchargées par l'admin. Le bridge résout en
-- cascade : valeur DB (si présente + valide) → variable d'env → défaut codé. Donc
-- `{}` = comportement actuel inchangé. Clés : cf. persistence/tuning.js (TUNING_DEFS)
-- et le miroir UI AdminSante (FineTuningSection) — à garder en phase.
--
-- GRANTs : app_settings a déjà SELECT/UPDATE pour authenticated (…0001) et ALL pour
-- service_role (…0002) → la nouvelle colonne en hérite, rien à rajouter.

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS fluidity_tuning JSONB NOT NULL DEFAULT '{}'::jsonb;
