-- Migration : quota d'appels entrants en MINUTES/jour (et non en nombre d'appels)
--
-- Correctif de 20260608000004 (déjà appliquée). Le vrai risque financier d'un
-- canal entrant, c'est le TEMPS de conversation (tokens IA + minutes Twilio),
-- pas le nombre d'appels : un appel peut durer 1 min ou 10 min. Un budget
-- quotidien en minutes est donc la bonne unité de bornage.
--
-- On REMPLACE `inbound_max_per_day` (nb d'appels) par `inbound_max_minutes_per_day`
-- (budget de conversation/24h). DROP+ADD plutôt que RENAME : aucune donnée
-- dépendante (aucun bénéficiaire n'a encore activé l'entrant, valeurs au défaut),
-- et la sémantique change (2 → 30) donc un RENAME garderait une valeur erronée.
--
-- Enforcement (Lot 2, webhook /inbound-voice) : SUM(duration_seconds) des appels
-- inbound des dernières 24h vs (inbound_max_minutes_per_day * 60). L'index partiel
-- idx_calls_inbound_quota (beneficiary_id, created_at WHERE origin='inbound')
-- posé par 0004 sert toujours (on somme les durées au lieu de compter les lignes).

ALTER TABLE beneficiaries
  DROP COLUMN IF EXISTS inbound_max_per_day;

ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS inbound_max_minutes_per_day INT NOT NULL DEFAULT 30;

COMMENT ON COLUMN beneficiaries.inbound_max_minutes_per_day IS 'Budget quotidien (minutes) de conversation entrante accepté par bénéficiaire. Au-delà, les appels entrants sont refusés jusqu''à la fenêtre suivante.';
