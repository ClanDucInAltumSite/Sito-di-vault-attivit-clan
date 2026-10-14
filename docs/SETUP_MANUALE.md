# Guida di Configurazione Manuale — Sito Vault Scout Clan

Questa guida spiega passo passo, in italiano semplice e per chi non è un programmatore, come configurare Supabase, GitHub e l'utenza di amministrazione per far funzionare il Vault di Clan.

---

## 1. Configurazione del Progetto Supabase

Il progetto Supabase è già creato al seguente indirizzo:
**Dashboard:** `https://supabase.com/dashboard/project/lpeiyzwccedtqjbficjo`

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
