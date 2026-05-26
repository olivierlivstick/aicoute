-- Migration 003: Table session_schedules (planification récurrente)

CREATE TABLE session_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES profiles(id),

  -- Récurrence
  days_of_week INT[] NOT NULL,           -- [2, 4] = mardi et jeudi (0=dim, 1=lun, ...)
  time_of_day TIME NOT NULL,             -- ex: '10:00:00'
  timezone TEXT DEFAULT 'Europe/Paris',

  -- Durée et contenu
  max_duration_minutes INT DEFAULT 15,
  suggested_topics TEXT[],
  special_instructions TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  next_scheduled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caregiver_owns_schedule" ON session_schedules
  USING (caregiver_id = auth.uid());

CREATE TRIGGER session_schedules_updated_at
  BEFORE UPDATE ON session_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction utilitaire : calculer la prochaine occurrence
CREATE OR REPLACE FUNCTION calculate_next_scheduled_at(
  p_days_of_week INT[],
  p_time_of_day TIME,
  p_timezone TEXT
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_today_local DATE;
  v_time_today TIMESTAMPTZ;
  v_day INT;
  v_candidate TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
  v_days_ahead INT;
BEGIN
  v_now := NOW() AT TIME ZONE p_timezone;
  v_today_local := (v_now)::DATE;

  -- Tenter aujourd'hui d'abord (si l'heure n'est pas passée)
  v_time_today := (v_today_local || ' ' || p_time_of_day)::TIMESTAMP AT TIME ZONE p_timezone;

  IF v_time_today > NOW() AND EXTRACT(DOW FROM v_today_local)::INT = ANY(p_days_of_week) THEN
    RETURN v_time_today;
  END IF;

  -- Chercher le prochain jour valide dans les 7 prochains jours
  v_next := NULL;
  FOR v_days_ahead IN 1..7 LOOP
    v_candidate := ((v_today_local + v_days_ahead) || ' ' || p_time_of_day)::TIMESTAMP AT TIME ZONE p_timezone;
    IF EXTRACT(DOW FROM (v_today_local + v_days_ahead))::INT = ANY(p_days_of_week) THEN
      v_next := v_candidate;
      EXIT;
    END IF;
  END LOOP;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql;
