-- ==============================================================================
-- Migrazione 0004: Permessi Schema / Ruoli API e Ricaricamento Cache PostgREST
-- Sito Vault Scout Clan — Duc In Altum
-- ==============================================================================

-- 1. Concessione permessi di utilizzo dello schema public ai ruoli Supabase
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Concessione permessi base su tutte le tabelle (sarà poi la RLS a blindare le operazioni)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 3. Protezione specifica tabella admin_users (nessun accesso anon)
REVOKE ALL ON public.admin_users FROM anon;
GRANT SELECT ON public.admin_users TO authenticated;

-- 4. Notifica a PostgREST per ricaricare istantaneamente la cache dello schema
NOTIFY pgrst, 'reload schema';
