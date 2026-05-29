-- Migration : pré-création des calls futurs (au lieu du juste-in-time)
--
-- Changement de design : les calls correspondant aux créneaux récurrents sont
-- pré-créés à l'avance sur un horizon de 15 jours, plutôt que créés par la
-- passe A de schedule-calls juste avant l'exécution. Bénéfices :
--   - stats SQL faciles ('combien d'appels prévus la semaine prochaine ?')
--   - traçabilité claire de chaque créneau (et de chaque tentative en parallèle)
--   - séparation propre 'date prévue' (scheduled_at, immutable) vs 'date
--     effective' (notified_at, écrit par initiate-call au moment du POST Twilio)
--   - le bouton « Déclencher maintenant » du back-office admin peut anticiper
--     un créneau sans toucher à scheduled_at — diff visible sur les rapports
--
-- 1. UNIQUE partial index pour rendre la régénération idempotente (un même
--    créneau pour un même planning ne peut exister qu'une fois). NULL exclu
--    pour ne pas casser les calls ad-hoc (relances admin sans schedule_id).
--
-- 2. Trigger AFTER INSERT/UPDATE/DELETE sur session_schedules qui appelle
--    l'Edge Function regenerate-future-calls via pg_net. Belt+suspenders avec
--    l'appel côté client (cf. useSessionSchedule.ts).

-- ============================================================================
-- 1. UNIQUE partial index
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_schedule_creneau_unique
  ON calls (schedule_id, scheduled_at)
  WHERE schedule_id IS NOT NULL;

-- ============================================================================
-- 2. Trigger AFTER sur session_schedules → POST regenerate-future-calls
-- ============================================================================
-- Le trigger est asynchrone (pg_net est non-bloquant) et idempotent côté
-- Edge Function via le UNIQUE index ci-dessus.
--
-- On passe le schedule_id dans le payload pour limiter le scope de la
-- régénération à un schedule. NULL côté DELETE (on n'a plus la row).

CREATE OR REPLACE FUNCTION trigger_regenerate_future_calls()
RETURNS TRIGGER AS $$
DECLARE
  v_schedule_id UUID;
BEGIN
  -- En INSERT/UPDATE : NEW est dispo ; en DELETE : OLD seulement.
  IF TG_OP = 'DELETE' THEN
    v_schedule_id := OLD.id;
  ELSE
    v_schedule_id := NEW.id;
  END IF;

  PERFORM net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/regenerate-future-calls',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body    := jsonb_build_object('schedule_id', v_schedule_id::text)
  );

  -- Trigger AFTER : on retourne juste pour la convention plpgsql.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS session_schedules_regenerate_calls ON session_schedules;
CREATE TRIGGER session_schedules_regenerate_calls
  AFTER INSERT OR UPDATE OF days_of_week, time_of_day, timezone, is_active, calls_per_week, max_duration_minutes
        OR DELETE
  ON session_schedules
  FOR EACH ROW
  EXECUTE FUNCTION trigger_regenerate_future_calls();
