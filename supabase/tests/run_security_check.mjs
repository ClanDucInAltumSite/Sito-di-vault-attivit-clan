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
 * Valuta se l'errore è un reale blocco da Row Level Security (RLS) di Postgres.
 * Esclude categoricamente 404, PGRST205, NoSuchBucket o errori generici di rete.
 */
function isStrictRlsBlock(status, error) {
  if (!error) return false;
  if (status === 404 || error.code === 'PGRST205') return false;
  if (error.code === 'NoSuchBucket' || error.message?.includes('Bucket not found')) return false;

  const isSecurityCode = error.code === '42501' || status === 401 || status === 403;
  const isRlsMessage = error.message && (
    error.message.toLowerCase().includes('violates row-level security policy') ||
    error.message.toLowerCase().includes('permission denied')
  );

  return isSecurityCode || isRlsMessage;
}

async function runSecurityAudit() {
  console.log('======================================================================');
  console.log('AUDIT DI SICUREZZA RIGOROSO - CON CHIAVE ANONIMA (ANON KEY)');
  console.log('URL:', SUPABASE_URL);
  console.log('======================================================================\n');

  let hasFailures = false;

  // --- FASE 0: CONTROLLO PRELIMINARE ESISTENZA SCHEMA E BUCKET ---
  console.log('--- FASE 0: CONTROLLO PRELIMINARE ESISTENZA SCHEMA E BUCKET ---');
  let schemaMissing = false;

  for (const table of CONTENT_TABLES) {
    const { error, status } = await supabase.from(table).select('id').limit(1);
    if (status === 404 || error?.code === 'PGRST205') {
      console.error(`[ERRORE BLOCCANTE] La tabella 'public.${table}' non esiste nello schema cache (HTTP ${status})`);
      schemaMissing = true;
    } else if (error) {
      console.error(`[ERRORE BLOCCANTE] Errore verifica tabella 'public.${table}': ${error.message} (Codice: ${error.code})`);
      schemaMissing = true;
    } else {
      console.log(`[OK ESISTE] Tabella 'public.${table}' presente e raggiungibile (Status: ${status})`);
    }
  }

  // Sonda per verificare esistenza bucket Storage "allegati"
  try {
    const probeUrl = `${SUPABASE_URL}/storage/v1/object/public/allegati/__probe_bucket_check__.txt`;
    const probeResponse = await fetch(probeUrl);
    const probeBody = await probeResponse.json().catch(() => ({}));

    if (probeBody.message === 'Object not found' || probeBody.code === 'NoSuchKey') {
      console.log(`[OK ESISTE] Bucket Storage 'allegati' presente e pubblico (Risposta sonda: "${probeBody.message}", Code: ${probeBody.code})`);
    } else if (probeBody.message === 'Bucket not found') {
      console.error(`[ERRORE BLOCCANTE] Il bucket Storage 'allegati' NON esiste su Supabase! (Messaggio: "Bucket not found")`);
      schemaMissing = true;
    } else {
      console.log(`[OK ESISTE] Bucket Storage 'allegati' risponde correttamente (HTTP ${probeResponse.status}): ${probeBody.message || 'Accessibile'}`);
    }
  } catch (probeErr) {
    console.error(`[ERRORE BLOCCANTE] Impossibile contattare l'endpoint di Storage:`, probeErr.message);
    schemaMissing = true;
  }

  if (schemaMissing) {
    console.error('\n======================================================================');
    console.error('TEST ANNULLATO: Lo schema o il bucket non risultano applicati su Supabase!');
    console.error('======================================================================');
    process.exit(1);
  }

  console.log('\nControllo preliminare superato con successo: tutte le risorse esistono.\n');

  // --- FASE 1: VERIFICA LETTURA PUBBLICA (SELECT) ---
  console.log('--- FASE 1: VERIFICA LETTURA PUBBLICA (SELECT) ---');
  for (const table of CONTENT_TABLES) {
    const { data, error, status } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`[FALLITO] SELECT anonima su '${table}' è fallita: ${error.message} (Status: ${status})`);
      hasFailures = true;
    } else {
      console.log(`[OK] SELECT pubblica su '${table}' consentita (Status: ${status}, elementi: ${data.length})`);
    }
  }

  // Verifica che admin_users NON sia leggibile dagli utenti anonimi
  const { data: adminData, error: adminError, status: adminStatus } = await supabase.from('admin_users').select('*');
  if (adminError && isStrictRlsBlock(adminStatus, adminError)) {
    console.log(`[OK] SELECT su 'admin_users' bloccata da RLS: ${adminError.message} (Status: ${adminStatus})`);
  } else if (!adminData || adminData.length === 0) {
    console.log(`[OK] SELECT su 'admin_users' protetta: RLS restituisce 0 righe ad utenti anonimi.`);
  } else {
    console.error(`[FALLIMENTO GRAVE] SELECT anonima su 'admin_users' ha esposto ${adminData.length} righe!`);
    hasFailures = true;
  }

  // --- FASE 2: VERIFICA INSERT ANONIMA (TUTTE DEVONO FALLIRE CON ERRORE RLS) ---
  console.log('\n--- FASE 2: VERIFICA INSERIMENTO ANONIMO (INSERT) ---');
  for (const table of ALL_TABLES) {
    const payload = DUMMY_RECORDS[table];
    const { data, error, status } = await supabase.from(table).insert(payload).select();
    if (isStrictRlsBlock(status, error)) {
      console.log(`[OK BLOCCATO DA RLS] INSERT su '${table}': Status ${status} | Codice: ${error.code} | ${error.message}`);
    } else {
      console.error(`[FALLIMENTO SICUREZZA] INSERT su '${table}' NON è stata bloccata da RLS! Status: ${status}, Errore:`, error, 'Data:', data);
      hasFailures = true;
    }
  }

  // --- FASE 3: VERIFICA UPDATE ANONIMA (DEVONO FALLIRE O ESSERE RESPINTE DA RLS) ---
  console.log('\n--- FASE 3: VERIFICA MODIFICA ANONIMA (UPDATE) ---');
  for (const table of ALL_TABLES) {
    let updatePayload;
    const idColumn = table === 'admin_users' ? 'user_id' : 'id';

    if (table === 'giochi' || table === 'bans') {
      updatePayload = { nome: 'Hacked Nome' };
    } else if (table === 'admin_users') {
      updatePayload = { created_at: new Date().toISOString() };
    } else {
      updatePayload = { updated_at: new Date().toISOString() };
    }

    const { data, error, status } = await supabase
      .from(table)
      .update(updatePayload)
      .neq(idColumn, '00000000-0000-0000-0000-000000000000')
      .select();

    if (isStrictRlsBlock(status, error)) {
      console.log(`[OK BLOCCATO DA RLS] UPDATE su '${table}': Status ${status} | Codice: ${error?.code} | ${error?.message}`);
    } else if (status === 200 && (!data || data.length === 0)) {
      console.log(`[OK BLOCCATO DA RLS] UPDATE su '${table}': RLS ha impedito la modifica (0 righe modificate)`);
    } else {
      console.error(`[FALLIMENTO SICUREZZA] UPDATE su '${table}' NON è stata bloccata da RLS! Status: ${status}, Errore:`, error, 'Data:', data);
      hasFailures = true;
    }
  }

  // --- FASE 4: VERIFICA ELIMINAZIONE ANONIMA (DELETE) ---
  console.log('\n--- FASE 4: VERIFICA ELIMINAZIONE ANONIMA (DELETE) ---');
  for (const table of ALL_TABLES) {
    const idColumn = table === 'admin_users' ? 'user_id' : 'id';

    const { data, error, status } = await supabase
      .from(table)
      .delete()
      .neq(idColumn, '00000000-0000-0000-0000-000000000000')
      .select();

    if (isStrictRlsBlock(status, error)) {
      console.log(`[OK BLOCCATO DA RLS] DELETE su '${table}': Status ${status} | Codice: ${error?.code} | ${error?.message}`);
    } else if (status === 200 && (!data || data.length === 0)) {
      console.log(`[OK BLOCCATO DA RLS] DELETE su '${table}': RLS ha impedito l'eliminazione (0 righe eliminate)`);
    } else {
      console.error(`[FALLIMENTO SICUREZZA] DELETE su '${table}' NON è stata bloccata da RLS! Status: ${status}, Errore:`, error, 'Data:', data);
      hasFailures = true;
    }
  }

  // --- FASE 5: VERIFICA STORAGE UPLOAD ANONIMO (DEVE FALLIRE CON STATUS 403 E VIOLAZIONE RLS) ---
  console.log('\n--- FASE 5: VERIFICA SUPABASE STORAGE UPLOAD ANONIMO ---');
  const dummyBuffer = Buffer.from('Tentativo upload non autorizzato');
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('allegati')
    .upload('test_malicious_anon.png', dummyBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  const uploadStatus = uploadError?.statusCode || uploadError?.status;
  const isUpload403 = uploadStatus === '403' || uploadStatus === 403;
  const isUploadRls = uploadError?.message && uploadError.message.toLowerCase().includes('violates row-level security policy');

  if (uploadError && isUpload403 && isUploadRls) {
    console.log(`[OK BLOCCATO DA RLS] UPLOAD su bucket 'allegati':`);
    console.log(`     HTTP Status: ${uploadStatus} | Codice: ${uploadError.code} | Messaggio: "${uploadError.message}"`);
  } else {
    console.error(`[FALLIMENTO SICUREZZA] UPLOAD anonimo su 'allegati' NON ha restituito 403 con violazione RLS!`, {
      uploadStatus,
      uploadError,
      uploadData,
    });
    hasFailures = true;
  }

  console.log('\n======================================================================');
  if (hasFailures) {
    console.error('ESITO AUDIT: FALLITO! Riscontrata almeno una violazione o risposta inattesa.');
    console.error('======================================================================');
    process.exit(1);
  } else {
    console.log('ESITO AUDIT: SUPERATO AL 100% CON SUCCESSO!');
    console.log('- Tutte le 6 tabelle di contenuto e il bucket "allegati" esistono.');
    console.log('- Tutte le letture (SELECT) pubbliche funzionano regolarmente.');
    console.log('- Tutte le scritture (INSERT, UPDATE, DELETE) sulle 7 tabelle sono bloccate da RLS (401/42501).');
    console.log('- L\'upload anonimo su Storage viene respinto con HTTP 403 e violazione RLS esplicita.');
    console.log('======================================================================');
    process.exit(0);
  }
}

runSecurityAudit();
