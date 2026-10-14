-- ==============================================================================
-- Migrazione 0001: Schema Iniziale, Tabelle, Indici e Trigger
-- Sito Vault Scout Clan — Duc In Altum
-- ==============================================================================

-- 1. Funzione trigger per l'aggiornamento automatico di updated_at
--    (search_path blindato a public per eliminare warning di sicurezza)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Tabella Admin Users (contiene l'UUID dell'amministratore autorizzato)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabella Giochi
CREATE TABLE IF NOT EXISTS public.giochi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  regole text NOT NULL DEFAULT '',
  materiali text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- 4. Tabella Bans
CREATE TABLE IF NOT EXISTS public.bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  testo text NOT NULL,
  note_gesti text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- 5. Tabella Canti (Canzoniere)
CREATE TABLE IF NOT EXISTS public.canti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  autore text NULL,
  tonalita text NULL,
  ritmo text NULL,
  tempo_bpm integer NULL CHECK (tempo_bpm IS NULL OR (tempo_bpm >= 30 AND tempo_bpm <= 300)),
  misura text NULL,
  capotasto integer NULL CHECK (capotasto IS NULL OR (capotasto >= 0 AND capotasto <= 12)),
  testo_chordpro text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- 6. Tabella Eventi Calendario
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

-- 7. Tabella ODG Punti (Ordine del Giorno per evento)
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

-- 8. Tabella Allegati (immagini JPG/PNG/WebP e documenti PDF)
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
  -- CHECK: Esattamente un solo genitore deve essere specificato
  CONSTRAINT check_esattamente_un_genitore CHECK (
    (CASE WHEN gioco_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN ban_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN canto_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN evento_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  -- CHECK: Tipi MIME consentiti in v1
  CONSTRAINT check_mime_consentiti CHECK (
    mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  )
);

-- 9. Trigger per updated_at
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

-- 10. Indici per performance di sincronizzazione incrementale
CREATE INDEX IF NOT EXISTS idx_giochi_updated_at ON public.giochi(updated_at);
CREATE INDEX IF NOT EXISTS idx_bans_updated_at ON public.bans(updated_at);
CREATE INDEX IF NOT EXISTS idx_canti_updated_at ON public.canti(updated_at);
CREATE INDEX IF NOT EXISTS idx_eventi_updated_at ON public.eventi(updated_at);
CREATE INDEX IF NOT EXISTS idx_odg_punti_updated_at ON public.odg_punti(updated_at);
CREATE INDEX IF NOT EXISTS idx_allegati_updated_at ON public.allegati(updated_at);

-- 11. Indici per query e ordinamento
CREATE INDEX IF NOT EXISTS idx_giochi_nome ON public.giochi(nome) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bans_nome ON public.bans(nome) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_canti_titolo ON public.canti(titolo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_eventi_inizio ON public.eventi(inizio) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_odg_evento ON public.odg_punti(evento_id, ordine) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_allegati_genitori ON public.allegati(gioco_id, ban_id, canto_id, evento_id) WHERE deleted_at IS NULL;
