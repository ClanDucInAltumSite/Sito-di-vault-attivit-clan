# Guida di Configurazione Manuale - Sito Vault Scout Clan

Questa guida spiega passo passo, in italiano semplice e per chi non è un programmatore, come configurare Supabase, GitHub e l'utenza di amministrazione per far funzionare il Vault di Clan.

---

## 0. Applicazione dello Schema del Database (Tabelle e RLS)

Prima di procedere con l'autenticazione, è necessario creare le tabelle e le regole di sicurezza:
1. Accedi alla dashboard del tuo progetto Supabase: `https://supabase.com/dashboard/project/lpeiyzwccedtqjbficjo`
2. Nel menu a sinistra, clicca sull'icona **SQL Editor** (icona con il simbolo `>_`).
3. Clicca sul pulsante verde **"New query"**.
4. Apri il file del repository [`supabase/full_schema.sql`](file:///c:/Users/Utente/Documents/Progetti_e_programmi/Siti%20miei/Sito%20Vault%20Scout/supabase/full_schema.sql), copia **tutto il suo contenuto** e incollalo nell'editor SQL di Supabase.
5. Clicca sul pulsante verde **Run** in basso a destra.
6. Entro pochi secondi vedrai la scritta verde *"Success. No rows returned"*. Tutte le 7 tabelle, i trigger di sicurezza, la pubblicazione Realtime e il bucket di Storage sono ora creati e protetti!

---

## 1. Configurazione dell'Autenticazione Supabase

### 1.1 Disabilitare la registrazione pubblica
Per evitare che persone non autorizzate possano registrarsi all'app:
1. Accedi alla dashboard del tuo progetto Supabase.
2. Nel menu a sinistra, clicca sull'icona **Authentication** (icona con l'omino o il lucchetto).
3. Clicca su **Configuration** (o **Providers**).
4. Seleziona **Email**.
5. Cerca la voce **"Enable email signups"** (Abilita registrazioni email) e **DISATTIVALO** (deve essere spento/grigio).
6. Clicca su **Save** in fondo alla pagina.

### 1.2 Creazione dell'Utente Amministratore (Admin)
L'applicazione prevede un'unica utenza admin (email + password) condivisa tra i capi clan per inserire e modificare canti, giochi, bans e calendario.

