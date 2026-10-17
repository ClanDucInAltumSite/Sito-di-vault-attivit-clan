-- ==============================================================================
-- Migrazione 0006: Aggiunta colonna bpm_testo a public.canti
-- Conserva intervalli testuali esatti (es. 'circa 92-94') senza forzare a intero
-- ==============================================================================

ALTER TABLE public.canti ADD COLUMN IF NOT EXISTS bpm_testo text NULL;

-- Copia eventuale valore di tempo_bpm in bpm_testo se non già valorizzato
UPDATE public.canti
SET bpm_testo = tempo_bpm::text
WHERE bpm_testo IS NULL AND tempo_bpm IS NOT NULL;
