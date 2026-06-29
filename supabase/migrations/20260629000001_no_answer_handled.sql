-- Politique no-answer / relance — découplage du statut 'notified'
--
-- Problème corrigé : la création des rappels (et l'email final) vivait dans la
-- passe B de schedule-calls, qui ne scrutait que les appels en 'notified'. Or le
-- webhook Twilio /scheduled-status (et l'AMD /scheduled-amd) passe l'appel en
-- 'missed' en quelques secondes — bien avant le timeout de la passe B — si bien
-- que la passe B ne voyait jamais l'appel et qu'AUCUN rappel n'était créé.
--
-- Fix : la passe B agit désormais sur les appels 'missed'/'failed' NON ENCORE
-- TRAITÉS (peu importe qui les a marqués). Ce marqueur dit « la politique de
-- relance a déjà statué sur cet appel » (= un rappel a été créé OU l'email final
-- a été envoyé) → traitement idempotent, robuste face à la course Twilio.

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS no_answer_handled_at TIMESTAMPTZ;

-- Backfill : tous les appels DÉJÀ terminaux sont considérés comme « arbitrés »
-- pour ne pas que la nouvelle passe B2 ressuscite des centaines de rendez-vous
-- passés (relances + emails rétroactifs). Seuls les appels non aboutis créés
-- APRÈS cette migration (no_answer_handled_at NULL) seront traités.
UPDATE calls
  SET no_answer_handled_at = COALESCE(ended_at, scheduled_at, now())
  WHERE no_answer_handled_at IS NULL
    AND status IN ('missed', 'failed', 'completed');

-- Scan de la passe B : appels d'un planning récurrent (schedule_id non NULL,
-- donc ni entrants ni campagnes) restant à arbitrer. Index partiel ciblé.
CREATE INDEX IF NOT EXISTS idx_calls_no_answer_pending
  ON calls (status)
  WHERE no_answer_handled_at IS NULL AND schedule_id IS NOT NULL;
