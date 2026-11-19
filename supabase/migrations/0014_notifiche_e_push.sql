-- ==============================================================================
-- Migrazione 0014: Sistema Notifiche e Sottoscrizioni Web Push PWA
-- Sito Vault Scout Clan - Duc In Altum
-- ==============================================================================

-- 1. Tabella Sottoscrizioni Web Push per Notifiche da Remoto
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_id ON public.push_subscriptions (device_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role ON public.push_subscriptions (role);

-- 2. Abilitazione Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Policy RLS su push_subscriptions
-- Inserimento: anon e authenticated possono registrare la propria sottoscrizione push
DROP POLICY IF EXISTS "push_subscriptions_insert" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert" ON public.push_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Lettura: solo admin o il proprietario del device
DROP POLICY IF EXISTS "push_subscriptions_select" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select" ON public.push_subscriptions
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_admin()
    OR (select auth.uid()) = user_id
    OR device_id = coalesce(nullif(current_setting('request.headers', true)::json->>'x-device-id', ''), device_id)
  );

-- Aggiornamento: solo admin o proprietario
DROP POLICY IF EXISTS "push_subscriptions_update" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update" ON public.push_subscriptions
  FOR UPDATE
  TO anon, authenticated
  USING (
    public.is_admin()
    OR (select auth.uid()) = user_id
    OR device_id = coalesce(nullif(current_setting('request.headers', true)::json->>'x-device-id', ''), device_id)
  )
  WITH CHECK (
    public.is_admin()
    OR (select auth.uid()) = user_id
    OR device_id = coalesce(nullif(current_setting('request.headers', true)::json->>'x-device-id', ''), device_id)
  );

-- Cancellazione: disiscrizione consentita a chi possiede l'endpoint o agli admin
DROP POLICY IF EXISTS "push_subscriptions_delete" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete" ON public.push_subscriptions
  FOR DELETE
  TO anon, authenticated
  USING (
    public.is_admin()
    OR (select auth.uid()) = user_id
    OR device_id = coalesce(nullif(current_setting('request.headers', true)::json->>'x-device-id', ''), device_id)
  );

-- 4. Pubblicazione Realtime per notifiche istantanee
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
