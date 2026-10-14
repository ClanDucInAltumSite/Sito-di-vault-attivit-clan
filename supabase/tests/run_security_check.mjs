import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lpeiyzwccedtqjbficjo.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const CONTENT_TABLES = ['giochi', 'bans', 'canti', 'eventi', 'odg_punti', 'allegati'];
const ALL_TABLES = [...CONTENT_TABLES, 'admin_users'];

const DUMMY_RECORDS = {
  giochi: { nome: 'Gioco Test Hack', regole: 'Non autorizzato' },
  bans: { nome: 'Ban Test Hack', testo: 'Non autorizzato' },
  canti: { titolo: 'Canto Test Hack', testo_chordpro: '[Do]Test' },
  eventi: { titolo: 'Evento Test Hack', inizio: new Date().toISOString() },
  odg_punti: { evento_id: '00000000-0000-0000-0000-000000000000', testo: 'Punto Hack' },
  allegati: {
    gioco_id: '00000000-0000-0000-0000-000000000000',
    storage_path: 'hack.png',
    nome_file: 'hack.png',
    mime: 'image/png',
    dimensione: 100,
  },
  admin_users: { user_id: '00000000-0000-0000-0000-000000000000' },
};

/**
 * Valuta se l'errore è un reale blocco da Row Level Security (RLS) / Permessi Postgres.
 * Un 404, un PGRST205 o un NoSuchBucket NON è un blocco di sicurezza: indica risorsa assente!
 */
function isRlsSecurityBlock(status, error) {
  if (!error) return false;
  // 404 o PGRST205 non sono mai blocchi di sicurezza
  if (status === 404 || error.code === 'PGRST205') return false;
  if (error.code === 'NoSuchBucket' || error.message?.includes('Bucket not found')) return false;

  // Codice Postgres standard 42501 (insufficient_privilege) o HTTP 401 / 403
  if (error.code === '42501') return true;
  if (status === 401 || status === 403) return true;
  if (error.message && (
    error.message.toLowerCase().includes('violates row-level security') ||
    error.message.toLowerCase().includes('permission denied') ||
    error.message.toLowerCase().includes('not authorized')
  )) {
    return true;
  }

  return false;
}

