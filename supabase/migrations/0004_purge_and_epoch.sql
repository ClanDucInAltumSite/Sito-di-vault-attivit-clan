-- ==============================================================================
-- Migrazione 0004: Gestione Cestino Tombstone (180 giorni) e Sync Epoch
-- Sito Vault Scout Clan - Duc In Altum
-- ==============================================================================

-- 1. Tabella Metadati di Sistema per tracciamento dell'epoca di sincronizzazione
CREATE TABLE IF NOT EXISTS public.system_meta (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Abilitazione RLS su system_meta
ALTER TABLE public.system_meta ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT consentita a tutti (anon e autenticati) per verificare sync_epoch
DROP POLICY IF EXISTS "system_meta_select_public" ON public.system_meta;
CREATE POLICY "system_meta_select_public" ON public.system_meta
  FOR SELECT USING (true);

-- Policy: Scrittura (INSERT, UPDATE, DELETE) riservata esclusivamente agli amministratori
DROP POLICY IF EXISTS "system_meta_all_admin" ON public.system_meta;
CREATE POLICY "system_meta_all_admin" ON public.system_meta
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Inizializzazione sync_epoch a 1
INSERT INTO public.system_meta (key, value, updated_at)
VALUES ('sync_epoch', '1'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- 2. Funzione bump_sync_epoch() per forzare il Full Resync sui client in caso di hard-delete immediato
-- Accessibile solo da Admin (SECURITY DEFINER con search_path protetto a public)
CREATE OR REPLACE FUNCTION public.bump_sync_epoch()
RETURNS integer AS $$
DECLARE
  new_epoch integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Non autorizzato: operazione riservata agli amministratori'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.system_meta (key, value, updated_at)
  VALUES ('sync_epoch', '2'::jsonb, now())
  ON CONFLICT (key) DO UPDATE
    SET value = ((COALESCE(public.system_meta.value#>>'{}', '1')::integer) + 1)::text::jsonb,
        updated_at = now()
  RETURNING (value#>>'{}')::integer INTO new_epoch;

  RETURN new_epoch;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Funzione purge_old_tombstones() per l'eliminazione fisica sicura di record con deleted_at > 180 giorni
-- Accessibile solo da Admin (SECURITY DEFINER con search_path protetto a public)
CREATE OR REPLACE FUNCTION public.purge_old_tombstones()
RETURNS jsonb AS $$
DECLARE
  deleted_giochi integer := 0;
  deleted_bans integer := 0;
  deleted_canti integer := 0;
  deleted_eventi integer := 0;
  deleted_odg integer := 0;
  deleted_allegati integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Non autorizzato: operazione riservata agli amministratori'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Eliminazione allegati con deleted_at più vecchio di 180 giorni
  -- (Punto di estensione: in Fase 5 aggancia qui la rimozione dei file fisici dal bucket Storage)
  DELETE FROM public.allegati
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '180 days';
  GET DIAGNOSTICS deleted_allegati = ROW_COUNT;

  -- 2. Eliminazione punti ODG
  DELETE FROM public.odg_punti
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '180 days';
  GET DIAGNOSTICS deleted_odg = ROW_COUNT;

  -- 3. Eliminazione eventi
  DELETE FROM public.eventi
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '180 days';
  GET DIAGNOSTICS deleted_eventi = ROW_COUNT;

  -- 4. Eliminazione canti
  DELETE FROM public.canti
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '180 days';
  GET DIAGNOSTICS deleted_canti = ROW_COUNT;

  -- 5. Eliminazione bans
  DELETE FROM public.bans
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '180 days';
  GET DIAGNOSTICS deleted_bans = ROW_COUNT;

  -- 6. Eliminazione giochi
  DELETE FROM public.giochi
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '180 days';
  GET DIAGNOSTICS deleted_giochi = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_giochi', deleted_giochi,
    'deleted_bans', deleted_bans,
    'deleted_canti', deleted_canti,
    'deleted_eventi', deleted_eventi,
    'deleted_odg', deleted_odg,
    'deleted_allegati', deleted_allegati,
    'total_deleted', deleted_giochi + deleted_bans + deleted_canti + deleted_eventi + deleted_odg + deleted_allegati
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Aggiunta alla publication realtime per propagare cambi di epoca ai client connessi
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_meta;
