-- Langue des RETOURS (compte-rendu) — distincte de la langue de CONVERSATION.
--
-- Contexte : `beneficiaries.language_preference` pilote déjà la langue PARLÉE
-- pendant l'appel. On ajoute ici la langue dans laquelle la conversation est
-- ANALYSÉE puis RETRANSMISE à l'aidant : résumé, thèmes, alertes, email, et la
-- page publique /r/:token. Cas d'usage : un bénéficiaire parle anglais mais
-- l'aidant veut son compte-rendu en français (ou inversement).
--
-- Deux colonnes :
--   1. beneficiaries.report_language = le RÉGLAGE (éditable par l'aidant).
--   2. calls.report_language        = un SNAPSHOT écrit par generate-summary au
--      moment de la génération. Ainsi un rapport déjà produit garde sa langue
--      même si l'aidant change le réglage ensuite (le texte stocké et les
--      libellés affichés restent cohérents). NULL sur les anciens appels →
--      fallback 'fr' côté lecture (email / UI).
--
-- La mémoire long-terme (conversation_memory) reste, elle, dans la langue de
-- CONVERSATION (elle est réinjectée dans les appels suivants) — géré côté
-- generate-summary, pas de colonne dédiée.

ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS report_language TEXT NOT NULL DEFAULT 'fr';

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS report_language TEXT;

COMMENT ON COLUMN beneficiaries.report_language IS 'Langue des comptes-rendus (résumé/alertes/email/page publique) retransmis à l''aidant. Distincte de language_preference (langue parlée). Défaut ''fr''.';
COMMENT ON COLUMN calls.report_language IS 'Snapshot de beneficiaries.report_language au moment de la génération du compte-rendu (generate-summary). NULL sur les appels antérieurs → fallback ''fr'' à la lecture.';
