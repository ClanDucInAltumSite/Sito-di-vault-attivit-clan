-- ==============================================================================
-- Migrazione 0011: Nuove Categorie Ufficiali del Quaderno di Clan
-- Nuove categorie: riunione, punto_strada, verifica, libero
-- ==============================================================================

-- 1. Rimuove il vecchio vincolo di categoria se presente
ALTER TABLE public.quaderno DROP CONSTRAINT IF EXISTS check_quaderno_categoria;

-- 2. Migra i vecchi valori esistenti
UPDATE public.quaderno SET categoria = 'punto_strada' WHERE categoria = 'consiglio';
UPDATE public.quaderno SET categoria = 'libero' WHERE categoria = 'altro';

-- 3. Applica il nuovo vincolo CHECK con le 4 categorie ufficiali
ALTER TABLE public.quaderno ADD CONSTRAINT check_quaderno_categoria
  CHECK (categoria IN ('riunione', 'punto_strada', 'verifica', 'libero'));
