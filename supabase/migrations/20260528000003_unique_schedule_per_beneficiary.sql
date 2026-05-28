-- Migration : 1 seul planning par bénéficiaire
--
-- 1. Supprimer les doublons existants : garde la row la plus récente
--    (par created_at) pour chaque beneficiary_id, supprime les autres.
-- 2. Ajouter une contrainte UNIQUE sur beneficiary_id pour empêcher
--    toute future création multiple.

-- ============================================================================
-- 1. Cleanup des doublons
-- ============================================================================

DELETE FROM session_schedules
WHERE id NOT IN (
  SELECT DISTINCT ON (beneficiary_id) id
  FROM session_schedules
  ORDER BY beneficiary_id, created_at DESC
);

-- ============================================================================
-- 2. Contrainte UNIQUE
-- ============================================================================

ALTER TABLE session_schedules
  ADD CONSTRAINT session_schedules_beneficiary_unique
  UNIQUE (beneficiary_id);
