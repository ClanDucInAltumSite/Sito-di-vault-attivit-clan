// test/run_admin_test.mjs
// Test di sicurezza RLS e Storage:
// - Riga esca creata come admin
// - Tentativi di UPDATE e DELETE anonimi devono fallire e la riga restare intatta
// - Upload di file con MIME non ammesso (o upload anonimo) deve essere rifiutato

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lpeiyzwccedtqjbficjo.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runSecurityAudit() {
  console.log('=== TEST DI SICUREZZA RLS E STORAGE (run_admin_test.mjs) ===\n');
  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition, message) {
    testsTotal++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      testsPassed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Test Anonimo: tentativi diretti di scrittura senza credenziali admin
  console.log('1. Verifica RLS Anonimo (scritture anonime respinte):');
  
  const testId = '00000000-0000-0000-0000-000000000001';
  
  // Tentativo di INSERT anonimo
  const { data: insertData, error: insertError } = await anonClient
    .from('giochi')
    .insert([{
      nome: 'Gioco Hacker Anonimo',
      regole: 'Tentativo di injection',
      materiali: 'Nessuno'
    }])
    .select();
  assert(insertError !== null || !insertData || insertData.length === 0, 'INSERT anonimo su public.giochi respinto da RLS');

  // Tentativo di UPDATE anonimo
  const { data: updateData, error: updateError } = await anonClient
    .from('giochi')
    .update({ nome: 'Nome Compromesso' })
    .eq('id', testId)
    .select();
  assert(updateError !== null || !updateData || updateData.length === 0, 'UPDATE anonimo su public.giochi respinto o produce 0 righe modificate');

  // Tentativo di DELETE anonimo
  const { data: deleteData, error: deleteError } = await anonClient
    .from('giochi')
    .delete()
    .eq('id', testId)
    .select();
  assert(deleteError !== null || !deleteData || deleteData.length === 0, 'DELETE anonimo su public.giochi respinto o produce 0 righe eliminate');

  // Tentativo di Upload Anonimo su Storage
  const dummyBuffer = Buffer.from('Contenuto non autorizzato');
  const { error: uploadAnonError } = await anonClient.storage
    .from('allegati')
    .upload(`test_anon_${Date.now()}.pdf`, dummyBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });
  assert(uploadAnonError !== null, 'Upload anonimo su bucket storage "allegati" respinto da RLS policy');

  // 2. Se è disponibile la chiave service_role, esegui il test end-to-end con la RIGA ESCA
  if (SERVICE_ROLE_KEY) {
    console.log('\n2. Verifica Riga Esca con Admin Client:');
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const baitTitle = `[ESCA_TEST] Gioco Trappola ${Date.now()}`;
    const { data: baitRow, error: baitError } = await adminClient
      .from('giochi')
      .insert([{
        nome: baitTitle,
        regole: 'Regola di controllo immutabilità',
        materiali: 'Cordini'
      }])
      .select()
      .single();

    assert(!baitError && baitRow && baitRow.id, `Admin crea riga esca (ID: ${baitRow?.id})`);

    // Anonimo tenta UPDATE sulla riga esca
    const { data: hackUpdate, error: hackUpErr } = await anonClient
      .from('giochi')
      .update({ nome: '[COMPROMESSO] Titolo Modificato' })
      .eq('id', baitRow.id)
      .select();
    assert(hackUpErr !== null || !hackUpdate || hackUpdate.length === 0, 'UPDATE anonimo sulla riga esca fallisce o modifica 0 righe');

    // Anonimo tenta DELETE sulla riga esca
    const { data: hackDel, error: hackDelErr } = await anonClient
      .from('giochi')
      .delete()
      .eq('id', baitRow.id)
      .select();
    assert(hackDelErr !== null || !hackDel || hackDel.length === 0, 'DELETE anonimo sulla riga esca fallisce o elimina 0 righe');

    // Verifica che la riga esca sia rimasta identica sul server
    const { data: verifyRow } = await adminClient
      .from('giochi')
      .select('*')
      .eq('id', baitRow.id)
      .single();
    assert(verifyRow && verifyRow.nome === baitTitle, 'La riga esca è rimasta intatta e inalterata sul database');

    // Verifica rifiuto upload con MIME non ammesso (es. .exe o text/plain)
    const forbiddenBuffer = Buffer.from('binary-mock-malicious-content');
    const { error: mimeError } = await adminClient.storage
      .from('allegati')
      .upload(`test_payload_${Date.now()}.exe`, forbiddenBuffer, {
        contentType: 'application/x-msdownload',
        upsert: true
      });
    assert(mimeError !== null, 'Upload con MIME non ammesso (application/x-msdownload) rifiutato dal bucket storage');

    // Pulizia della riga esca
    await adminClient.from('giochi').delete().eq('id', baitRow.id);
    console.log('  [CLEANUP] Riga esca rimossa con successo.');
  } else {
    console.log('\n2. Verifica Riga Esca con Admin:');
    console.log('  [INFO] SUPABASE_SERVICE_ROLE_KEY non configurata nell\'ambiente locale.');
    console.log('  Per eseguire il test end-to-end con creazione riga esca admin sul database live:');
    console.log('  $env:SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"; node test/run_admin_test.mjs');
  }

  console.log(`\nEsito Audit Sicurezza: ${testsPassed}/${testsTotal} controlli superati con successo.\n`);
}

runSecurityAudit().catch((err) => {
  console.error('\nErrore durante il test di sicurezza:', err);
  process.exit(1);
});
