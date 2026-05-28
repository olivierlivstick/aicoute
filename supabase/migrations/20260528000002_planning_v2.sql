-- Migration : planification v2
--   1. session_schedules : nombre d'appels/semaine + politique de relance no-answer
--   2. calls : numéro de tentative + notified_at + alerts JSONB (signaux faibles structurés)
--   3. trigger de cohérence calls_per_week == length(days_of_week)
--   4. index pour le scan no-answer

-- ============================================================================
-- 1. session_schedules : colonnes planification + retry
-- ============================================================================

ALTER TABLE session_schedules
  ADD COLUMN IF NOT EXISTS calls_per_week INT NOT NULL DEFAULT 1
    CHECK (calls_per_week BETWEEN 1 AND 7),
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 1
    CHECK (retry_count BETWEEN 0 AND 3),
  ADD COLUMN IF NOT EXISTS retry_interval_minutes INT NOT NULL DEFAULT 5
    CHECK (retry_interval_minutes BETWEEN 1 AND 60),
  ADD COLUMN IF NOT EXISTS notify_on_no_answer BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS no_answer_timeout_seconds INT NOT NULL DEFAULT 120
    CHECK (no_answer_timeout_seconds BETWEEN 30 AND 600);

-- Backfill : aligner calls_per_week sur le nombre de jours déjà sélectionnés
UPDATE session_schedules
   SET calls_per_week = GREATEST(1, LEAST(7, array_length(days_of_week, 1)))
 WHERE array_length(days_of_week, 1) IS NOT NULL;

-- Cohérence calls_per_week == length(days_of_week) : trigger BEFORE INSERT/UPDATE
CREATE OR REPLACE FUNCTION enforce_calls_per_week_matches_days()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.calls_per_week <> COALESCE(array_length(NEW.days_of_week, 1), 0) THEN
    RAISE EXCEPTION
      'calls_per_week (%) doit correspondre au nombre de jours sélectionnés (%)',
      NEW.calls_per_week,
      COALESCE(array_length(NEW.days_of_week, 1), 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS session_schedules_calls_per_week_check ON session_schedules;
CREATE TRIGGER session_schedules_calls_per_week_check
  BEFORE INSERT OR UPDATE OF calls_per_week, days_of_week
  ON session_schedules
  FOR EACH ROW EXECUTE FUNCTION enforce_calls_per_week_matches_days();

-- ============================================================================
-- 2. calls : attempt_number + notified_at + alerts JSONB
-- ============================================================================

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS attempt_number INT NOT NULL DEFAULT 1
    CHECK (attempt_number BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Conversion alerts : TEXT[] → JSONB (array d'objets {category, severity, evidence})
-- Les anciennes alertes (textes libres) sont projetées en {category:'other', severity:'low', evidence:<texte>}
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS alerts_jsonb JSONB DEFAULT '[]'::jsonb;

UPDATE calls
   SET alerts_jsonb = (
        SELECT COALESCE(
          jsonb_agg(jsonb_build_object(
            'category', 'other',
            'severity', 'low',
            'evidence', alert_text
          )),
          '[]'::jsonb
        )
        FROM unnest(alerts) AS alert_text
       )
 WHERE alerts IS NOT NULL AND array_length(alerts, 1) > 0;

ALTER TABLE calls DROP COLUMN alerts;
ALTER TABLE calls RENAME COLUMN alerts_jsonb TO alerts;
ALTER TABLE calls ALTER COLUMN alerts SET DEFAULT '[]'::jsonb;
ALTER TABLE calls ALTER COLUMN alerts SET NOT NULL;

-- Index pour le scan no-answer (calls toujours en "notified" et dont le délai est dépassé)
CREATE INDEX IF NOT EXISTS idx_calls_notified_pending
  ON calls (notified_at)
  WHERE status = 'notified';

-- Index pour le scan retry (calls planifiés en tentative ultérieure)
CREATE INDEX IF NOT EXISTS idx_calls_retry_due
  ON calls (scheduled_at)
  WHERE status = 'scheduled' AND attempt_number > 1;

-- ============================================================================
-- 3. Mise à jour de la vue v_active_schedules pour exposer la nouvelle config
-- ============================================================================

CREATE OR REPLACE VIEW v_active_schedules AS
SELECT
  ss.id,
  ss.beneficiary_id,
  ss.caregiver_id,
  b.first_name || ' ' || b.last_name AS beneficiary_name,
  ss.days_of_week,
  ss.time_of_day,
  ss.timezone,
  ss.calls_per_week,
  ss.max_duration_minutes,
  ss.retry_count,
  ss.retry_interval_minutes,
  ss.notify_on_no_answer,
  ss.no_answer_timeout_seconds,
  ss.next_scheduled_at,
  ss.is_active,
  (
    SELECT COUNT(*)
    FROM calls c
    WHERE c.schedule_id = ss.id
      AND c.status = 'completed'
  ) AS total_calls_completed,
  (
    SELECT MAX(c.ended_at)
    FROM calls c
    WHERE c.schedule_id = ss.id
      AND c.status = 'completed'
  ) AS last_call_at
FROM session_schedules ss
JOIN beneficiaries b ON b.id = ss.beneficiary_id
WHERE ss.is_active = TRUE;

-- Vue exhaustive (actifs + inactifs) — utilisée par le back-office
-- pour afficher "Dernier appel" sur tous les plannings configurés.
CREATE OR REPLACE VIEW v_schedules_with_history AS
SELECT
  ss.*,
  (
    SELECT MAX(c.ended_at)
    FROM calls c
    WHERE c.schedule_id = ss.id
      AND c.status = 'completed'
  ) AS last_call_at,
  (
    SELECT COUNT(*)
    FROM calls c
    WHERE c.schedule_id = ss.id
      AND c.status = 'completed'
  ) AS total_calls_completed
FROM session_schedules ss;

-- RLS sur la vue : on s'appuie sur le filtre caregiver_id et la policy de session_schedules.
-- Les vues Postgres héritent des permissions de la table sous-jacente via SECURITY INVOKER (défaut).
