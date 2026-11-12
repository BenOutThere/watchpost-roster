-- Where the database sends "wake up" calls to edge functions (email alerts, SMS dispatch).
-- Reads two Vault secrets set once per project (see SETUP.md):
--   project_url  e.g. https://<project-ref>.supabase.co
--   anon_key     the project's anon / publishable key
-- If they are missing the URL is null and the wake call is skipped with a warning (never blocks the change).
CREATE OR REPLACE FUNCTION public.edge_function_url(_name text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT rtrim(decrypted_secret, '/') || '/functions/v1/' || _name
  FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.edge_function_headers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object('Content-Type', 'application/json',
    'apikey', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1), ''))
$$;
REVOKE ALL ON FUNCTION public.edge_function_url(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.edge_function_headers() FROM PUBLIC, anon, authenticated;
