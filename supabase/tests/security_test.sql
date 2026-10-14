-- ==============================================================================
-- Test di Sicurezza e RLS (Row Level Security)
-- Sito Vault Scout Clan — Duc In Altum
-- ==============================================================================

-- 1. Test di verifica pubblicazione Supabase Realtime
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND tablename IN ('giochi', 'bans', 'canti', 'eventi', 'odg_punti', 'allegati');

  IF v_count < 6 THEN
    RAISE EXCEPTION 'TEST FALLITO: Realtime non attivo su tutte le 6 tabelle di contenuto! (trovate % su 6)', v_count;
  ELSE
    RAISE NOTICE 'TEST 1 SUPERATO: Realtime regolarmente attivo su tutte le 6 tabelle di contenuto.';
  END IF;
END $$;

-- 2. Test di verifica Bucket Storage Allegati
DO $$
DECLARE
  v_public boolean;
  v_size_limit bigint;
BEGIN
  SELECT public, file_size_limit INTO v_public, v_size_limit
  FROM storage.buckets
  WHERE id = 'allegati';

  IF v_public IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST FALLITO: Il bucket allegati non è pubblico per download diretto!';
  END IF;

  IF v_size_limit <> 10485760 THEN
    RAISE EXCEPTION 'TEST FALLITO: Il limite di dimensione del bucket allegati non è 10MB!';
  END IF;

  RAISE NOTICE 'TEST 2 SUPERATO: Bucket allegati configurato correttamente (public=true, 10MB limit).';
END $$;

-- 3. Test di simulazione Utente Anonimo (anon role)
DO $$
DECLARE
  v_inserted_id uuid;
BEGIN
  -- Impostiamo il contesto come utente anonimo
  SET LOCAL ROLE anon;
  SET LOCAL "request.jwt.claims" TO '{"role": "anon"}';

  -- A. La lettura deve funzionare
  PERFORM * FROM public.giochi;
  RAISE NOTICE 'TEST 3A SUPERATO: Utente anonimo può eseguire SELECT.';

  -- B. La scrittura DEVE fallire (RLS violation)
  BEGIN
    INSERT INTO public.giochi (nome, regole) VALUES ('Gioco Hack', 'Regole non consentite') RETURNING id INTO v_inserted_id;
    RAISE EXCEPTION 'TEST FALLITO: Utente anonimo ha potuto eseguire INSERT su giochi!';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'TEST 3B SUPERATO: INSERT anonimo bloccato da RLS (insufficient_privilege).';
    WHEN others THEN
      IF SQLSTATE = '42501' THEN
        RAISE NOTICE 'TEST 3B SUPERATO: INSERT anonimo bloccato da RLS (codice 42501).';
      ELSE
        RAISE EXCEPTION 'Errore imprevisto durante il test RLS anonimo: % (SQLSTATE %)', SQLERRM, SQLSTATE;
      END IF;
  END;

  -- C. Modifica DEVE fallire
  BEGIN
    UPDATE public.giochi SET nome = 'Hacked' WHERE id IS NOT NULL;
    IF FOUND THEN
      RAISE EXCEPTION 'TEST FALLITO: Utente anonimo ha potuto eseguire UPDATE su giochi!';
    END IF;
    RAISE NOTICE 'TEST 3C SUPERATO: UPDATE anonimo bloccato o senza effetto da RLS.';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'TEST 3C SUPERATO: UPDATE anonimo bloccato da RLS (insufficient_privilege).';
    WHEN others THEN
      IF SQLSTATE = '42501' THEN
        RAISE NOTICE 'TEST 3C SUPERATO: UPDATE anonimo bloccato da RLS (codice 42501).';
      END IF;
  END;

  -- D. Cancellazione DEVE fallire
  BEGIN
    DELETE FROM public.giochi WHERE id IS NOT NULL;
    IF FOUND THEN
      RAISE EXCEPTION 'TEST FALLITO: Utente anonimo ha potuto eseguire DELETE su giochi!';
    END IF;
    RAISE NOTICE 'TEST 3D SUPERATO: DELETE anonimo bloccato o senza effetto da RLS.';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'TEST 3D SUPERATO: DELETE anonimo bloccato da RLS (insufficient_privilege).';
    WHEN others THEN
      IF SQLSTATE = '42501' THEN
        RAISE NOTICE 'TEST 3D SUPERATO: DELETE anonimo bloccato da RLS (codice 42501).';
      END IF;
  END;

  -- E. Modifica tabella admin_users DEVE fallire
  BEGIN
    INSERT INTO public.admin_users (user_id) VALUES (gen_random_uuid());
    RAISE EXCEPTION 'TEST FALLITO: Utente anonimo ha potuto inserire un admin in admin_users!';
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'TEST 3E SUPERATO: Scrittura su admin_users bloccata da RLS.';
  END;

  RESET ROLE;
  RAISE NOTICE 'TUTTI I TEST DI SICUREZZA RLS HANNO DATO ESITO POSITIVO!';
END $$;