1. Sempre nella sezione **Authentication**, clicca sulla scheda **Users**.
2. Clicca sul pulsante verde in alto a destra **"Add user"** e scegli **"Create user"**.
3. Inserisci:
   - **Email:** l'indirizzo email ufficiale della staff di Clan (annotato nel password manager del clan).
   - **Password:** una password sicura generata e salvata nel password manager del clan.
   - Assicurati che sia spuntata la casella **"Auto Confirm User"** (così non servirà attendere o confermare l'email).
4. Clicca su **"Create user"**.
5. Nella lista degli utenti vedrai ora comparire l'utente appena creato. Accanto all'email compare una serie di lettere e numeri separati da trattini chiamata **User UID** (esempio: `a1b2c3d4-e5f6-7890-abcd-1234567890ab`).
6. Clicca sull'icona del foglietto accanto all'UID per copiarlo negli appunti.

### 1.3 Assegnazione del ruolo Admin nel Database
Affinché questo utente possa effettivamente modificare i dati nell'app:
1. Nel menu a sinistra di Supabase, clicca su **SQL Editor** (l'icona con il simbolo `>_`).
2. Clicca su **"New query"**.
3. Incolla il seguente comando, sostituendo l'UID di esempio con quello appena copiato al punto 1.2:

```sql
INSERT INTO public.admin_users (user_id)
VALUES ('INCOLLA_QUI_IL_TUO_USER_UID');
```

4. Clicca sul pulsante verde **Run** in basso a destra. Vedrai comparire la scritta verde *"Success. No rows returned"*.
L'admin è ora configurato e protetto a livello di database.

---

## 2. Cosa fare se le credenziali Admin vengono smarrite o compromesse

Se la password dell'admin finisce nelle mani di ragazzi del clan o di persone esterne:
1. Accedi subito alla dashboard di Supabase.
2. Vai su **Authentication** -> **Users**.
3. Clicca sui tre puntini `...` a destra dell'utente admin e seleziona **"Send password reset"** oppure modifica direttamente la password da **"Edit user"**.
4. In alternativa, se vuoi bloccare l'accesso all'istante:
   - Vai su **SQL Editor** e digita:
     ```sql
     DELETE FROM public.admin_users;
     ```
   - Esegui la query. Da questo istante, **nessuno potrà più modificare nulla**, anche conoscendo la vecchia password, finché non reinserirai un nuovo UID autorizzato.

---

## 3. Configurazione del Repository GitHub

Il repository del progetto è:
`https://github.com/ClanDucInAltumSite/Sito-di-vault-attivit-clan`

### 3.1 Abilitare GitHub Pages
1. Apri la pagina del repository su GitHub nel browser.
2. Clicca sulla scheda **Settings** in alto.
3. Nel menu di sinistra, clicca su **Pages**.
4. Sotto la voce **"Build and deployment"**, nella tendina **Source**, seleziona:
   **GitHub Actions**.
   *(Non serve selezionare un branch, la pubblicazione avverrà in automatico tramite il file di deploy).*

### 3.2 Inserire i Secrets e le Variabili di Ambiente
Per permettere alla compilazione del sito e al controllo periodico anti-pausa di funzionare:
1. Sempre in **Settings**, nel menu a sinistra clicca su **Secrets and variables** -> **Actions**.
2. Nella scheda **Variables** (o Secrets), clicca su **"New repository secret"** (o variable) e aggiungi:
   - Nome: `VITE_SUPABASE_URL`
     Valore: `https://lpeiyzwccedtqjbficjo.supabase.co`
   - Nome: `VITE_SUPABASE_ANON_KEY`
     Valore: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ`

### 3.3 Permessi di Scrittura per GitHub Actions
Per consentire al workflow periodico di mantenere attivo il repository oltre i 60 giorni:
1. In **Settings** -> **Actions** -> **General**.
2. Scorri verso il basso fino alla sezione **"Workflow permissions"**.
3. Seleziona l'opzione **"Read and write permissions"**.
4. Spunta la casella **"Allow GitHub Actions to create and approve pull requests"**.
5. Clicca su **Save**.

---

## 4. Controllo del Keepalive (Anti-Pausa Supabase e Heartbeat 60 Giorni)

Il piano gratuito di Supabase spegne il database se non riceve richieste per 7 giorni consecutivi. Inoltre, GitHub Actions disattiva automaticamente i workflow pianificati (*cron*) nei repository in cui non viene effettuato alcun commit o attività per 60 giorni consecutivi.

Il nostro sistema include un'azione automatica a doppio effetto che ogni 2 giorni invia una richiesta a Supabase per mantenerlo sempre attivo ed effettua un heartbeat automatico se necessario.

### 4.1 Come Funziona l'Heartbeat dei 60 Giorni e la Protezione del Ramo
Nel file `.github/workflows/keepalive.yml`:
1. **Calcolo Inattività:** Il workflow calcola i giorni trascorsi dall'ultimo commit: `DIFF_DAYS=$(( (CURRENT_DATE - LAST_COMMIT_DATE) / 86400 ))`.
2. **Heartbeat su Ramo Dedicato (`keepalive-heartbeat`):** Se `DIFF_DAYS > 40` (o se forzato via `workflow_dispatch`), il runner esegue un micro-commit automatico sul file `docs/keepalive_heartbeat.txt` con messaggio `chore(keepalive): heartbeat reset 60gg inattività [skip ci]` e lo spinge **esclusivamente sul ramo dedicato `keepalive-heartbeat`** (`git push origin keepalive-heartbeat --force`).
   - **Perché NON su `main`?** Secondo la documentazione ufficiale di GitHub Actions, qualsiasi push su *qualsiasi* ramo del repository azzera il timer dei 60 giorni di inattività. Scrivere su `keepalive-heartbeat` permette di mantenere attive le Actions senza violare le regole di protezione di `main` (che richiedono PR e CI verde) e senza sporcare la cronologia di produzione.
3. **Limiti Intrinseci e Requisiti dell'Heartbeat:**
   - **Permessi di Scrittura:** Richiede che i permessi di GitHub Actions siano impostati su *"Read and write permissions"* (Sezione 3.3). Se questo permesso non è concesso, il git push fallirà.
   - **Variabilità dei Cron Gratuiti:** I cron gratuiti di GitHub Actions sono ad alta tolleranza temporale; in orari di picco della piattaforma, l'esecuzione può subire ritardi di 1-2 ore (ampiamente assorbiti dalla frequenza di 2 giorni rispetto ai 7 giorni di Supabase).
   - **Impossibilità di Risvegliare un Database già Sospeso:** Se l'istanza Supabase dovesse essere sospesa per errore (ad esempio dopo 7 giorni di disservizio prolungato), una richiesta HTTP REST riceverà errore `503 Service Unavailable`, ma *non* riattiverà automaticamente il container Docker di Supabase. In quel caso è indispensabile accedere alla dashboard web di Supabase e cliccare "Restore project". Da qui l'importanza del secondo livello di monitoraggio esterno.

### 4.2 Come Verificare che Stia Funzionando (Prova Manuale)
1. Sul repository GitHub, clicca sulla scheda **Actions** in alto.
2. Nella colonna di sinistra, clicca su **"Keepalive Supabase & Repository"**.
3. Vedrai l'elenco delle esecuzioni passate con una spunta verde.
4. Per eseguire una prova manuale immediata dell'heartbeat sul ramo dedicato:
   - Clicca sul pulsante **"Run workflow"** sulla destra.
   - Nel campo *"Imposta a 'true' per forzare l'heartbeat immediato su ramo dedicato keepalive-heartbeat"*, digita `true`.
   - Conferma cliccando sul tasto verde **"Run workflow"**.
   - Entro 30 secondi vedrai completare il job con successo e comparirà o si aggiornerà il ramo `keepalive-heartbeat` su GitHub con timestamp aggiornato.

### 4.3 Rete di Sicurezza Esterna Gratuita (cron-job.org)
Per garantire che il database non vada mai in pausa anche nell'eventualità di disservizi di GitHub, imposta un ping esterno gratuito su [cron-job.org](https://cron-job.org):
1. Registrati gratuitamente su [https://cron-job.org](https://cron-job.org).
2. Clicca sul pulsante **"Create cronjob"** (o "Crea cronjob").
3. **Titolo:** `Vault Scout Clan Keepalive`.
4. **URL:** Inserisci l'endpoint REST leggero verificato (risponde HTTP 200 OK):
   ```text
   https://lpeiyzwccedtqjbficjo.supabase.co/rest/v1/giochi?select=id&limit=1
   ```
5. **Pianificazione (Execution schedule):**
   - Seleziona **"Every 2 days"** (Ogni 2 giorni).
   - Orario consigliato: `07:00 UTC` (o qualsiasi orario desiderato).
6. **Intestazioni HTTP (Headers):** Clicca su **"Advanced"** -> **"Headers"** e aggiungi le due seguenti intestazioni:
   - Intestazione 1:
     - Nome: `apikey`
     - Valore: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ`
   - Intestazione 2:
     - Nome: `Authorization`
     - Valore: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ`
7. **Notifiche di Errore (Failure notifications):**
   - Nella sezione **"Notifications"**, attiva **"Notify on failure"** (Avvisa in caso di errore) selezionando la tua email personale.
   - In questo modo, se Supabase dovesse rispondere con un codice diverso da 200 (es. 503 o database inattivo), riceverai immediatamente un avviso via email per riattivarlo tempestivamente.
8. Clicca su **"Create"** (Salva).

---

## 5. Procedura di Ripristino Totale d'Emergenza (Disaster Recovery da Zero)

Nel caso estremo in cui il progetto Supabase venga cancellato, il database diventi inaccessibile o si decida di migrare su un account Supabase completamente nuovo, segui questi passaggi per ripristinare il Vault al 100% in meno di 10 minuti:

### Passo 1: Crea un nuovo progetto Supabase
1. Vai su [https://supabase.com](https://supabase.com) e accedi con le tue credenziali.
2. Clicca su **"New Project"**.
3. Inserisci nome (`Vault Scout Clan`), password del database sicura e scegli la regione più vicina (es. *Frankfurt* o *Milan*).
4. Attendi circa 2 minuti che il progetto sia pronto.

### Passo 2: Applica lo Schema Consolidato Unico
1. Nel nuovo progetto Supabase, clicca su **SQL Editor** (`>_`) e poi su **"New query"**.
2. Apri il file del repository [`supabase/full_schema.sql`](../supabase/full_schema.sql).
3. Copia tutto il contenuto, incollalo nell'editor SQL e clicca **Run**.
   - Questo script è 100% idempotente e crea all'istante:
     - Tabelle: `giochi`, `bans`, `canti`, `allegati`, `eventi`, `odg_punti`, `admin_users`, `system_meta`.
     - Politiche di sicurezza RLS (lettura pubblica, scrittura riservata ad admin).
     - Bucket Supabase Storage `allegati` con MIME limitati (JPEG, PNG, WEBP, PDF, audio).
     - Funzioni RPC per epoca di sincronizzazione (`bump_sync_epoch()`) e pulizia periodica (`purge_old_tombstones()`).

### Passo 3: Crea l'Utente Admin
1. Vai su **Authentication** -> **Users** -> **"Add user"** -> **"Create user"**.
2. Inserisci l'email dei capi e una password sicura. Spunta **"Auto Confirm User"**.
3. Copia lo **User UID** generato.
4. Torna in **SQL Editor** ed esegui:
   ```sql
   INSERT INTO public.admin_users (user_id) VALUES ('TUO_USER_UID');
   ```
5. Disabilita le registrazioni pubbliche in **Authentication** -> **Providers** -> **Email** -> disattiva **"Enable email signups"**.

### Passo 4: Aggiorna le Chiavi su GitHub
1. In Supabase, vai su **Project Settings** (icona ingranaggio) -> **API**.
2. Copia:
   - **Project URL**
   - **Project API Keys** -> chiave `anon` `public` (MAI la service_role!).
3. Sul repository GitHub, vai su **Settings** -> **Secrets and variables** -> **Actions**.
4. Aggiorna le variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Vai su **Actions** -> **Deploy to GitHub Pages** -> clicca **"Run workflow"** per ricompilare il sito con le nuove credenziali.

### Passo 5: Ripristina i Dati dall'Ultimo Backup JSON

> [!WARNING] **IMPORTANTE - COSA CONTIENE E COSA NON CONTIENE IL BACKUP JSON:**
> Il file di backup JSON contiene **esclusivamente i dati testuali, le relazioni e i metadati** delle 6 tabelle del database (`giochi`, `bans`, `canti`, `eventi`, `odg_punti`, `allegati`).
> **NON contiene i file fisici (fotografie, immagini e documenti PDF)** memorizzati nel bucket `allegati` di Supabase Storage!
> 
> **Procedura e Chiarimenti per la Conservazione di Foto e PDF:**
> 1. **Il Vero Backup dei File:** I file originali caricati (schemi, regolamenti, spartiti, foto) devono essere conservati ordinatamente dalla staff capi nella **cartella condivisa del Clan (es. Google Drive dei capi)**. Questo è l'unico vero archivio sicuro a lungo termine.
> 2. **Chiarimento sul Manifest di Admin:** L'opzione *"Esporta Elenco"* scarica un file `.json` che è **esclusivamente un elenco di indirizzi web (URL)** e non un archivio di file. Serve come mappa di riferimento per ricollegare o riscaricare i file in caso di migrazione.
> 3. **Chiarimento sulla Cache Offline:** Il pulsante *"Scarica tutto"* scarica i file unicamente nella memoria locale del browser di **quel dispositivo** (per l'uso offline del singolo capo), non creando un archivio esportabile.
> 4. **Copia di Emergenza da Supabase:** Dalla dashboard web di Supabase -> **Storage** -> bucket `allegati`, la staff può scaricare periodicamente una copia locale dell'intero bucket sul PC.

1. Apri il sito del Vault nel browser (o la PWA installata).
2. Accedi come Admin inserendo email e password impostate al Passo 3.
3. Nel menu Admin, tocca la riga **"Ripristina da Backup JSON"**.
4. Seleziona il file `.json` del backup più recente (es. `vault-scout-backup-2026-10-15.json`).
5. Il sistema esegue una **validazione differenziale**: mostra un'anteprima chiara di quanti record nuovi verranno inseriti e quanti aggiornati.
6. Clicca **"Conferma e Applica"**. Tutti i giochi, bans, canti, eventi e punti ODG vengono inseriti atomicamente in Supabase e salvati nella memoria locale del dispositivo.
7. Il Vault è tornato operativo al 100%!

---

## 6. Manutenzione Programmata e Prevenzione della Sospensione

Per la guida completa e il calendario operativo mese per mese, consulta il documento dedicato [`docs/MANUTENZIONE.md`](MANUTENZIONE.md).

### Politiche dei Servizi Gratuiti:
1. **Supabase Free Tier:** Sospende i database senza traffico dopo 7 giorni consecutivi di inattività.
2. **GitHub Actions:** Disattiva automaticamente i workflow pianificati (*cron*) nei repository in cui non viene effettuato alcun commit o attività per 60 giorni consecutivi.

### Strategia di Difesa a Triplo Livello Adottata:
1. **Livello 1 - Workflow GitHub (`.github/workflows/keepalive.yml`):**
   - Gira ogni 2 giorni alle 06:00 UTC.
   - Esegue una query REST a Supabase mantenendo sveglio il database.
   - Ogni 40 giorni effettua un micro-commit automatico su `docs/keepalive_heartbeat.txt` spinto sul ramo dedicato `keepalive-heartbeat` (senza toccare `main` né violare le regole di protezione). Tale attività azzera il conteggio dei 60 giorni di GitHub Actions.
2. **Livello 2 - Cron Esterno Ridondante ([cron-job.org](https://cron-job.org)):**
   - Servizio gratuito impostato per interrogare l'endpoint `giochi?select=id&limit=1` ogni 2 giorni con avviso email immediato in caso di errore (configurazione dettagliata nella Sezione 4.3).
3. **Livello 3 - Promemoria Mensile dei Capi:**
   - Impostare un promemoria ricorrente nel calendario capi con cadenza mensile (*"Controllo Vault Scout & Backup"*): entrare nell'area Admin, premere **"Esporta Backup JSON"** e verificare la conservazione dei file originali su Google Drive di Clan.

---

## 7. Configurazione dell'Ambiente di Staging (Fase 12)

Per testare le migrazioni del database e i test automatici di scrittura (login admin, creazione e cancellazione di prova) senza toccare né sporcare il database di produzione, il proprietario può creare un secondo progetto gratuito su Supabase (il piano Free di Supabase include fino a 2 progetti contemporanei per account a costo zero).

### 7.1 Creazione del Progetto Staging su Supabase
1. Accedi a [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Clicca su **"New Project"**.
3. Scegli l'organizzazione, inserisci il nome del progetto (es. `Vault Scout - Staging`), assegna una password del database sicura e salvala nel password manager del clan. Scegli la stessa regione di produzione (es. *Frankfurt* o *Milan*).
4. Attendi che il provisioning sia completato.
5. In **Project Settings** -> **API**, annota:
   - **Project URL** (es. `https://xyzstagingref.supabase.co`)
   - **Project API Keys** -> chiave `anon` `public`
6. In **Project Settings** -> **Database** -> **Connection string** (URI / Direct Connection), copia la stringa di connessione (o annota la password del database impostata al punto 3).
7. Disabilita le registrazioni pubbliche su Staging: **Authentication** -> **Providers** -> **Email** -> disattiva **"Enable email signups"**.
8. Crea l'utente di test su Staging: **Authentication** -> **Users** -> **"Add user"** -> **"Create user"**:
   - Email: es. `test-admin@clan.test`
   - Password: una password di prova sicura
   - Spunta **"Auto Confirm User"**
   - Copia lo User UID generato e incollalo in SQL Editor con:
     ```sql
     INSERT INTO public.admin_users (user_id) VALUES ('UID_DELL_UTENTE_DI_TEST');
     ```

### 7.2 Creazione dell'Environment `staging` su GitHub
1. Sul repository GitHub, vai su **Settings** -> **Environments**.
2. Clicca su **"New environment"** e assegna il nome esatto: `staging`.
3. In **Environment secrets**, aggiungi i seguenti segreti (visibili solo ai workflow mirati):
   - `STAGING_SUPABASE_URL`: l'URL del progetto di staging (es. `https://xyzstagingref.supabase.co`)
   - `STAGING_SUPABASE_ANON_KEY`: la chiave `anon` pubblica del progetto di staging
   - `STAGING_DB_PASSWORD`: la password del database PostgreSQL di staging (usata esclusivamente dallo script sicuro `apply_staging_schema.mjs`)
   - `ADMIN_TEST_EMAIL`: l'email dell'utente di test admin (es. `test-admin@clan.test`)
   - `ADMIN_TEST_PASSWORD`: la password dell'utente di test admin

### 7.3 Come Applicare e Provare lo Schema su Staging
Il workflow `.github/workflows/staging-schema.yml` può essere avviato manualmente da GitHub Actions (**"Actions"** -> **"Applica Schema su Staging"** -> **"Run workflow"**).
Il workflow applica in modo idempotente `supabase/full_schema.sql` al database di staging.
Nessun test di scrittura tocca la produzione: se un test dovesse tentare di girare sull'URL di produzione (`lpeiyzwccedtqjbficjo`), lo script `scripts/run_admin_test.mjs` si blocca all'istante con codice di errore bloccante.

---

## 8. Pubblicazione Controllata e Protezione del Ramo `main`

Per evitare pubblicazioni accidentali o regressioni visive/funzionali sul sito in produzione:

1. **GitHub Environment `production` con Approvazione Manuale:**
   - In **Settings** -> **Environments** -> crea o modifica l'environment `production`.
   - Attiva **"Required reviewers"** e seleziona il tuo account GitHub.
   - Ogni volta che la CI passa con successo su `main`, il workflow di deploy su GitHub Pages attenderà la tua approvazione manuale (un click sul pulsante "Review deployments" -> "Approve and deploy") prima di aggiornare il sito pubblico.

2. **Branch Protection su `main`:**
   - In **Settings** -> **Branches** -> aggiungi una regola di protezione per il ramo `main`.
   - Spunta:
     - **"Require a pull request before merging"** (Nessun push diretto su main).
     - **"Require status checks to pass before merging"** -> seleziona i job di `ci.yml` (Lint, Typecheck, Test, Build, Weight Budget).

Per l'architettura completa, i dettagli di budget e l'analisi dei costi (100% 0€/mese), consulta il documento approfondito [`docs/AUTOMAZIONE.md`](AUTOMAZIONE.md).
