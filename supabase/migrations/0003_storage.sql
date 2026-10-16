-- ==============================================================================
-- Migrazione 0003: Configurazione Bucket Storage Allegati e Policy di Sicurezza
-- Sito Vault Scout Clan - Duc In Altum
-- ==============================================================================

-- 1. Creazione del bucket 'allegati' (pubblico per download diretto via URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'allegati',
  'allegati',
  true,
  10485760, -- Limite 10 MB per singolo file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 2. Policy su storage.objects
-- NOTA DI SICUREZZA: Con public=true, i singoli file sono scaricabili direttamente da
-- /storage/v1/object/public/allegati/{storage_path} senza policy SELECT su storage.objects.
-- Omettendo volutamente la policy SELECT pubblica su storage.objects, si impedisce
-- agli utenti non autorizzati di eseguire il listing/directory-browsing dell'intero bucket.

-- Policy di INSERT solo per l'amministratore
DROP POLICY IF EXISTS "allegati_admin_insert" ON storage.objects;
CREATE POLICY "allegati_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'allegati' AND public.is_admin());

-- Policy di UPDATE solo per l'amministratore
DROP POLICY IF EXISTS "allegati_admin_update" ON storage.objects;
CREATE POLICY "allegati_admin_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'allegati' AND public.is_admin());

-- Policy di DELETE solo per l'amministratore
DROP POLICY IF EXISTS "allegati_admin_delete" ON storage.objects;
CREATE POLICY "allegati_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'allegati' AND public.is_admin());

-- Solo l'amministratore autenticato può eseguire listing programmatico (.list())
DROP POLICY IF EXISTS "allegati_admin_select" ON storage.objects;
CREATE POLICY "allegati_admin_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'allegati' AND public.is_admin());
