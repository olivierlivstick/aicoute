-- Migration : remplacer le UNIQUE partial index par un UNIQUE constraint non-partial
--
-- Le partial index posé par 20260529000005 ne peut pas être utilisé par
-- `INSERT ... ON CONFLICT (schedule_id, scheduled_at)` sans répéter la clause
-- WHERE, ce que PostgREST (supabase.upsert) ne sait pas faire. Résultat :
-- l'upsert renvoie « there is no unique or exclusion constraint matching the
-- ON CONFLICT specification ».
--
-- Solution : index/constraint NON-partial. NULL est considéré distinct par
-- défaut en PG, donc plusieurs calls ad-hoc (schedule_id NULL) au même
-- scheduled_at restent autorisés — la sémantique fonctionnelle est identique.

DROP INDEX IF EXISTS idx_calls_schedule_creneau_unique;

-- ADD CONSTRAINT pour qu'ON CONFLICT puisse l'inférer proprement. IF NOT EXISTS
-- n'existe pas pour ADD CONSTRAINT, on utilise donc un bloc DO + lookup.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calls_schedule_creneau_unique'
      AND conrelid = 'calls'::regclass
  ) THEN
    ALTER TABLE calls
      ADD CONSTRAINT calls_schedule_creneau_unique
      UNIQUE (schedule_id, scheduled_at);
  END IF;
END $$;
