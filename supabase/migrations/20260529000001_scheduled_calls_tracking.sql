-- Migration : appels planifiés via Twilio (Lot 1 du chantier "boucle d'appel")
--
-- Ajoute sur `calls` :
--   - twilio_call_sid       : id Twilio de l'appel sortant (idempotence + debug)
--   - tokens_*              : compteurs d'usage IA (snapshot final pris en bout d'appel)
--   - ai_cost_eur_real      : coût IA réel en EUR calculé à partir des tokens
--
-- Ajoute sur `beneficiaries` :
--   - notify_call_report    : enverra (oui/non) l'email rapport post-appel à l'aidant

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS twilio_call_sid           TEXT,
  ADD COLUMN IF NOT EXISTS tokens_input_audio        INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_input_audio_cached INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output_audio       INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_input_text         INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output_text        INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_cost_eur_real          NUMERIC(10, 4);

-- Idempotence : un même appel Twilio (sid) ne peut être attaché qu'à un seul call Modect
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_twilio_sid_unique
  ON calls (twilio_call_sid)
  WHERE twilio_call_sid IS NOT NULL;

ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS notify_call_report BOOLEAN NOT NULL DEFAULT TRUE;
