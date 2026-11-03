-- ==============================================================================
-- Migrazione 0012: Aggiunta colonna link a public.bans
-- Per salvare link esterni facoltativi (video YouTube, audio, dimostrazione)
-- ==============================================================================

ALTER TABLE public.bans ADD COLUMN IF NOT EXISTS link text NULL;
