-- ==============================================================================
-- Migrazione 0002: Row Level Security (RLS) e Pubblicazione Supabase Realtime
-- Sito Vault Scout Clan — Duc In Altum
-- ==============================================================================

-- 1. Funzione is_admin() (SECURITY DEFINER con search_path protetto a public)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Abilitazione RLS su tutte le tabelle (Nessuna eccezione)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giochi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odg_punti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allegati ENABLE ROW LEVEL SECURITY;

-- 3. Policy su admin_users
DROP POLICY IF EXISTS "admin_users_select_admin" ON public.admin_users;
CREATE POLICY "admin_users_select_admin" ON public.admin_users
  FOR SELECT USING (public.is_admin());

-- 4. Policy su giochi
DROP POLICY IF EXISTS "giochi_select_public" ON public.giochi;
CREATE POLICY "giochi_select_public" ON public.giochi FOR SELECT USING (true);

DROP POLICY IF EXISTS "giochi_insert_admin" ON public.giochi;
CREATE POLICY "giochi_insert_admin" ON public.giochi FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "giochi_update_admin" ON public.giochi;
CREATE POLICY "giochi_update_admin" ON public.giochi FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "giochi_delete_admin" ON public.giochi;
CREATE POLICY "giochi_delete_admin" ON public.giochi FOR DELETE USING (public.is_admin());

-- 5. Policy su bans
DROP POLICY IF EXISTS "bans_select_public" ON public.bans;
CREATE POLICY "bans_select_public" ON public.bans FOR SELECT USING (true);

DROP POLICY IF EXISTS "bans_insert_admin" ON public.bans;
CREATE POLICY "bans_insert_admin" ON public.bans FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "bans_update_admin" ON public.bans;
CREATE POLICY "bans_update_admin" ON public.bans FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "bans_delete_admin" ON public.bans;
CREATE POLICY "bans_delete_admin" ON public.bans FOR DELETE USING (public.is_admin());

-- 6. Policy su canti
DROP POLICY IF EXISTS "canti_select_public" ON public.canti;
CREATE POLICY "canti_select_public" ON public.canti FOR SELECT USING (true);

DROP POLICY IF EXISTS "canti_insert_admin" ON public.canti;
CREATE POLICY "canti_insert_admin" ON public.canti FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "canti_update_admin" ON public.canti;
CREATE POLICY "canti_update_admin" ON public.canti FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "canti_delete_admin" ON public.canti;
CREATE POLICY "canti_delete_admin" ON public.canti FOR DELETE USING (public.is_admin());

-- 7. Policy su eventi
DROP POLICY IF EXISTS "eventi_select_public" ON public.eventi;
CREATE POLICY "eventi_select_public" ON public.eventi FOR SELECT USING (true);

DROP POLICY IF EXISTS "eventi_insert_admin" ON public.eventi;
CREATE POLICY "eventi_insert_admin" ON public.eventi FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "eventi_update_admin" ON public.eventi;
CREATE POLICY "eventi_update_admin" ON public.eventi FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "eventi_delete_admin" ON public.eventi;
CREATE POLICY "eventi_delete_admin" ON public.eventi FOR DELETE USING (public.is_admin());

-- 8. Policy su odg_punti
DROP POLICY IF EXISTS "odg_punti_select_public" ON public.odg_punti;
CREATE POLICY "odg_punti_select_public" ON public.odg_punti FOR SELECT USING (true);

DROP POLICY IF EXISTS "odg_punti_insert_admin" ON public.odg_punti;
CREATE POLICY "odg_punti_insert_admin" ON public.odg_punti FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "odg_punti_update_admin" ON public.odg_punti;
CREATE POLICY "odg_punti_update_admin" ON public.odg_punti FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "odg_punti_delete_admin" ON public.odg_punti;
CREATE POLICY "odg_punti_delete_admin" ON public.odg_punti FOR DELETE USING (public.is_admin());

-- 9. Policy su allegati
DROP POLICY IF EXISTS "allegati_select_public" ON public.allegati;
CREATE POLICY "allegati_select_public" ON public.allegati FOR SELECT USING (true);

DROP POLICY IF EXISTS "allegati_insert_admin" ON public.allegati;
CREATE POLICY "allegati_insert_admin" ON public.allegati FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "allegati_update_admin" ON public.allegati;
CREATE POLICY "allegati_update_admin" ON public.allegati FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "allegati_delete_admin" ON public.allegati;
CREATE POLICY "allegati_delete_admin" ON public.allegati FOR DELETE USING (public.is_admin());

-- 10. Pubblicazione Supabase Realtime sulle tabelle di contenuto
--     (permette al frontend di ricevere segnali di cambio per avviare il pull incrementale)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.giochi;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bans;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.canti;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.eventi;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.odg_punti;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.allegati;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Tabelle già presenti nella publication
    NULL;
END $$;
