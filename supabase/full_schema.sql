-- ==============================================================================
-- SCHEMA COMPLETO CONSOLIDATO - Sito Vault Scout Clan (Duc In Altum)
-- Da eseguire nel SQL Editor della dashboard Supabase
-- ==============================================================================

-- PARTE 1: SCHEMA INIZIALE, TABELLE, VINCOLI E TRIGGER
-- ------------------------------------------------------------------------------

-- Funzione trigger per l'aggiornamento automatico di updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabella Admin Users
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabella Giochi
CREATE TABLE IF NOT EXISTS public.giochi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  regole text NOT NULL DEFAULT '',
  materiali text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- Tabella Bans
CREATE TABLE IF NOT EXISTS public.bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  testo text NOT NULL,
  note_gesti text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- Tabella Canti (Canzoniere)
CREATE TABLE IF NOT EXISTS public.canti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  autore text NULL,
  categoria text NULL,
  tonalita text NULL,
  ritmo text NULL,
  tempo_bpm integer NULL CHECK (tempo_bpm IS NULL OR (tempo_bpm >= 30 AND tempo_bpm <= 300)),
  bpm_testo text NULL,
  misura text NULL,
  capotasto integer NULL CHECK (capotasto IS NULL OR (capotasto >= 0 AND capotasto <= 12)),
  origine text NULL,
  nota_fonte text NULL,
  testo_chordpro text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT canti_categoria_check CHECK (categoria IS NULL OR categoria IN ('scout', 'chiesa', 'esterni')),
  CONSTRAINT canti_origine_check CHECK (origine IS NULL OR origine IN ('import_pdf', 'import_docx', 'manuale'))
);

-- Migrazioni idempotenti per database preesistenti
ALTER TABLE public.canti ADD COLUMN IF NOT EXISTS bpm_testo text;
ALTER TABLE public.canti ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.canti ADD COLUMN IF NOT EXISTS origine text;
ALTER TABLE public.canti ADD COLUMN IF NOT EXISTS nota_fonte text;
ALTER TABLE public.canti DROP CONSTRAINT IF EXISTS canti_categoria_check;
ALTER TABLE public.canti ADD CONSTRAINT canti_categoria_check CHECK (categoria IS NULL OR categoria IN ('scout', 'chiesa', 'esterni'));
ALTER TABLE public.canti DROP CONSTRAINT IF EXISTS canti_origine_check;
ALTER TABLE public.canti ADD CONSTRAINT canti_origine_check CHECK (origine IS NULL OR origine IN ('import_pdf', 'import_docx', 'manuale'));

-- Tabella Eventi Calendario
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_evento') THEN
    CREATE TYPE public.tipo_evento AS ENUM ('riunione', 'uscita', 'evento', 'scadenza', 'altro');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  tipo public.tipo_evento NOT NULL DEFAULT 'riunione',
  inizio timestamptz NOT NULL,
  fine timestamptz NULL,
  tutto_il_giorno boolean NOT NULL DEFAULT false,
  luogo text NULL,
  descrizione text NULL,
  responsabile text NULL,
  cosa_portare text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT check_date_ordine CHECK (fine IS NULL OR fine >= inizio)
);

