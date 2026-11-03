-- ==============================================================================
-- SCRIPT SQL CONSOLIDATO: ATTIVAZIONE QUADERNO DI CLAN E APPUNTI EVENTI
-- Copia e incolla questo script nel SQL Editor della dashboard Supabase (Progetto Vault Scout)
-- ed esegui (Run).
-- ==============================================================================

-- 1. Aggiunta colonna appunti su public.eventi (se non esiste già)
ALTER TABLE public.eventi ADD COLUMN IF NOT EXISTS appunti text NULL;

-- 2. Creazione della tabella public.quaderno
CREATE TABLE IF NOT EXISTS public.quaderno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  titolo text NOT NULL,
  categoria text NOT NULL DEFAULT 'riunione',
  contenuto text NOT NULL DEFAULT '',
  evento_id uuid NULL REFERENCES public.eventi(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- 3. Vincolo CHECK con le 4 Categorie Ufficiali del Clan
ALTER TABLE public.quaderno DROP CONSTRAINT IF EXISTS check_quaderno_categoria;
ALTER TABLE public.quaderno ADD CONSTRAINT check_quaderno_categoria
  CHECK (categoria IN ('riunione', 'punto_strada', 'verifica', 'libero'));

-- 4. Indici di performance per query veloci e filtri
CREATE INDEX IF NOT EXISTS idx_quaderno_data ON public.quaderno (data DESC);
CREATE INDEX IF NOT EXISTS idx_quaderno_categoria ON public.quaderno (categoria);
CREATE INDEX IF NOT EXISTS idx_quaderno_deleted_at ON public.quaderno (deleted_at);

-- 5. Abilitazione Row Level Security (RLS)
ALTER TABLE public.quaderno ENABLE ROW LEVEL SECURITY;

-- 5a. Lettura pubblica per tutti gli utenti (anche anonimi del Clan)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quaderno' AND policyname = 'Lettura pubblica quaderno'
  ) THEN
    CREATE POLICY "Lettura pubblica quaderno"
      ON public.quaderno FOR SELECT
      USING (true);
  END IF;
END $$;

-- 5b. Inserimento, modifica ed eliminazione riservati agli amministratori autenticati
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quaderno' AND policyname = 'Admin possono modificare quaderno'
  ) THEN
    CREATE POLICY "Admin possono modificare quaderno"
      ON public.quaderno FOR ALL
      TO authenticated
      USING (auth.uid() IN (SELECT user_id FROM public.admin_users))
      WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));
  END IF;
END $$;

-- 6. Trigger automatico per l'aggiornamento di updated_at
DROP TRIGGER IF EXISTS trg_quaderno_updated_at ON public.quaderno;
CREATE TRIGGER trg_quaderno_updated_at
  BEFORE UPDATE ON public.quaderno
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 7. Aggiunta alla pubblicazione Realtime (per aggiornamenti in tempo reale tra dispositivi)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quaderno'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.quaderno;
    END IF;
  END IF;
END $$;

-- 8. Ricarica immediata della cache dello schema di PostgREST
NOTIFY pgrst, 'reload schema';

-- Conferma completamento
SELECT 'Tabella public.quaderno creata e allineata con successo!' AS esito;
