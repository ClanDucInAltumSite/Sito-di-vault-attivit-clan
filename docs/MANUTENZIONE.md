# Guida alla Manutenzione - Sito Vault Scout Clan

Questo documento descrive in italiano semplice e accessibile (pensato per i capi scout non programmatori) l'elenco di tutte le credenziali e i servizi esterni utilizzati dal sito, e la procedura di manutenzione periodica consigliata.

---

## 1. Elenco dei Servizi e delle Credenziali

L'applicazione del Vault di Clan è un'architettura a **costo zero** basata su tre piattaforme cloud affidabili:

| Servizio | Ruolo nel Sistema | Accesso / URL | Credenziali Necessarie |
| :--- | :--- | :--- | :--- |
| **GitHub** | Repository del codice, hosting del sito web (GitHub Pages) e automazioni CI/CD. | [Repository GitHub](https://github.com/ClanDucInAltumSite/Sito-di-vault-attivit-clan) | Account GitHub con permessi di amministratore sul repository (`ClanDucInAltumSite`). |
| **Supabase** | Database PostgreSQL online, archivio Storage per file allegati (foto e PDF) e autenticazione capi. | [Dashboard Supabase](https://supabase.com/dashboard/project/lpeiyzwccedtqjbficjo) | Email e password account Supabase del clan. Per il sito: credenziali Admin Capi (conservate nel password manager della staff di Clan). |
| **cron-job.org** | Servizio esterno di sentinella che invia un ping automatico ogni 2 giorni per evitare che Supabase vada in pausa. | [cron-job.org Console](https://cron-job.org) | Account gratuito su cron-job.org (registrato con l'account capi indicato nel password manager della staff). |

### Chiavi e Segreti (Cosa sono e dove risiedono)
- **`VITE_SUPABASE_URL`:** L'indirizzo web dell'istanza database (`https://lpeiyzwccedtqjbficjo.supabase.co`). È pubblico e configurato nel file `index.html` e nelle variabili di ambiente.
- **`VITE_SUPABASE_ANON_KEY`:** La chiave pubblica anonima di Supabase. Consente al browser di leggere i dati pubblici (giochi, bans, canti, calendario). Non permette alcuna scrittura se non autenticati con login capo.
- **Password Capi (Admin):** L'unica password riservata che permette ai capi di accedere all'area Admin, creare e modificare contenuti. Non è salvata in chiaro in nessun file e risiede cifrata nel database di Supabase Auth (reperibile nel password manager della staff di Clan).
- **`service_role` (DIVIETO ASSOLUTO):** Questa chiave di super-amministratore **NON deve mai essere inserita né usata** nel repository o nel frontend, per nessun motivo.

---

## 2. Cosa Fare Ogni Mese (Routine di 5 Minuti)

Per garantire che l'archivio rimanga sempre attivo, veloce e protetto da qualsiasi imprevisto, un capo incaricato della pattuglia logistica/comunicazione dovrebbe svolgere questi semplici passaggi una volta al mese:

### 1. Controllo di Vitalità del Database (Anti-Pausa)
- **Cosa succede:** Supabase (nel piano gratuito) mette automaticamente in pausa i progetti se trascorrono 7 giorni consecutivi senza alcuna richiesta al database.
- **Cosa fare:**
  - Aprire semplicemente il sito web dallo smartphone o dal computer una volta alla settimana, oppure verificare che l'email del clan non abbia ricevuto avvisi da Supabase o da `cron-job.org`.
  - Se il database dovesse andare in pausa, basta accedere alla dashboard di Supabase e cliccare sul pulsante verde **"Restore Project"** (il ripristino richiede circa 2 minuti e nessun dato viene perso).

### 2. Backup di Sicurezza dei Dati (JSON)
- **Cosa fare:**
  1. Accedere al sito ed effettuare il login come Admin (tasto *"Admin"* nella barra superiore).
  2. Nella sezione *"GESTIONE ARCHIVIO E DATI"*, toccare il pulsante **"Esporta"** accanto a *"Backup Completo (JSON)"*.
  3. Viene scaricato un file con data del tipo `vault-scout-backup-2026-10-16.json`.
  4. Salvare questo file nella cartella Google Drive del Clan o su una chiavetta USB della staff.
  - *Nota Importante:* Questo file contiene tutti i testi, le regole, i canti con accordi, le date e gli Ordini del Giorno. Non include i file fisici (PDF e foto) caricati nello Storage.

### 3. Conservazione File Allegati e Chiarimento sul Manifest
- **Chiarimento Fondamentale:**
  - Il file manifest degli allegati scaricabile da Admin (`vault-scout-allegati-manifest-[data].json`) è **soltanto un elenco di indirizzi web (URL)** e **NON costituisce un backup dei file fisici**.
  - Il pulsante *"Scarica tutto"* presente nell'Archivio Offline scarica i file **unicamente nella cache temporanea del browser di QUEL singolo dispositivo** per permetterne la consultazione offline, ma non genera un archivio permanente esportabile.
  - **Il vero backup dei file:** Consiste nei documenti e nelle immagini originali (schemi dei giochi, regolamenti in PDF, accordi musicali) conservati ordinatamente dalla staff di Clan nella **cartella condivisa del Clan (es. Google Drive della staff)**.
  - Per effettuare un dump di emergenza dei file memorizzati su Supabase, accedere periodicamente alla dashboard di Supabase -> sezione **Storage** -> bucket `allegati` -> selezionare e scaricare i file sul PC.

### 4. Verifica dello Spazio Occupato in Storage
- **Cosa fare:**
  1. Nel pannello Admin, controllare la riga *"Spazio Storage Utilizzato"*: mostra la percentuale di spazio occupato rispetto a 1 GB gratuito (es. `2.4%`).
  2. Toccare il pulsante **"Scansiona"** accanto a *"File Orfani in Storage"*.
  3. Se compaiono file vecchi non più associati ad alcun gioco o canto, toccare *"Ripulisci"* per liberare spazio.

### 5. Verifica Workflow GitHub Actions (Regola dei 60 Giorni)
- **Cosa succede:** GitHub sospende automaticamente le azioni pianificate se il repository rimane senza commit per 60 giorni.
- **Heartbeat e Limiti:** Il repository include un'automazione che, in caso di inattività prolungata (> 40 giorni), genera un micro-commit automatico su `docs/keepalive_heartbeat.txt`. Tale commit **dovrebbe evitare la disattivazione; GitHub non lo garantisce ufficialmente: per questo esistono il promemoria mensile e il ping esterno**.
- **Cosa fare:**
  - Aprire la pagina delle [Actions su GitHub](https://github.com/ClanDucInAltumSite/Sito-di-vault-attivit-clan/actions).
  - Verificare che il workflow `Keepalive Supabase & Repository` mostri l'icona verde di successo. Se compare un avviso giallo di inattività, cliccare su *"Enable workflow"*.

---

## 3. Gestione del Passaggio di Consegne (Cambio Capi / Staff)

A inizio anno scout, in caso di cambio della pattuglia capi o della staff di Clan:
1. Consegnare alla nuova staff l'email e la password di accesso all'area Admin (tramite il password manager di branca).
2. Se necessario cambiare la password:
   - Accedere alla console di Supabase -> *Authentication* -> *Users*.
   - Cliccare sui tre puntini accanto all'utente admin del Clan -> selezionare *"Send Password Reset"* o *"Change Password"*.
3. Assicurarsi che almeno due capi abbiano l'accesso all'account GitHub per gestire il repository e i deploy.
