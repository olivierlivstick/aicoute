-- Table demo_calls : tracking des démos vitrine (web + téléphone)
-- Séparé de la table `calls` (qui concerne les vrais appels bénéficiaires)
-- pour ne pas mélanger métriques commerciales et exploitation.
-- Consultable via /track_calls protégé par DEMO_TRACK_KEY.

CREATE TABLE IF NOT EXISTS demo_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode             text NOT NULL CHECK (mode IN ('web', 'phone')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds integer,
  -- 6 premiers caractères du numéro destinataire (ex: "+33619"), NULL en mode web.
  -- On NE conserve PAS le numéro complet (engagement RGPD pris envers le visiteur).
  phone_prefix     text,
  -- Coûts estimés en euros (approximation par durée, ajustable côté code).
  twilio_cost_eur  numeric(8, 4),
  openai_cost_eur  numeric(8, 4),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_calls_started_at ON demo_calls(started_at DESC);

-- RLS activé : aucune politique = personne ne peut lire/écrire avec la clé anon.
-- Seules les Edge Functions (service role) et les opérations admin peuvent toucher la table.
ALTER TABLE demo_calls ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE demo_calls IS 'Démos vitrine www.modect.com (mode web WebRTC + mode téléphone Twilio). Consultable via /track_calls.';
COMMENT ON COLUMN demo_calls.phone_prefix IS '6 premiers chars du numéro (ex: +33619). Numéro complet jamais stocké.';
