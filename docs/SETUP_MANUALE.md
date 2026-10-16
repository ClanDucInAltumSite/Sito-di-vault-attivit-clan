# Guida di Configurazione Manuale — Sito Vault Scout Clan

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
   - **Email:** l'indirizzo email che useranno i capi (es. `clan.ducinaltum@gmail.com`).
   - **Password:** una password sicura di almeno 8-12 caratteri (composta da lettere, numeri e simboli).
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

## 4. Controllo del Keepalive (Anti-Pausa Supabase)

Il piano gratuito di Supabase spegne il database se non riceve richieste per 7 giorni. Il nostro sistema include un'azione automatica che ogni 2 giorni invia una richiesta a Supabase per mantenerlo sempre sveglio.

### 4.1 Come verificare che stia funzionando
1. Sul repository GitHub, clicca sulla scheda **Actions** in alto.
2. Nella colonna di sinistra, clicca su **"Keepalive Supabase & Repository"**.
3. Vedrai l'elenco delle esecuzioni passate con una spunta verde.
4. Per eseguire una verifica manuale in qualsiasi momento:
   - Clicca sul pulsante **"Run workflow"** sulla destra.
   - Conferma cliccando sul tasto verde **"Run workflow"**.
   - Entro 30 secondi vedrai comparire il pallino verde di completamento con successo.

### 4.2 Rete di Sicurezza Gratuita Ridondante (Consigliata)
Per una sicurezza al 100%, puoi impostare un monitor esterno gratuito (es. **Cron-job.org** o **UptimeRobot**) che faccia una richiesta ogni 3 giorni all'indirizzo Supabase:
1. Registrati gratis su [https://cron-job.org](https://cron-job.org).
2. Clicca su **"Create cronjob"**.
3. Nome: `Vault Scout Keepalive`.
4. URL: `https://lpeiyzwccedtqjbficjo.supabase.co/rest/v1/giochi?select=id&limit=1`
5. Nella scheda **Headers**, aggiungi:
   - Header 1: `apikey` con valore la tua anon key di Supabase.
   - Header 2: `Authorization` con valore `Bearer INCOLLA_QUI_LA_TUA_ANON_KEY`.
6. Pianificazione: Ogni 3 giorni.
7. Clicca su **Save**. In questo modo, anche se GitHub dovesse avere disservizi, il database non andrà mai in pausa.

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
1. Apri il sito del Vault nel browser (o la PWA installata).
2. Accedi come Admin inserendo email e password impostate al Passo 3.
3. Nel menu Admin, tocca la riga **"Ripristina da Backup JSON"**.
4. Seleziona il file `.json` del backup più recente (es. `vault-scout-backup-2026-10-15.json`).
5. Il sistema esegue una **validazione differenziale**: mostra un'anteprima chiara di quanti record nuovi verranno inseriti e quanti aggiornati.
6. Clicca **"Conferma e Applica"**. Tutti i giochi, bans, canti, eventi e punti ODG vengono inseriti atomicamente in Supabase e salvati nella memoria locale del dispositivo.
7. Il Vault è tornato operativo al 100%!

---

## 6. Manutenzione Programmata e Prevenzione della Sospensione

### Politiche dei Servizi Gratuiti:
1. **Supabase Free Tier:** Sospende i database senza traffico dopo 7 giorni di inattività.
2. **GitHub Actions:** Disattiva automaticamente i workflow pianificati (*cron*) nei repository in cui non viene effettuato alcun commit o attività per 60 giorni consecutivi.

### Strategia di Difesa a Triplo Livello Adottata:
1. **Livello 1 — Workflow GitHub (`.github/workflows/keepalive.yml`):**
   - Gira ogni 2 giorni.
   - Esegue una query REST a Supabase mantenendo sveglio il database.
   - Ogni 40 giorni effettua un micro-commit automatico su `docs/keepalive_heartbeat.txt` per resettare il timer di inattività di GitHub ed evitare che il workflow stesso si disattivi.
2. **Livello 2 — Cron Esterno Ridondante (Consigliato):**
   - Servizio gratuito [Cron-job.org](https://cron-job.org) impostato per interrogare l'endpoint ogni 3 giorni.
3. **Livello 3 — Promemoria Mensile dei Capi:**
   - Impostare un evento ricorrente sul calendario di branca/clan con cadenza mensile: *"Controllo Vault Scout & Backup"* per entrare nell'area Admin e premere **"Esporta Backup JSON"**. Conservare il file sul Google Drive di Clan o inviarlo via email alla staffa.
