-- Migration : autoriser un admin à SUPPRIMER un appel
--
-- La migration 003 (admin_role) ouvrait SELECT + INSERT + UPDATE sur `calls`
-- aux admins, mais pas DELETE. Le back-office /admin/appels (onglet « prévus »)
-- a besoin d'effacer un appel planifié → on ajoute la policy DELETE.

DROP POLICY IF EXISTS "admin_all_calls_delete" ON calls;
CREATE POLICY "admin_all_calls_delete" ON calls
  FOR DELETE
  USING (is_admin());
