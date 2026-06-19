-- Lot 3 dashboard ORGANISATION : cron du MOTEUR de campagnes.
--
-- Déclenche l'Edge Function campaign-dispatch toutes les minutes (jumeau de
-- modect-schedule-calls). Lit les secrets dans Supabase Vault via une fonction
-- SECURITY DEFINER — comme trigger_regenerate_future_calls (20260529000007) —
-- car Supabase managé interdit ALTER DATABASE SET app.settings.* (les
-- current_setting('app.settings.*') retournent NULL → POST vers 'NULL/...').
--
-- Pré-requis : les secrets 'supabase_url' et 'service_role_key' sont déjà dans
-- vault.secrets (utilisés par la régénération des appels). Sinon, la fonction
-- ne fait rien (le moteur ne tournera pas tant qu'ils ne sont pas présents).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'supabase_url'      LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE '[dispatch_campaigns] Vault secrets missing — skipping POST';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/campaign-dispatch',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- (Re)programme le job toutes les minutes — idempotent (désinscrit l'ancien s'il existe).
DO $$
BEGIN
  PERFORM cron.unschedule('aicoute-campaign-dispatch');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule('aicoute-campaign-dispatch', '* * * * *', $$ SELECT public.dispatch_campaigns(); $$);
