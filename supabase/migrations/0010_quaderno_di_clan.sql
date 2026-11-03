-- ==============================================================================
-- Migrazione 0010: Tabella Quaderno di Clan (public.quaderno)
-- Per verbali di riunione, verifiche lunghe di percorso e appunti cronologici
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.quaderno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  titolo text NOT NULL,
  categoria text NOT NULL DEFAULT 'riunione',
  contenuto text NOT NULL DEFAULT '',
  evento_id uuid NULL REFERENCES public.eventi(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT check_quaderno_categoria CHECK (categoria IN ('riunione', 'verifica', 'consiglio', 'altro'))
);

CREATE INDEX IF NOT EXISTS idx_quaderno_data ON public.quaderno (data DESC);
CREATE INDEX IF NOT EXISTS idx_quaderno_categoria ON public.quaderno (categoria);
CREATE INDEX IF NOT EXISTS idx_quaderno_deleted_at ON public.quaderno (deleted_at);

ALTER TABLE public.quaderno ENABLE ROW LEVEL SECURITY;

-- 1. Lettura pubblica per tutti gli utenti (anche anonimi)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quaderno' AND policyname = 'Lettura pubblica quaderno'
  ) THEN
    CREATE POLICY "Lettura pubblica quaderno"
      ON public.quaderno FOR SELECT
      USING (true);
  END IF;
END $$;

-- 2. Modifica, inserimento ed eliminazione riservati agli amministratori
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

-- 3. Trigger automatico per updated_at
DROP TRIGGER IF EXISTS trg_quaderno_updated_at ON public.quaderno;
CREATE TRIGGER trg_quaderno_updated_at
  BEFORE UPDATE ON public.quaderno
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
