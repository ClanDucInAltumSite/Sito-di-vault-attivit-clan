import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpeiyzwccedtqjbficjo.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const TABLES = ['giochi', 'bans', 'canti', 'eventi', 'odg_punti', 'allegati', 'admin_users'];

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

async function runSecurityAudit() {
  console.log('======================================================================');
  console.log('AUDIT DI SICUREZZA CON CHIAVE ANONIMA (ANON KEY)');
  console.log('URL:', SUPABASE_URL);
  console.log('======================================================================\n');

  let passedAll = true;

  // 1. VERIFICA SELECT (LETTURA)
  console.log('--- FASE 1: VERIFICA LETTURA PUBBLICA (SELECT) ---');
  for (const table of TABLES) {
    const { data, error, status } = await supabase.from(table).select('*').limit(1);
    if (table === 'admin_users') {
      // admin_users non deve essere visibile agli anonimi
      if (error || (data && data.length === 0)) {
        console.log(`[OK] SELECT su '${table}' protetta: ${error ? error.message : '0 righe restituite (RLS)'} (Status: ${status})`);
      } else {
        console.error(`[FALLITO] SELECT su '${table}' ha restituito dati anonimi!`);
        passedAll = false;
      }
    } else {
      if (error) {
        console.error(`[ERRORE] SELECT su '${table}' fallita:`, error.message);
        passedAll = false;
      } else {
        console.log(`[OK] SELECT su '${table}' consentita pubblicamente (Status: ${status}, righe: ${data.length})`);
      }
    }
  }

  // 2. VERIFICA INSERT (TUTTE DEVONO FALLIRE)
  console.log('\n--- FASE 2: VERIFICA INSERIMENTO ANONIMO (INSERT) - DEVONO FALLIRE ---');
  for (const table of TABLES) {
    const payload = DUMMY_RECORDS[table];
    const { data, error, status } = await supabase.from(table).insert(payload).select();
    if (error) {
      console.log(`[OK BLOCCATO] INSERT su '${table}':`);
      console.log(`     HTTP Status: ${status} | Codice: ${error.code} | Messaggio: ${error.message}`);
    } else {
      console.error(`[FALLIMENTO SICUREZZA] INSERT su '${table}' è riuscita!`, data);
      passedAll = false;
    }
  }

  // 3. VERIFICA UPDATE (TUTTE DEVONO FALLIRE O AVERE 0 RIGHE COINVOLTE)
  console.log('\n--- FASE 3: VERIFICA MODIFICA ANONIMA (UPDATE) - DEVONO FALLIRE ---');
  for (const table of TABLES) {
    const updateField = table === 'giochi' || table === 'bans' ? { nome: 'Hacked Nome' } : { updated_at: new Date().toISOString() };
    const { data, error, status } = await supabase.from(table).update(updateField).neq('id', '00000000-0000-0000-0000-000000000000').select();
    if (error) {
      console.log(`[OK BLOCCATO] UPDATE su '${table}':`);
      console.log(`     HTTP Status: ${status} | Codice: ${error.code} | Messaggio: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log(`[OK BLOCCATO] UPDATE su '${table}':`);
      console.log(`     HTTP Status: ${status} | RLS ha impedito l'aggiornamento di qualsiasi riga (0 righe modificate)`);
    } else {
      console.error(`[FALLIMENTO SICUREZZA] UPDATE su '${table}' ha modificato righe!`, data);
      passedAll = false;
    }
  }

  // 4. VERIFICA DELETE (TUTTE DEVONO FALLIRE O AVERE 0 RIGHE COINVOLTE)
  console.log('\n--- FASE 4: VERIFICA ELIMINAZIONE ANONIMA (DELETE) - DEVONO FALLIRE ---');
  for (const table of TABLES) {
    const { data, error, status } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000').select();
    if (error) {
      console.log(`[OK BLOCCATO] DELETE su '${table}':`);
      console.log(`     HTTP Status: ${status} | Codice: ${error.code} | Messaggio: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log(`[OK BLOCCATO] DELETE su '${table}':`);
      console.log(`     HTTP Status: ${status} | RLS ha impedito l'eliminazione di qualsiasi riga (0 righe eliminate)`);
    } else {
      console.error(`[FALLIMENTO SICUREZZA] DELETE su '${table}' ha eliminato righe!`, data);
      passedAll = false;
    }
  }

  // 5. VERIFICA STORAGE (UPLOAD E LISTING)
  console.log('\n--- FASE 5: VERIFICA SUPABASE STORAGE BUCKET "allegati" ---');

  // A. Tentativo di UPLOAD anonimo
  const dummyFileContent = Buffer.from('File di test anonimo non autorizzato');
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('allegati')
    .upload('test_anon_malicious.png', dummyFileContent, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) {
    console.log(`[OK BLOCCATO] UPLOAD su bucket 'allegati':`);
    console.log(`     Messaggio: ${uploadError.message} | Errore: ${JSON.stringify(uploadError)}`);
  } else {
    console.error(`[FALLIMENTO SICUREZZA] UPLOAD anonimo su 'allegati' è riuscito!`, uploadData);
    passedAll = false;
  }

  // B. Tentativo di LISTING anonimo
  const { data: listData, error: listError } = await supabase.storage.from('allegati').list();
  if (listError || (listData && listData.length === 0)) {
    console.log(`[OK BLOCCATO] LISTING anonimo su bucket 'allegati' protetto:`);
    console.log(`     ${listError ? listError.message : '0 file restituiti (listing negato da RLS)'}`);
  } else {
    console.error(`[ATTENZIONE] LISTING anonimo ha restituito file:`, listData);
  }

  console.log('\n======================================================================');
  if (passedAll) {
    console.log('ESITO AUDIT: TUTTI I TEST DI SICUREZZA ANONIMI SONO STATI SUPERATI!');
    console.log('Nessuna operazione di scrittura (INSERT, UPDATE, DELETE, UPLOAD) è consentita.');
  } else {
    console.error('ESITO AUDIT: ATTENZIONE, ALCUNI TEST DI SICUREZZA SONO FALLITI!');
  }
  console.log('======================================================================');
}

runSecurityAudit();
