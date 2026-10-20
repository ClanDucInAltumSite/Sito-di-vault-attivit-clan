-- ==============================================================================
-- Migrazione 0008: Aggiunta colonne origine e nota_fonte a public.canti
-- Valori ammessi per origine: 'import_pdf', 'import_docx', 'manuale' (oppure NULL)
-- Visibile e modificabile solo dagli amministratori per tracciabilità delle fonti
-- ==============================================================================

ALTER TABLE public.canti ADD COLUMN IF NOT EXISTS origine text NULL;

ALTER TABLE public.canti DROP CONSTRAINT IF EXISTS canti_origine_check;
ALTER TABLE public.canti ADD CONSTRAINT canti_origine_check
  CHECK (origine IS NULL OR origine IN ('import_pdf', 'import_docx', 'manuale'));

ALTER TABLE public.canti ADD COLUMN IF NOT EXISTS nota_fonte text NULL;
