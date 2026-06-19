-- Lot 1 dashboard ORGANISATION : bénéficiaires « légers » gérés en volume.
--
-- 1. Commentaire libre par bénéficiaire (colonne affichée + filtrable dans la
--    liste org ; ex. « Chambre 12 », « malentendant », etc.). Inoffensif pour
--    le parcours aidant existant (colonne nullable, jamais lue ailleurs).
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS comment TEXT;

-- 2. Accès aux enregistrements .wav par l'aidant/organisation PROPRIÉTAIRE.
--    Jusqu'ici la lecture du bucket privé `fluidity-recordings` était réservée
--    aux admins (20260611000001). L'Historique d'un bénéficiaire (côté org)
--    doit pouvoir écouter le .wav de SES appels → on ouvre la lecture à l'aidant
--    qui possède le bénéficiaire de l'appel correspondant au fichier.
--    Le voice-bridge écrit en service role (bypass RLS) → pas d'INSERT ici.
--    storage.objects.name = le chemin stocké dans calls.recording_path
--    (ex. "calls/CAxxxx.wav").
DROP POLICY IF EXISTS "caregiver_read_own_recordings" ON storage.objects;
CREATE POLICY "caregiver_read_own_recordings" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fluidity-recordings'
    AND EXISTS (
      SELECT 1
      FROM public.calls c
      JOIN public.beneficiaries b ON b.id = c.beneficiary_id
      WHERE c.recording_path = storage.objects.name
        AND b.caregiver_id = auth.uid()
    )
  );
