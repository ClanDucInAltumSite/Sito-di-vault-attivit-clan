-- ==============================================================================
-- Migrazione 0005: Restrizione Permessi RPC (bump_sync_epoch e purge_old_tombstones)
-- e Policy di Sicurezza Storage
-- Sito Vault Scout Clan — Duc In Altum
-- ==============================================================================

-- 1. Revoca permessi di esecuzione pubblica e anonima sulle funzioni di sistema
REVOKE EXECUTE ON FUNCTION public.bump_sync_epoch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_sync_epoch() FROM anon;
GRANT EXECUTE ON FUNCTION public.bump_sync_epoch() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.purge_old_tombstones() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_old_tombstones() FROM anon;
GRANT EXECUTE ON FUNCTION public.purge_old_tombstones() TO authenticated;

-- NOTA: Le funzioni contengono internamente il controllo `IF NOT public.is_admin() THEN RAISE EXCEPTION`,
-- ma con la REVOKE a livello Postgres gli utenti anonimi vengono respinti istantaneamente a livello di autorizzazione (42501).
