-- ==============================================================================
-- Migrazione 0013: Sistema Proposte Clan e Circuit Breaker Anti-Flood IP
-- Sito Vault Scout Clan - Duc In Altum
-- ==============================================================================

-- 1. Tabella IP Bloccati (Blacklist permanente riabilitabile SOLO da admin)
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  ip text PRIMARY KEY,
  reason text NOT NULL DEFAULT 'Rilevato flood anomalo (>= 20 richieste in 2 secondi)',
  blocked_at timestamptz NOT NULL DEFAULT now(),
  is_blocked boolean NOT NULL DEFAULT true,
  unblocked_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_is_blocked ON public.blocked_ips (is_blocked);

-- 2. Tabella Log di Rate Limiting (per calcolo finestra scorrevole 2 secondi)
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_ip_created ON public.rate_limit_log (ip, created_at DESC);

-- 3. Tabella Proposte Contenuti da Utenti Non-Admin
CREATE TABLE IF NOT EXISTS public.proposte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabella text NOT NULL,
  titolo text NOT NULL,
  dati jsonb NOT NULL,
  proponente_nome text NULL,
  device_id text NOT NULL,
  ip text NOT NULL DEFAULT 'unknown',
  stato text NOT NULL DEFAULT 'in_attesa',
  motivo_rifiuto text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz NULL,
  reviewed_by uuid NULL REFERENCES auth.users(id),
  CONSTRAINT check_proposte_tabella CHECK (tabella IN ('canti', 'giochi', 'bans', 'canovacci')),
  CONSTRAINT check_proposte_stato CHECK (stato IN ('in_attesa', 'approvata', 'rifiutata'))
);

CREATE INDEX IF NOT EXISTS idx_proposte_tabella ON public.proposte (tabella);
CREATE INDEX IF NOT EXISTS idx_proposte_stato ON public.proposte (stato);
CREATE INDEX IF NOT EXISTS idx_proposte_device_id ON public.proposte (device_id);
CREATE INDEX IF NOT EXISTS idx_proposte_created_at ON public.proposte (created_at DESC);

-- 4. Abilitazione Row Level Security (RLS) su tutte le nuove tabelle
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposte ENABLE ROW LEVEL SECURITY;

-- 5. Policy RLS su blocked_ips (Solo Admin)
DROP POLICY IF EXISTS "blocked_ips_admin_all" ON public.blocked_ips;
CREATE POLICY "blocked_ips_admin_all" ON public.blocked_ips
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. Policy RLS su rate_limit_log (Solo Admin)
DROP POLICY IF EXISTS "rate_limit_log_admin_select" ON public.rate_limit_log;
CREATE POLICY "rate_limit_log_admin_select" ON public.rate_limit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 7. Policy RLS su proposte
-- Lettura: gli admin vedono tutto; gli utenti vedono le proposte del proprio device_id o quelle approvate
DROP POLICY IF EXISTS "proposte_select" ON public.proposte;
CREATE POLICY "proposte_select" ON public.proposte
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_admin()
    OR stato = 'approvata'
    OR device_id = coalesce(nullif(current_setting('request.headers', true)::json->>'x-device-id', ''), device_id)
  );

-- Inserimento: anon e utenti autenticati possono proporre contenuti con stato 'in_attesa'
DROP POLICY IF EXISTS "proposte_insert" ON public.proposte;
CREATE POLICY "proposte_insert" ON public.proposte
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (stato = 'in_attesa');

-- Modifica e cancellazione: solo amministratori
DROP POLICY IF EXISTS "proposte_update_admin" ON public.proposte;
CREATE POLICY "proposte_update_admin" ON public.proposte
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "proposte_delete_admin" ON public.proposte;
CREATE POLICY "proposte_delete_admin" ON public.proposte
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 8. Funzione Trigger Circuit Breaker Anti-Flood IP (20 richieste in 2 secondi)
CREATE OR REPLACE FUNCTION public.check_ip_circuit_breaker()
RETURNS trigger AS $$
DECLARE
  client_ip text;
  recent_count int;
BEGIN
  -- Estrazione sicura dell'indirizzo IP del client dai contesti PostgREST / Cloudflare / reverse proxy
  BEGIN
    client_ip := coalesce(
      nullif(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
      nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
      'unknown'
    );
  EXCEPTION WHEN OTHERS THEN
    client_ip := 'unknown';
  END;

  NEW.ip := client_ip;

  -- Controllo Blacklist permanente: se l'IP o il dispositivo e bloccato, rifiuta immediatamente
  IF EXISTS (
    SELECT 1 FROM public.blocked_ips
    WHERE (ip = client_ip OR ip = 'dev:' || coalesce(NEW.device_id, ''))
      AND is_blocked = true
  ) THEN
    RAISE EXCEPTION 'Accesso temporaneamente sospeso per questo dispositivo. Contattare un amministratore per la riabilitazione.'
      USING ERRCODE = 'P0001';
  END IF;

  IF client_ip <> 'unknown' THEN

    -- Registra timestamp richiesta nel log
    INSERT INTO public.rate_limit_log (ip, created_at) VALUES (client_ip, now());

    -- Pulizia periodica leggera dei log più vecchi di 1 ora
    DELETE FROM public.rate_limit_log
    WHERE ip = client_ip AND created_at < (now() - interval '1 hour');

    -- Conta richieste negli ultimi 2 secondi
    SELECT count(*) INTO recent_count
    FROM public.rate_limit_log
    WHERE ip = client_ip
      AND created_at >= (now() - interval '2 seconds');

    -- Scatto del Circuit Breaker: se >= 20 richieste in 2 secondi, blocca l'IP in blacklist
    IF recent_count >= 20 THEN
      INSERT INTO public.blocked_ips (ip, reason, blocked_at, is_blocked)
      VALUES (client_ip, 'Rilevato flood anomalo (>= 20 richieste in 2 secondi)', now(), true)
      ON CONFLICT (ip) DO UPDATE
        SET is_blocked = true,
            reason = 'Rilevato flood anomalo (>= 20 richieste in 2 secondi)',
            blocked_at = now(),
            unblocked_at = NULL;

      RAISE EXCEPTION 'Rilevata frequenza anomala di richieste (flood). Questo indirizzo IP e stato bloccato dal sistema di protezione. Solo un amministratore puo riabilitarlo.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_proposte_circuit_breaker ON public.proposte;
CREATE TRIGGER trg_proposte_circuit_breaker
  BEFORE INSERT ON public.proposte
  FOR EACH ROW
  EXECUTE FUNCTION public.check_ip_circuit_breaker();

-- 9. RPC Amministratore: Elenco IP Bloccati
CREATE OR REPLACE FUNCTION public.get_blocked_ips()
RETURNS TABLE (
  ip text,
  reason text,
  blocked_at timestamptz,
  is_blocked boolean,
  unblocked_at timestamptz
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accesso negato: operazione riservata agli amministratori.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT b.ip, b.reason, b.blocked_at, b.is_blocked, b.unblocked_at
  FROM public.blocked_ips b
  WHERE b.is_blocked = true
  ORDER BY b.blocked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. RPC Amministratore: Sblocco IP
CREATE OR REPLACE FUNCTION public.unblock_ip(target_ip text)
RETURNS boolean AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accesso negato: operazione riservata agli amministratori.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.blocked_ips
  SET is_blocked = false,
      unblocked_at = now()
  WHERE ip = target_ip;

  DELETE FROM public.rate_limit_log
  WHERE ip = target_ip;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 11. Pubblicazione Realtime per la tabella proposte
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.proposte;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