-- Tabella ODG Punti
CREATE TABLE IF NOT EXISTS public.odg_punti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventi(id) ON DELETE CASCADE,
  testo text NOT NULL,
  ordine integer NOT NULL DEFAULT 0,
  completato boolean NOT NULL DEFAULT false,
  riportato_da uuid NULL REFERENCES public.odg_punti(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- Tabella Allegati
CREATE TABLE IF NOT EXISTS public.allegati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gioco_id uuid NULL REFERENCES public.giochi(id) ON DELETE CASCADE,
  ban_id uuid NULL REFERENCES public.bans(id) ON DELETE CASCADE,
  canto_id uuid NULL REFERENCES public.canti(id) ON DELETE CASCADE,
  evento_id uuid NULL REFERENCES public.eventi(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome_file text NOT NULL,
  mime text NOT NULL,
  dimensione bigint NOT NULL,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT check_esattamente_un_genitore CHECK (
    (CASE WHEN gioco_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN ban_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN canto_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN evento_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  CONSTRAINT check_mime_consentiti CHECK (
    mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  )
);

-- Trigger per updated_at
DROP TRIGGER IF EXISTS trg_giochi_updated ON public.giochi;
CREATE TRIGGER trg_giochi_updated BEFORE UPDATE ON public.giochi FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bans_updated ON public.bans;
CREATE TRIGGER trg_bans_updated BEFORE UPDATE ON public.bans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_canti_updated ON public.canti;
CREATE TRIGGER trg_canti_updated BEFORE UPDATE ON public.canti FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_eventi_updated ON public.eventi;
CREATE TRIGGER trg_eventi_updated BEFORE UPDATE ON public.eventi FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_odg_punti_updated ON public.odg_punti;
CREATE TRIGGER trg_odg_punti_updated BEFORE UPDATE ON public.odg_punti FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_allegati_updated ON public.allegati;
CREATE TRIGGER trg_allegati_updated BEFORE UPDATE ON public.allegati FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indici
CREATE INDEX IF NOT EXISTS idx_giochi_updated_at ON public.giochi(updated_at);
CREATE INDEX IF NOT EXISTS idx_bans_updated_at ON public.bans(updated_at);
CREATE INDEX IF NOT EXISTS idx_canti_updated_at ON public.canti(updated_at);
CREATE INDEX IF NOT EXISTS idx_eventi_updated_at ON public.eventi(updated_at);
CREATE INDEX IF NOT EXISTS idx_odg_punti_updated_at ON public.odg_punti(updated_at);
CREATE INDEX IF NOT EXISTS idx_allegati_updated_at ON public.allegati(updated_at);

CREATE INDEX IF NOT EXISTS idx_giochi_nome ON public.giochi(nome) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bans_nome ON public.bans(nome) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_canti_titolo ON public.canti(titolo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_canti_categoria ON public.canti(categoria) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_eventi_inizio ON public.eventi(inizio) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_odg_evento ON public.odg_punti(evento_id, ordine) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_allegati_genitori ON public.allegati(gioco_id, ban_id, canto_id, evento_id) WHERE deleted_at IS NULL;


-- PARTE 2: ROW LEVEL SECURITY (RLS) E REALTIME
-- ------------------------------------------------------------------------------

-- Funzione is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Abilitazione RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giochi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odg_punti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allegati ENABLE ROW LEVEL SECURITY;

-- Policy admin_users
DROP POLICY IF EXISTS "admin_users_select_admin" ON public.admin_users;
CREATE POLICY "admin_users_select_admin" ON public.admin_users FOR SELECT USING (public.is_admin());

-- Policy giochi
DROP POLICY IF EXISTS "giochi_select_public" ON public.giochi;
CREATE POLICY "giochi_select_public" ON public.giochi FOR SELECT USING (true);
DROP POLICY IF EXISTS "giochi_insert_admin" ON public.giochi;
CREATE POLICY "giochi_insert_admin" ON public.giochi FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "giochi_update_admin" ON public.giochi;
CREATE POLICY "giochi_update_admin" ON public.giochi FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "giochi_delete_admin" ON public.giochi;
CREATE POLICY "giochi_delete_admin" ON public.giochi FOR DELETE USING (public.is_admin());

-- Policy bans
DROP POLICY IF EXISTS "bans_select_public" ON public.bans;
CREATE POLICY "bans_select_public" ON public.bans FOR SELECT USING (true);
DROP POLICY IF EXISTS "bans_insert_admin" ON public.bans;
CREATE POLICY "bans_insert_admin" ON public.bans FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "bans_update_admin" ON public.bans;
CREATE POLICY "bans_update_admin" ON public.bans FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "bans_delete_admin" ON public.bans;
CREATE POLICY "bans_delete_admin" ON public.bans FOR DELETE USING (public.is_admin());

-- Policy canti
DROP POLICY IF EXISTS "canti_select_public" ON public.canti;
CREATE POLICY "canti_select_public" ON public.canti FOR SELECT USING (true);
DROP POLICY IF EXISTS "canti_insert_admin" ON public.canti;
CREATE POLICY "canti_insert_admin" ON public.canti FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "canti_update_admin" ON public.canti;
CREATE POLICY "canti_update_admin" ON public.canti FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "canti_delete_admin" ON public.canti;
CREATE POLICY "canti_delete_admin" ON public.canti FOR DELETE USING (public.is_admin());

-- Policy eventi
DROP POLICY IF EXISTS "eventi_select_public" ON public.eventi;
CREATE POLICY "eventi_select_public" ON public.eventi FOR SELECT USING (true);
DROP POLICY IF EXISTS "eventi_insert_admin" ON public.eventi;
CREATE POLICY "eventi_insert_admin" ON public.eventi FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "eventi_update_admin" ON public.eventi;
CREATE POLICY "eventi_update_admin" ON public.eventi FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "eventi_delete_admin" ON public.eventi;
CREATE POLICY "eventi_delete_admin" ON public.eventi FOR DELETE USING (public.is_admin());

-- Policy odg_punti
DROP POLICY IF EXISTS "odg_punti_select_public" ON public.odg_punti;
CREATE POLICY "odg_punti_select_public" ON public.odg_punti FOR SELECT USING (true);
DROP POLICY IF EXISTS "odg_punti_insert_admin" ON public.odg_punti;
CREATE POLICY "odg_punti_insert_admin" ON public.odg_punti FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "odg_punti_update_admin" ON public.odg_punti;
CREATE POLICY "odg_punti_update_admin" ON public.odg_punti FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "odg_punti_delete_admin" ON public.odg_punti;
CREATE POLICY "odg_punti_delete_admin" ON public.odg_punti FOR DELETE USING (public.is_admin());

-- Policy allegati
DROP POLICY IF EXISTS "allegati_select_public" ON public.allegati;
CREATE POLICY "allegati_select_public" ON public.allegati FOR SELECT USING (true);
DROP POLICY IF EXISTS "allegati_insert_admin" ON public.allegati;
CREATE POLICY "allegati_insert_admin" ON public.allegati FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "allegati_update_admin" ON public.allegati;
CREATE POLICY "allegati_update_admin" ON public.allegati FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "allegati_delete_admin" ON public.allegati;
CREATE POLICY "allegati_delete_admin" ON public.allegati FOR DELETE USING (public.is_admin());

-- Pubblicazione Realtime
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
  WHEN duplicate_object THEN NULL;
END $$;


-- PARTE 3: STORAGE BUCKET E POLICY
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'allegati',
  'allegati',
  true,
  10485760, -- 10 MB in byte
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- RLS Storage (scrittura solo admin, download diretto tramite public URL senza listing per utenti anonimi)
DROP POLICY IF EXISTS "allegati_admin_insert" ON storage.objects;
CREATE POLICY "allegati_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'allegati' AND public.is_admin());

DROP POLICY IF EXISTS "allegati_admin_update" ON storage.objects;
CREATE POLICY "allegati_admin_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'allegati' AND public.is_admin());

DROP POLICY IF EXISTS "allegati_admin_delete" ON storage.objects;
CREATE POLICY "allegati_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'allegati' AND public.is_admin());

DROP POLICY IF EXISTS "allegati_admin_select" ON storage.objects;
CREATE POLICY "allegati_admin_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'allegati' AND public.is_admin());


-- PARTE 4: SYSTEM META, SYNC EPOCH E PULIZIA TOMBSTONES
-- ------------------------------------------------------------------------------

-- Tabella Metadati di Sistema per tracciamento dell'epoca di sincronizzazione
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

-- Funzione bump_sync_epoch() per forzare il Full Resync sui client
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

-- Funzione purge_old_tombstones() per l'eliminazione fisica sicura di record con deleted_at > 180 giorni
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
    'purged_at', now(),
    'giochi', deleted_giochi,
    'bans', deleted_bans,
    'canti', deleted_canti,
    'eventi', deleted_eventi,
    'odg_punti', deleted_odg,
    'allegati', deleted_allegati
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoca permessi pubblici e anonimi per funzioni sensibili
REVOKE EXECUTE ON FUNCTION public.bump_sync_epoch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_sync_epoch() FROM anon;
GRANT EXECUTE ON FUNCTION public.bump_sync_epoch() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.purge_old_tombstones() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_old_tombstones() FROM anon;
GRANT EXECUTE ON FUNCTION public.purge_old_tombstones() TO authenticated;

