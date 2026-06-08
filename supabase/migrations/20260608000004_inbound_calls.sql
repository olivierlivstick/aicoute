-- Migration : appels ENTRANTS (le bénéficiaire appelle AICOUTE) — Lot 1 (garde-fous)
--
-- Aujourd'hui AICOUTE n'appelle QUE en sortant (planifié Twilio). Cette feature
-- ouvre un canal entrant : un bénéficiaire identifié à son numéro peut composer
-- le numéro AICOUTE et l'IA décroche avec tout son contexte (mémoire + dernier
-- appel). L'AIDANT (titulaire du compte) autorise ou non ce canal, par
-- bénéficiaire, depuis /contexte.
--
-- ENJEU CENTRAL = risque financier → les garde-fous viennent AVANT le câblage
-- technique (webhook Twilio = Lot 2). Cette migration pose uniquement le modèle
-- de données + les bornes par bénéficiaire.

-- ── beneficiaries : interrupteur + quotas par bénéficiaire ───────────────────
-- Mêmes droits que report_recipients (colonnes ajoutées à une table déjà
-- GRANT-ée → l'aidant les édite via la RLS existante, aucun GRANT à rajouter).

ALTER TABLE beneficiaries
  -- Interrupteur maître. OFF par défaut : aucun bénéficiaire ne peut appeler
  -- tant que l'aidant ne l'a pas explicitement activé. OFF → le voice-bridge
  -- répond <Reject> instantané (coût Twilio ~0).
  ADD COLUMN IF NOT EXISTS inbound_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Quota d'appels entrants par fenêtre glissante de 24h. Anti-dérive coût.
  ADD COLUMN IF NOT EXISTS inbound_max_per_day INT NOT NULL DEFAULT 2,
  -- Délai minimum entre deux appels entrants (anti-boucle / rappel compulsif).
  ADD COLUMN IF NOT EXISTS inbound_cooldown_minutes INT NOT NULL DEFAULT 30,
  -- Coupe-circuit de durée, propre aux entrants (plus court que les 900s des
  -- appels planifiés). Le voice-bridge raccroche au-delà.
  ADD COLUMN IF NOT EXISTS inbound_max_duration_seconds INT NOT NULL DEFAULT 600;

COMMENT ON COLUMN beneficiaries.inbound_enabled IS 'Le bénéficiaire est-il autorisé à appeler AICOUTE (canal entrant) ? OFF par défaut ; activé par l''aidant dans /contexte.';
COMMENT ON COLUMN beneficiaries.inbound_max_per_day IS 'Quota d''appels entrants acceptés par fenêtre glissante de 24h.';
COMMENT ON COLUMN beneficiaries.inbound_cooldown_minutes IS 'Délai minimum (minutes) entre deux appels entrants acceptés.';
COMMENT ON COLUMN beneficiaries.inbound_max_duration_seconds IS 'Durée maximale (secondes) d''un appel entrant avant coupe-circuit serveur.';

-- ── calls : origine de l'appel ───────────────────────────────────────────────
-- Point structurant. Distingue partout un entrant d'un planifié (worker, stats
-- scheduled_at, UI historique). Défaut 'scheduled' → tout l'historique existant
-- reste correct sans backfill.
--
-- Les lignes 'inbound' naissent directement en status='in_progress', sans
-- schedule_id, attempt_number=1 → invisibles pour schedule-calls (passes A/B/C
-- ne ciblent que 'scheduled'/'notified') ET pour regenerate-future-calls (ne
-- touche que les lignes d'un schedule_id donné). scheduled_at (NOT NULL) sera
-- posé à now() par le voice-bridge à la création. La contrainte UNIQUE
-- (schedule_id, scheduled_at) est non-partial et NULL-distinct → aucun conflit
-- entre lignes inbound même au même instant.
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (origin IN ('scheduled', 'inbound'));

COMMENT ON COLUMN calls.origin IS 'Origine de l''appel : ''scheduled'' (sortant planifié Twilio, défaut) ou ''inbound'' (le bénéficiaire a appelé AICOUTE).';

-- Index dédié au calcul du quota entrant :
--   COUNT(*) WHERE origin='inbound' AND beneficiary_id=? AND created_at > now()-24h
CREATE INDEX IF NOT EXISTS idx_calls_inbound_quota
  ON calls(beneficiary_id, created_at)
  WHERE origin = 'inbound';
