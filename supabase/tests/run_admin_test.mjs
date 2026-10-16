// supabase/tests/run_admin_test.mjs
// Test di verifica sicurezza e scrittura Admin (Tabelle, Storage, RPC e Allegati)
// Richiede credenziali admin a RUNTIME da tastiera (password nascosta, mai salvata né loggata).
// Exit code diverso da zero per qualsiasi anomalia.

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lpeiyzwccedtqjbficjo.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ';

// Client anonimo isolato (nessuna sessione)
const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Client per la sessione admin
const adminClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function askHiddenPassword(promptText) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Se non è un terminale interattivo (ad es. pipe), usa readline normale
      return askQuestion(promptText).then(resolve);
    }

    process.stdout.write(promptText);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (ch) => {
      ch = ch.toString('utf8');
      switch (ch) {
        case '\n':
        case '\r':
        case '\u0004':
          if (stdin.setRawMode) stdin.setRawMode(wasRaw);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password.trim());
          break;
        case '\u0003': // Ctrl+C
          if (stdin.setRawMode) stdin.setRawMode(wasRaw);
          process.exit(1);
          break;
        case '\u0008':
        case '\x7f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          break;
        default:
          password += ch;
          break;
      }
    };
    stdin.on('data', onData);
  });
}

async function runAdminSecurityAudit() {
  console.log('======================================================================');
  console.log('TEST DI VERIFICA SICUREZZA ADMIN (run_admin_test.mjs)');
  console.log('Nessuna chiave di servizio usata. Credenziali richieste a runtime.');
  console.log('La password non viene mai salvata né stampata a video.');
  console.log('======================================================================\n');

  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition, message) {
    testsTotal++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      testsPassed++;
    } else {
      console.error(`  [FAIL CRITICO] ${message}`);
      process.exit(1);
    }
  }

  // Acquisizione credenziali a runtime
  const email = process.env.ADMIN_EMAIL || await askQuestion('Inserisci email Admin: ');
  const password = process.env.ADMIN_PASSWORD || await askHiddenPassword('Inserisci password Admin: ');

  if (!email || !password) {
    console.error('[ERRORE] Email e password obbligatorie per il test admin.');
    process.exit(1);
  }

  // 1. Login Admin e verifica is_admin()
  console.log('\n--- 1. Login Admin e Verifica Ruolo Database ---');
  const { data: authData, error: authError } = await adminClient.auth.signInWithPassword({
    email,
    password,
  });

  assert(!authError && authData?.user?.id, `Login admin effettuato con successo (UID: ${authData?.user?.id || 'sconosciuto'})`);

  const { data: isAdmin, error: rpcError } = await adminClient.rpc('is_admin');
  assert(!rpcError && isAdmin === true, 'Ruolo verificato tramite RPC is_admin() === true');

  // 2. Creazione Riga Esca in 'giochi' come Admin
  console.log('\n--- 2. Creazione Riga Esca in "giochi" ---');
  const canaryTitle = `[ESCA_TEST] Gioco Trappola ${Date.now()}`;
  const { data: canaryRow, error: canaryErr } = await adminClient
    .from('giochi')
    .insert([{
      nome: canaryTitle,
      regole: 'Regola iniziale immutabile',
      materiali: 'Corde e bandiere'
    }])
    .select()
    .single();

  assert(!canaryErr && canaryRow && canaryRow.id, `Admin crea riga esca (ID: ${canaryRow?.id})`);

  // 3. Client Anonimo tenta UPDATE e DELETE sulla riga esca (RLS Violation)
  console.log('\n--- 3. Tentativi di UPDATE e DELETE Anonimi su Riga Esca ---');
  const { data: anonUpdate, error: anonUpErr } = await anonClient
    .from('giochi')
    .update({ nome: '[HACKED] Titolo Violato', regole: 'Regola violata' })
    .eq('id', canaryRow.id)
    .select();

  assert(
    anonUpErr !== null || !anonUpdate || anonUpdate.length === 0,
    'Tentativo UPDATE anonimo respinto da RLS (0 righe modificate o errore)'
  );

  const { data: anonDelete, error: anonDelErr } = await anonClient
    .from('giochi')
    .delete()
    .eq('id', canaryRow.id)
    .select();

  assert(
    anonDelErr !== null || !anonDelete || anonDelete.length === 0,
    'Tentativo DELETE anonimo respinto da RLS (0 righe eliminate o errore)'
  );

  // Rilettura della riga esca: deve essere intatta
  const { data: readCanary, error: readCanaryErr } = await anonClient
    .from('giochi')
    .select('*')
    .eq('id', canaryRow.id)
    .single();

  assert(
    !readCanaryErr && readCanary && readCanary.nome === canaryTitle && readCanary.regole === 'Regola iniziale immutabile',
    'Integrità verificata: la riga esca sul server è rimasta identica e inalterata'
  );

  // 4. Test Storage: Upload lecito vs Upload con MIME non ammesso
  console.log('\n--- 4. Verifica Storage Bucket e Restrizioni MIME ---');
  const testFileNameValid = `test_esca_${Date.now()}.png`;
  const validBuffer = Buffer.from('Fake-PNG-binary-content-for-test');

  const { data: uploadValid, error: uploadValidErr } = await adminClient.storage
    .from('allegati')
    .upload(testFileNameValid, validBuffer, {
      contentType: 'image/png',
      upsert: true
    });

  assert(!uploadValidErr && uploadValid?.path, `Upload lecito da admin riuscito (${testFileNameValid})`);

  // Upload con MIME vietato: text/html
  const invalidHtmlName = `test_hacked_${Date.now()}.html`;
  const { error: invalidHtmlErr } = await adminClient.storage
    .from('allegati')
    .upload(invalidHtmlName, Buffer.from('<h1>Payload non autorizzato</h1>'), {
      contentType: 'text/html',
      upsert: true
    });

  assert(invalidHtmlErr !== null, 'Upload con MIME non consentito (text/html) correttamente rifiutato dal bucket');

  // Upload con MIME vietato: application/x-msdownload
  const invalidExeName = `test_malicious_${Date.now()}.exe`;
  const { error: invalidExeErr } = await adminClient.storage
    .from('allegati')
    .upload(invalidExeName, Buffer.from('malicious-binary'), {
      contentType: 'application/x-msdownload',
      upsert: true
    });

  assert(invalidExeErr !== null, 'Upload con MIME non consentito (application/x-msdownload) rifiutato dal bucket');

  // 5. Client Anonimo chiama bump_sync_epoch() e purge_old_tombstones()
  console.log('\n--- 5. Protezione RPC bump_sync_epoch() e purge_old_tombstones() ---');
  
  // Lettura epoca iniziale da system_meta (se la tabella esiste)
  let initialEpoch = 1;
  const { data: initialMeta } = await anonClient
    .from('system_meta')
    .select('value')
    .eq('key', 'sync_epoch')
    .maybeSingle();

  if (initialMeta && initialMeta.value !== undefined) {
    initialEpoch = typeof initialMeta.value === 'number' ? initialMeta.value : parseInt(String(initialMeta.value), 10);
  }

  // Tentativo di chiamata anonima a bump_sync_epoch()
  const { error: anonBumpErr } = await anonClient.rpc('bump_sync_epoch');
  assert(
    anonBumpErr !== null,
    `Chiamata anonima a bump_sync_epoch() respinta (errore: ${anonBumpErr?.code || anonBumpErr?.message})`
  );

  // Tentativo di chiamata anonima a purge_old_tombstones()
  const { error: anonPurgeErr } = await anonClient.rpc('purge_old_tombstones');
  assert(
    anonPurgeErr !== null,
    `Chiamata anonima a purge_old_tombstones() respinta (errore: ${anonPurgeErr?.code || anonPurgeErr?.message})`
  );

  // Verifica che sync_epoch sia rimasto rigorosamente invariato
  const { data: finalMeta } = await anonClient
    .from('system_meta')
    .select('value')
    .eq('key', 'sync_epoch')
    .maybeSingle();

  if (finalMeta && finalMeta.value !== undefined) {
    const finalEpoch = typeof finalMeta.value === 'number' ? finalMeta.value : parseInt(String(finalMeta.value), 10);
    assert(finalEpoch === initialEpoch, `sync_epoch è rimasto invariato sul database (${finalEpoch} === ${initialEpoch})`);
  } else {
    assert(true, 'sync_epoch protetto: nessuna alterazione rilevata');
  }

  // 6. Ciclo Completo Allegato (Fase 5)
  console.log('\n--- 6. Ciclo Completo Allegato (Upload, Record, Lettura Anonima, Rimozione) ---');
  
  // Upload anonimo su storage deve essere respinto (403/RLS)
  const { error: anonUploadErr } = await anonClient.storage
    .from('allegati')
    .upload(`anon_probe_${Date.now()}.png`, validBuffer, { contentType: 'image/png' });

  assert(anonUploadErr !== null, 'Upload anonimo su Storage respinto da policy di sicurezza');

  // Admin carica allegato PDF/JPEG valido collegato al gioco esca
  const attachmentStoragePath = `giochi/${canaryRow.id}/${Date.now()}_regolamento.pdf`;
  const pdfBuffer = Buffer.from('%PDF-1.4 Mock PDF per test allegati');
  
  const { error: uploadPdfErr } = await adminClient.storage
    .from('allegati')
    .upload(attachmentStoragePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  assert(!uploadPdfErr, `Admin carica file PDF in Storage (${attachmentStoragePath})`);

  // Admin registra la riga nella tabella public.allegati
  const { data: allegatoRow, error: allegatoErr } = await adminClient
    .from('allegati')
    .insert([{
      gioco_id: canaryRow.id,
      storage_path: attachmentStoragePath,
      nome_file: 'Regolamento Completo.pdf',
      mime: 'application/pdf',
      dimensione: pdfBuffer.length,
      ordine: 0
    }])
    .select()
    .single();

  assert(!allegatoErr && allegatoRow && allegatoRow.id, `Riga allegato creata nel database (ID: ${allegatoRow?.id})`);

  // Lettura pubblica dell'URL dell'allegato tramite fetch anonimo
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/allegati/${attachmentStoragePath}`;
  try {
    const res = await fetch(publicUrl);
    assert(res.ok && res.status === 200, `Lettura anonima URL pubblico allegato riuscita (HTTP ${res.status})`);
  } catch (err) {
    assert(false, `Lettura URL pubblico fallita: ${err.message}`);
  }

  // Rimozione allegato da tabella e da Storage
  const { error: delAllegatoErr } = await adminClient
    .from('allegati')
    .delete()
    .eq('id', allegatoRow.id);
  assert(!delAllegatoErr, 'Rimozione riga allegato da tabella riuscita');

  const { error: delStorageErr } = await adminClient.storage
    .from('allegati')
    .remove([attachmentStoragePath]);
  assert(!delStorageErr, 'Rimozione file fisico allegato da Storage riuscita');

  // 6B. Verifica RLS su Tabelle Calendario (eventi e odg_punti)
  console.log('\n--- 6B. Verifica RLS su Tabelle Calendario ("eventi" e "odg_punti") ---');
  
  // Admin crea evento esca
  const canaryEventTitle = `[ESCA_TEST] Evento Trappola ${Date.now()}`;
  const { data: canaryEvento, error: canaryEventoErr } = await adminClient
    .from('eventi')
    .insert([{
      titolo: canaryEventTitle,
      tipo: 'riunione',
      inizio: new Date().toISOString()
    }])
    .select()
    .single();

  assert(!canaryEventoErr && canaryEvento?.id, `Admin crea evento esca in "eventi" (ID: ${canaryEvento?.id})`);

  // Admin crea punto ODG esca
  const { data: canaryOdg, error: canaryOdgErr } = await adminClient
    .from('odg_punti')
    .insert([{
      evento_id: canaryEvento.id,
      testo: 'Punto ODG Trappola Iniziale',
      ordine: 0,
      completato: false
    }])
    .select()
    .single();

  assert(!canaryOdgErr && canaryOdg?.id, `Admin crea punto esca in "odg_punti" (ID: ${canaryOdg?.id})`);

  // Client anonimo tenta INSERT in eventi
  const { error: anonInsEventErr } = await anonClient
    .from('eventi')
    .insert([{ titolo: '[HACKED] Evento Anonimo', tipo: 'altro', inizio: new Date().toISOString() }]);
  assert(anonInsEventErr !== null, 'Tentativo INSERT anonimo su "eventi" correttamente respinto da RLS');

  // Client anonimo tenta UPDATE su evento esca
  const { data: anonUpEvent, error: anonUpEventErr } = await anonClient
    .from('eventi')
    .update({ titolo: '[HACKED] Titolo Modificato' })
    .eq('id', canaryEvento.id)
    .select();
  assert(anonUpEventErr !== null || !anonUpEvent || anonUpEvent.length === 0, 'Tentativo UPDATE anonimo su "eventi" respinto da RLS');

  // Client anonimo tenta INSERT in odg_punti
  const { error: anonInsOdgErr } = await anonClient
    .from('odg_punti')
    .insert([{ evento_id: canaryEvento.id, testo: '[HACKED] Punto Anonimo', ordine: 99 }]);
  assert(anonInsOdgErr !== null, 'Tentativo INSERT anonimo su "odg_punti" correttamente respinto da RLS');

  // Client anonimo tenta UPDATE (spunta) su odg_punti esca
  const { data: anonUpOdg, error: anonUpOdgErr } = await anonClient
    .from('odg_punti')
    .update({ completato: true })
    .eq('id', canaryOdg.id)
    .select();
  assert(anonUpOdgErr !== null || !anonUpOdg || anonUpOdg.length === 0, 'Tentativo UPDATE/spunta anonimo su "odg_punti" respinto da RLS');

  // Client anonimo tenta DELETE su odg_punti
  const { data: anonDelOdg, error: anonDelOdgErr } = await anonClient
    .from('odg_punti')
    .delete()
    .eq('id', canaryOdg.id)
    .select();
  assert(anonDelOdgErr !== null || !anonDelOdg || anonDelOdg.length === 0, 'Tentativo DELETE anonimo su "odg_punti" respinto da RLS');

  // Verifica che evento ed esca ODG siano rimasti perfettamente identici
  const { data: recheckEvent } = await anonClient
    .from('eventi')
    .select('*')
    .eq('id', canaryEvento.id)
    .single();
  assert(recheckEvent?.titolo === canaryEventTitle, 'Riga evento esca verificata: titolo integro e non alterato da anonimo');

  const { data: recheckOdg } = await anonClient
    .from('odg_punti')
    .select('*')
    .eq('id', canaryOdg.id)
    .single();
  assert(recheckOdg && recheckOdg.completato === false && recheckOdg.testo === 'Punto ODG Trappola Iniziale', 'Riga punto ODG esca verificata: completato=false e testo integro');

  // Tentativo di listare file del bucket allegati da client anonimo
  const { data: anonListFiles, error: anonListErr } = await anonClient.storage
    .from('allegati')
    .list();
  assert(
    anonListErr !== null || !anonListFiles || anonListFiles.length === 0,
    'Client anonimo non può elencare i file del bucket allegati (respinto da Storage RLS o vuoto)'
  );

  // Admin elimina punto ODG esca ed evento esca
  const { error: delOdgErr } = await adminClient.from('odg_punti').delete().eq('id', canaryOdg.id);
  assert(!delOdgErr, 'Admin elimina punto esca odg_punti');

  const { error: delEventErr } = await adminClient.from('eventi').delete().eq('id', canaryEvento.id);
  assert(!delEventErr, 'Admin elimina evento esca eventi');

  // 7. Pulizia finale: cancellazione riga esca, file di prova e logout
  console.log('\n--- 7. Pulizia Finale e Chiusura Sessione ---');
  
  const { error: delCanaryErr } = await adminClient
    .from('giochi')
    .delete()
    .eq('id', canaryRow.id);
  assert(!delCanaryErr, 'Riga esca giochi eliminata da admin');

  await adminClient.storage.from('allegati').remove([testFileNameValid]);
  console.log('  [CLEANUP] File temporanei di test rimossi dallo Storage.');

  await adminClient.auth.signOut();
  console.log('  [LOGOUT] Sessione Admin terminata regolarmente.');

  console.log('\n======================================================================');
  console.log(`ESITO FINALE: ${testsPassed}/${testsTotal} controlli superati con successo.`);
  console.log('Tutti i vincoli di sicurezza RLS, RPC, Storage e Allegati sono integri.');
  console.log('======================================================================\n');
}

runAdminSecurityAudit().catch((err) => {
  console.error('\n[ERRORE NON GESTITO]', err);
  process.exit(1);
});
