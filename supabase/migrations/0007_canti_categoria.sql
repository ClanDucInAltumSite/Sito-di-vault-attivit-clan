-- ==============================================================================
-- Migrazione 0007: Aggiunta colonna categoria a public.canti
-- Valori ammessi: 'scout', 'chiesa', 'esterni' (oppure NULL per canti preesistenti)
-- Nessun default: i canti esistenti restano senza categoria finché non assegnati
-- ==============================================================================

ALTER TABLE public.canti ADD COLUMN IF NOT EXISTS categoria text;

ALTER TABLE public.canti DROP CONSTRAINT IF EXISTS canti_categoria_check;
ALTER TABLE public.canti ADD CONSTRAINT canti_categoria_check
  CHECK (categoria IS NULL OR categoria IN ('scout', 'chiesa', 'esterni'));

CREATE INDEX IF NOT EXISTS idx_canti_categoria ON public.canti(categoria)
  WHERE deleted_at IS NULL;
