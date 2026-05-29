-- Migration : la fonction trigger_regenerate_future_calls() lit ses secrets
-- depuis Supabase Vault au lieu de current_setting('app.settings.*').
--
-- Pourquoi : Supabase managé n'autorise pas ALTER DATABASE SET app.settings.*
-- (permission denied superuser). Les current_setting() retournent NULL → le
-- net.http_post part vers 'NULL/functions/...' → silent fail.
--
-- Pré-requis : les secrets 'supabase_url' et 'service_role_key' doivent être
-- présents dans vault.secrets (cf. SELECT vault.create_secret(...)).
--
-- SECURITY DEFINER pour que la fonction puisse lire vault.decrypted_secrets
-- (qui n'est pas accessible aux rôles non-privilégiés par défaut). Le trigger
-- ne fait qu'un POST vers une Edge Function — pas d'escalade de privilèges
-- effective.

CREATE OR REPLACE FUNCTION trigger_regenerate_future_calls()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_schedule_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- En INSERT/UPDATE : NEW dispo ; en DELETE : OLD seulement.
  IF TG_OP = 'DELETE' THEN
    v_schedule_id := OLD.id;
  ELSE
    v_schedule_id := NEW.id;
  END IF;

  -- Lookup Vault. Si l'un des deux est absent, on ne fait rien — le fallback
  -- client (useSessionSchedule.ts → supabase.functions.invoke) compense.
  SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE '[trigger_regenerate_future_calls] Vault secrets missing — skipping POST';
    -- Sortie propre selon le mode du trigger
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/regenerate-future-calls',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body    := jsonb_build_object('schedule_id', v_schedule_id::text)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