async function runSecurityAudit() {
  console.log('======================================================================');
  console.log('AUDIT DI SICUREZZA RIGOROSO — CON CHIAVE ANONIMA (ANON KEY)');
  console.log('URL:', SUPABASE_URL);
  console.log('======================================================================\n');

  let hasFailures = false;

  // --- FASE 0: CONTROLLO PRELIMINARE ESISTENZA SCHEMA E BUCKET ---
  console.log('--- FASE 0: CONTROLLO PRELIMINARE ESISTENZA SCHEMA ---');
  let schemaMissing = false;

  for (const table of CONTENT_TABLES) {
    const { data: _data, error, status } = await supabase.from(table).select('*').limit(1);
    if (status === 404 || error?.code === 'PGRST205') {
      console.error(`[ERRORE BLOCCANTE] La tabella 'public.${table}' non esiste nello schema cache (HTTP ${status}, ${error?.message})`);
      schemaMissing = true;
    } else if (error) {
      console.error(`[ERRORE BLOCCANTE] Errore verifica esistenza tabella 'public.${table}': ${error.message} (Codice: ${error.code})`);
      schemaMissing = true;
    } else {
      console.log(`[OK ESISTE] Tabella 'public.${table}' accessibile (Status: ${status})`);
    }
  }

  // Verifica esistenza bucket
  const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('allegati');
  if (bucketError || !bucketData) {
    console.error(`[ERRORE BLOCCANTE] Il bucket Storage 'allegati' non esiste! (${bucketError?.message || 'Non trovato'})`);
    schemaMissing = true;
  } else {
    console.log(`[OK ESISTE] Bucket Storage 'allegati' presente (public: ${bucketData.public})`);
  }

  if (schemaMissing) {
    console.error('\n======================================================================');
    console.error('TEST ANNULLATO: Lo schema o il bucket non risultano applicati su Supabase!');
    console.error('Assicurati di aver eseguito interamente full_schema.sql e riprova.');
    console.error('======================================================================');
    process.exit(1);
  }

  console.log('\nControllo preliminare superato: tutte le tabelle e il bucket esistono.\n');

  // --- FASE 1: VERIFICA SELECT PUBBLICA ---
  console.log('--- FASE 1: VERIFICA LETTURA PUBBLICA (SELECT) ---');
  for (const table of CONTENT_TABLES) {
    const { data, error, status } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`[FALLITO] SELECT anonima su '${table}' è fallita: ${error.message} (Status: ${status})`);
      hasFailures = true;
    } else {
      console.log(`[OK] SELECT pubblica su '${table}' riuscita (Status: ${status}, elementi: ${data.length})`);
    }
  }

  // Verifica che admin_users NON sia leggibile da anonimi
  const { data: adminData, error: adminError, status: adminStatus } = await supabase.from('admin_users').select('*');
  if (adminError && isRlsSecurityBlock(adminStatus, adminError)) {
    console.log(`[OK] SELECT su 'admin_users' bloccata da RLS: ${adminError.message} (Status: ${adminStatus})`);
  } else if (!adminData || adminData.length === 0) {
    console.log(`[OK] SELECT su 'admin_users' protetta: RLS restituisce 0 righe agli utenti anonimi.`);
  } else {
    console.error(`[FALLIMENTO GRAVE] SELECT anonima su 'admin_users' ha esposto ${adminData.length} righe!`);
    hasFailures = true;
  }

  // --- FASE 2: VERIFICA INSERT ANONIMA (TUTTE DEVONO ESSERE BLOCCATE DA RLS) ---
  console.log('\n--- FASE 2: VERIFICA INSERT ANONIMA (DEVONO FALLIRE CON ERRORE RLS) ---');
  for (const table of ALL_TABLES) {
    const payload = DUMMY_RECORDS[table];
    const { data, error, status } = await supabase.from(table).insert(payload).select();
    if (isRlsSecurityBlock(status, error)) {
      console.log(`[OK BLOCCATO DA RLS] INSERT su '${table}': Status ${status} | Codice: ${error.code} | ${error.message}`);
    } else {
      console.error(`[FALLIMENTO SICUREZZA] INSERT su '${table}' NON è stata bloccata da RLS! Status: ${status}, Errore:`, error, 'Data:', data);
      hasFailures = true;
    }
  }

  // --- FASE 3: VERIFICA UPDATE ANONIMA (DEVONO ESSERE BLOCCATE DA RLS) ---
  console.log('\n--- FASE 3: VERIFICA UPDATE ANONIMA (DEVONO FALLIRE CON ERRORE RLS) ---');
  for (const table of ALL_TABLES) {
    const updatePayload = table === 'giochi' || table === 'bans'
      ? { nome: 'Hacked' }
      : { updated_at: new Date().toISOString() };

    const { data, error, status } = await supabase
      .from(table)
      .update(updatePayload)
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();

    if (isRlsSecurityBlock(status, error)) {
      console.log(`[OK BLOCCATO DA RLS] UPDATE su '${table}': Status ${status} | Codice: ${error?.code} | ${error?.message}`);
    } else if (status === 200 && (!data || data.length === 0)) {
      // In PostgreSQL RLS, una UPDATE senza permessi WITH CHECK restituisce 0 righe modificate
      console.log(`[OK BLOCCATO DA RLS] UPDATE su '${table}': RLS ha impedito la modifica (0 righe modificate)`);
    } else {
      console.error(`[FALLIMENTO SICUREZZA] UPDATE su '${table}' NON è stata bloccata da RLS! Status: ${status}, Errore:`, error, 'Data:', data);
      hasFailures = true;
    }
  }

  // --- FASE 4: VERIFICA DELETE ANONIMA (DEVONO ESSERE BLOCCATE DA RLS) ---
  console.log('\n--- FASE 4: VERIFICA DELETE ANONIMA (DEVONO FALLIRE CON ERRORE RLS) ---');
  for (const table of ALL_TABLES) {
    const { data, error, status } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();

    if (isRlsSecurityBlock(status, error)) {
      console.log(`[OK BLOCCATO DA RLS] DELETE su '${table}': Status ${status} | Codice: ${error?.code} | ${error?.message}`);
    } else if (status === 200 && (!data || data.length === 0)) {
      console.log(`[OK BLOCCATO DA RLS] DELETE su '${table}': RLS ha impedito l'eliminazione (0 righe eliminate)`);
    } else {
      console.error(`[FALLIMENTO SICUREZZA] DELETE su '${table}' NON è stata bloccata da RLS! Status: ${status}, Errore:`, error, 'Data:', data);
      hasFailures = true;
    }
  }

  // --- FASE 5: VERIFICA STORAGE UPLOAD ANONIMO ---
  console.log('\n--- FASE 5: VERIFICA SUPABASE STORAGE UPLOAD ANONIMO ---');
  const dummyBuffer = Buffer.from('Tentativo upload non autorizzato');
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('allegati')
    .upload('test_malicious_anon.png', dummyBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError && isRlsSecurityBlock(uploadError.statusCode || 401, uploadError)) {
    console.log(`[OK BLOCCATO DA RLS] UPLOAD su bucket 'allegati': ${uploadError.message} (Code: ${uploadError.statusCode || uploadError.error})`);
  } else {
    console.error(`[FALLIMENTO SICUREZZA] UPLOAD anonimo su 'allegati' NON è stato bloccato da RLS!`, uploadError, uploadData);
    hasFailures = true;
  }

  console.log('\n======================================================================');
  if (hasFailures) {
    console.error('ESITO AUDIT: FALLITO! Alcune violazioni di sicurezza sono state riscontrate.');
    console.error('======================================================================');
    process.exit(1);
  } else {
    console.log('ESITO AUDIT: SUPERATO AL 100%!');
    console.log('Tutte le scritture su tutte le tabelle e sullo Storage sono rigorosamente');
    console.log('bloccate dalle policy Row Level Security (RLS). Nessuna fuga di dati.');
    console.log('======================================================================');
    process.exit(0);
  }
}

runSecurityAudit();
