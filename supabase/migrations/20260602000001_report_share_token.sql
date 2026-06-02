-- Lien de partage public du compte-rendu (transcript) avec durée de vie 48h.
--
-- L'email de compte-rendu pointe désormais vers une page PUBLIQUE (sans login),
-- accessible via un jeton aléatoire non devinable porté dans l'URL (/r/:token).
-- Le jeton expire 48h après l'envoi de l'email → le transcript n'est pas exposé
-- « tout le temps ».
--
-- Sécurité : aucune lecture côté client anon ici. La page publique passe par
-- l'Edge Function `get-report` (service-role) qui vérifie le jeton + l'expiration.
-- On n'ouvre donc PAS de GRANT/policy anon sur `calls` (cf. CLAUDE.md « Table
-- créée par migration brute = pas de GRANT ») : le jeton ne donne accès qu'au
-- sous-ensemble de champs renvoyés par get-report, jamais à la table.

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS report_token             TEXT,
  ADD COLUMN IF NOT EXISTS report_token_expires_at  TIMESTAMPTZ;

-- Unicité du jeton (partiel : ignore les NULL). Non utilisé par un ON CONFLICT
-- côté client donc le caractère partiel ne pose pas le problème connu PostgREST.
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_report_token
  ON calls (report_token)
  WHERE report_token IS NOT NULL;

COMMENT ON COLUMN calls.report_token            IS 'Jeton aléatoire pour le partage public du compte-rendu (page /r/:token, sans login). NULL tant qu''aucun email envoyé.';
COMMENT ON COLUMN calls.report_token_expires_at IS 'Expiration du report_token (= envoi email + 48h). Au-delà, get-report renvoie 410 Gone.';
