-- ==============================================================================
-- Migrazione 0009: Aggiunta colonna appunti a public.eventi
-- Per salvare appunti e verbali di riunione del Clan
-- ==============================================================================

ALTER TABLE public.eventi ADD COLUMN IF NOT EXISTS appunti text NULL;
