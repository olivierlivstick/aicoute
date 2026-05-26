-- Migration 006: Configuration du cron Supabase + initialisation next_scheduled_at

-- Activer l'extension pg_cron (disponible sur Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;   -- Pour les appels HTTP depuis pg_cron

-- Donner les droits à pg_cron
GRANT USAGE ON SCHEMA cron TO postgres;

-- Cron job : déclencher schedule-calls toutes les minutes
-- Le job appelle l'Edge Function via HTTP (pg_net)
SELECT cron.schedule(
  'modect-schedule-calls',            -- Nom unique du job
  '* * * * *',                        -- Toutes les minutes
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/schedule-calls',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Trigger: recalculer next_scheduled_at à la création d'un planning
CREATE OR REPLACE FUNCTION recalculate_next_scheduled_at()
RETURNS TRIGGER AS $$
DECLARE
  v_next TIMESTAMPTZ;
BEGIN
  v_next := calculate_next_scheduled_at(
    NEW.days_of_week,
    NEW.time_of_day,
    NEW.timezone
  );
  NEW.next_scheduled_at := v_next;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_schedule_calc_next
  BEFORE INSERT OR UPDATE OF days_of_week, time_of_day, timezone, is_active
  ON session_schedules
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION recalculate_next_scheduled_at();

-- Vue utilitaire : plannings avec statut en temps réel
CREATE OR REPLACE VIEW v_active_schedules AS
SELECT
  ss.id,
  ss.beneficiary_id,
  ss.caregiver_id,
  b.first_name || ' ' || b.last_name AS beneficiary_name,
  ss.days_of_week,
  ss.time_of_day,
  ss.timezone,
  ss.max_duration_minutes,
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
