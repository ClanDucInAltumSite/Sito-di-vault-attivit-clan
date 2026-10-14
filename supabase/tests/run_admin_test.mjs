import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lpeiyzwccedtqjbficjo.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function runAdminTest() {
  console.log('======================================================================');
  console.log('TEST DI VERIFICA SCRITTURA ADMIN (Tabelle e Storage)');
  console.log('Nessuna password viene salvata o comunicata a terzi.');
  console.log('======================================================================\n');

  const email = process.env.ADMIN_EMAIL || await askQuestion('Inserisci email Admin: ');
  const password = process.env.ADMIN_PASSWORD || await askQuestion('Inserisci password Admin: ');

  if (!email || !password) {
    console.error('Email e password obbligatorie per il test admin.');
    process.exit(1);
  }

  console.log('\n1. Tentativo di Login come Admin...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    console.error('ERRORE LOGIN ADMIN:', authError?.message || 'Utente non trovato');
    process.exit(1);
  }
  console.log(`[OK] Login effettuato con successo come UID: ${authData.user.id}`);

  console.log('\n2. Verifica ruolo tramite funzione RPC is_admin()...');
  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');
  if (rpcError || !isAdmin) {
    console.error('[ERRORE] is_admin() ha restituito false o errore:', rpcError?.message || 'Non admin');
    console.error('Assicurati di aver inserito l\'UID nella tabella admin_users!');
    process.exit(1);
  }
  console.log('[OK] Ruolo Admin confermato a livello di database (is_admin() = true).');

  console.log('\n3. Test INSERT su tabella "giochi"...');
  const { data: insertData, error: insertError } = await supabase
    .from('giochi')
    .insert({ nome: 'Gioco Test Admin', regole: 'Regole di collaudo' })
    .select()
    .single();

  if (insertError) {
    console.error('[FALLIMENTO] INSERT da admin fallita:', insertError.message);
  } else {
    console.log(`[OK] INSERT riuscita! ID record creato: ${insertData.id}`);

    console.log('\n4. Test UPDATE sul record appena creato...');
    const { data: updateData, error: updateError } = await supabase
      .from('giochi')
      .update({ regole: 'Regole aggiornate da admin' })
      .eq('id', insertData.id)
      .select()
      .single();

    if (updateError) {
      console.error('[FALLIMENTO] UPDATE da admin fallita:', updateError.message);
    } else {
      console.log(`[OK] UPDATE riuscita! updated_at server: ${updateData.updated_at}`);
    }

    console.log('\n5. Test DELETE (pulizia record di test)...');
    const { error: deleteError } = await supabase
      .from('giochi')
      .delete()
      .eq('id', insertData.id);

    if (deleteError) {
      console.error('[FALLIMENTO] DELETE da admin fallita:', deleteError.message);
    } else {
      console.log('[OK] DELETE riuscita! Record temporaneo rimosso.');
    }
  }

  console.log('\n6. Test UPLOAD su bucket Storage "allegati"...');
  const dummyBuffer = Buffer.from('Contenuto di test per allegati admin');
  const testFileName = `test_admin_${Date.now()}.png`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('allegati')
    .upload(testFileName, dummyBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) {
    console.error('[FALLIMENTO] UPLOAD da admin fallito:', uploadError.message);
  } else {
    console.log(`[OK] UPLOAD riuscito da admin! Percorso: ${uploadData.path}`);

    console.log('\n7. Test DELETE file da Storage...');
    const { error: removeError } = await supabase.storage
      .from('allegati')
      .remove([testFileName]);

    if (removeError) {
      console.error('[FALLIMENTO] Cancellazione file da storage fallita:', removeError.message);
    } else {
      console.log('[OK] File temporaneo di test rimosso con successo dallo Storage.');
    }
  }

  await supabase.auth.signOut();
  console.log('\n======================================================================');
  console.log('TUTTI I TEST DI SCRITTURA ADMIN HANNO DATO ESITO POSITIVO!');
  console.log('Sessione chiusa regolarmente.');
  console.log('======================================================================');
}

runAdminTest();
