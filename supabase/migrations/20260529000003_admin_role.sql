-- Migration : rôle admin + RLS étendues pour le back-office /admin
--
-- 1. Élargit le CHECK de profiles.role pour autoriser 'admin'
-- 2. Helper SQL is_admin() qui lit le rôle de auth.uid()
-- 3. Policies RLS additionnelles : un admin voit/modifie TOUTES les rows des
--    tables sensibles, sans casser les policies caregiver existantes (les
--    policies Postgres sont OU-isées entre elles).
--
-- Pour rendre un compte admin manuellement (une fois la migration appliquée) :
--   UPDATE profiles SET role = 'admin' WHERE email = '<email-du-compte>';

-- ============================================================================
-- 1. CHECK élargi
-- ============================================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('caregiver', 'beneficiary', 'admin'));

-- ============================================================================
-- 2. Helper is_admin()
-- ============================================================================
-- SECURITY DEFINER pour pouvoir lire profiles depuis l'intérieur d'une policy
-- sans déclencher la RLS de profiles (qui retournerait `false` car le SELECT
-- est filtré par auth.uid() = id, ce qui empêcherait toute autre policy de
-- vérifier le rôle d'un autre user — pas le cas ici puisqu'on lit auth.uid()).
-- STABLE permet à Postgres de mémoriser le résultat pendant la durée de la
-- requête (l'auth.uid() ne change pas pendant un SELECT).

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================================
-- 3. Policies admin (additives ; ne touchent pas aux policies caregiver)
-- ============================================================================

-- profiles : un admin voit tous les profils
DROP POLICY IF EXISTS "admin_all_profiles" ON profiles;
CREATE POLICY "admin_all_profiles" ON profiles
  FOR SELECT
  USING (is_admin());

-- beneficiaries : un admin voit tous les bénéficiaires
DROP POLICY IF EXISTS "admin_all_beneficiaries" ON beneficiaries;
CREATE POLICY "admin_all_beneficiaries" ON beneficiaries
  FOR SELECT
  USING (is_admin());

-- session_schedules : un admin voit tous les plannings
DROP POLICY IF EXISTS "admin_all_session_schedules" ON session_schedules;
CREATE POLICY "admin_all_session_schedules" ON session_schedules
  FOR SELECT
  USING (is_admin());

-- calls : un admin voit tous les calls ET peut les modifier (relancer un raté)
DROP POLICY IF EXISTS "admin_all_calls_select" ON calls;
CREATE POLICY "admin_all_calls_select" ON calls
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "admin_all_calls_insert" ON calls;
CREATE POLICY "admin_all_calls_insert" ON calls
  FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_all_calls_update" ON calls;
CREATE POLICY "admin_all_calls_update" ON calls
  FOR UPDATE
  USING (is_admin());

-- conversation_memory : un admin voit toutes les mémoires (debug d'un agent)
DROP POLICY IF EXISTS "admin_all_conversation_memory" ON conversation_memory;
CREATE POLICY "admin_all_conversation_memory" ON conversation_memory
  FOR SELECT
  USING (is_admin());

-- demo_calls : un admin voit toutes les démos (en plus de l'accès via /track_calls)
DROP POLICY IF EXISTS "admin_all_demo_calls" ON demo_calls;
CREATE POLICY "admin_all_demo_calls" ON demo_calls
  FOR SELECT
  USING (is_admin());
