# MANUALE DI AUTOMAZIONE E PIPELINE CI/CD (FASE 12)

Questo documento descrive l'architettura di automazione di **Vault Clan - Duc In Altum**: cosa viene eseguito automaticamente, cosa richiede l'intervento manuale del proprietario, come gestire le approvazioni, i costi e le regole operative per l'agente.

---

## 1. Mappa dei Workflow GitHub Actions

Tutti i workflow risiedono in `.github/workflows/`:

| Workflow | File | Trigger | Scopo |
| :--- | :--- | :--- | :--- |
| **CI Pipeline** | `ci.yml` | Push & PR su qualsiasi ramo | Controlli statici, typecheck, Vitest (184 test), build PWA, budget pesi, Playwright E2E (Chromium, WebKit, Mobile), Lighthouse CI |
| **Deploy su GitHub Pages** | `deploy.yml` | Push su `main` (se CI verde) o manuale | Pubblicazione controllata: richiede approvazione con 1 click (Environment `production`), smoke test e controllo schema |
| **Applica Schema su Staging** | `staging-schema.yml` | Modifiche a `full_schema.sql` o `migrations/` | Esegue `full_schema.sql` sul DB di Staging e lancia i test di scrittura/admin isolati |
| **Controllo Schema Produzione** | `prod-schema-check.yml` | Giornaliero (07:00 UTC) e post-deploy | Interroga in sola lettura via REST lo stato di produzione: se mancano colonne o RPC, apre una Issue |
| **Manutenzione Settimanale** | `maintenance.yml` | Lunedì (06:00 UTC) o manuale | Esegue `npm audit`, `npm outdated`, verifica l'ultimo Keepalive e apre una Issue se serve manutenzione |
| **Keepalive Anti-Pausa** | `keepalive.yml` | Ogni 2 giorni (06:00 UTC) | Query REST anti-inattività Supabase e heartbeat Git a 40 giorni |

---

## 2. Regole di Protezione del Ramo `main` (Passaggi Interfaccia GitHub)

Per garantire che nessuna modifica possa rompere la produzione, il ramo `main` deve essere protetto:

1. Apri il repository su **GitHub** e clicca su **Settings** (in alto a destra).
2. Nel menu laterale sinistro, sotto la sezione **Code and automation**, clicca su **Branches**.
3. Accanto a **Branch protection rules**, clicca su **Add rule** (oppure **Add classic branch protection rule**).
4. Nel campo **Branch name pattern**, inserisci: `main`.
5. Spunta le seguenti opzioni obbligatorie:
   - **Require a pull request before merging**: impedisce il push diretto su `main`.
   - **Require status checks to pass before merging**:
     - Spunta **Require branches to be up to date before merging**.
     - Nella casella di ricerca dei check, seleziona gli 8 job paralleli di `ci.yml`:
       - `Controlli Statici, Tipi, Vitest e Budget di Peso`
       - `Playwright (chromium)`
       - `Playwright (webkit)`
       - `Playwright (mobile-iphone-se)`
       - `Playwright (mobile-iphone-15)`
       - `Playwright (tablet-ipad)`
       - `Playwright (mobile-android)`
       - `Audit Lighthouse CI (3 Esecuzioni, Mediana e JSON)`
   - **Do not allow bypassing the above settings**: la regola si applica anche agli amministratori.
6. Clicca su **Create** / **Save changes** in fondo alla pagina.

Da questo momento, nessun commit può entrare in `main` se la pipeline `ci.yml` non è al 100% verde su tutti i browser e device.

### 2.1 Compatibilità con l'Heartbeat dei 60 Giorni (Ramo Dedicato `keepalive-heartbeat`)

Secondo la documentazione ufficiale di GitHub Actions:
> *"Workflows are not triggered automatically if the repository has had no activity in 60 days."*

Per GitHub, **qualsiasi push o commit su qualunque ramo del repository conta come attività** che azzera il timer dei 60 giorni.

Se il workflow di keepalive tentasse di scrivere direttamente su `main`, il push verrebbe categoricamente **rifiutato da GitHub** a causa della regola di protezione appena impostata (che vieta i push diretti senza PR approvata e CI verde).

**Soluzione adottata:**
Il workflow `.github/workflows/keepalive.yml` spinge il micro-commit automatico di heartbeat (`docs/keepalive_heartbeat.txt`) **esclusivamente su un ramo dedicato chiamato `keepalive-heartbeat`** (`git push origin keepalive-heartbeat --force`). In questo modo:
1. L'attività del repository viene registrata e il timer dei 60 giorni viene azzerato con successo;
2. Il ramo `main` rimane intonso e rigorosamente protetto;
3. I commit di heartbeat non inquinano la cronologia di produzione di `main`.

Per verificare o forzare l'heartbeat in qualsiasi momento senza attendere i 40 giorni, è possibile avviare manualmente il workflow `Keepalive Supabase & Repository` via `workflow_dispatch` impostando il parametro `force_heartbeat: true`.

---

## 3. Ambienti GitHub (Environments) e Pubblicazione Controllata

### Ambiente `production` (con Revisore Richiesto)
1. In **Settings** -> **Environments**, clicca su **New environment** e nominalo `production`.
2. Spunta **Required reviewers** e aggiungi il tuo account GitHub (`LucaRenz`).
3. Quando `deploy.yml` si attiva a seguito di un merge su `main`, GitHub blocca l'esecuzione ed espone il pulsante **"Review deployments"**.
4. Cliccando **"Approve and deploy"**, la pubblicazione su GitHub Pages viene eseguita in sicurezza.

### Ambiente `staging`
1. Crea un secondo environment chiamato `staging`.
2. Aggiungi i segreti dedicati all'ambiente di test:
   - `STAGING_SUPABASE_URL`
   - `STAGING_SUPABASE_ANON_KEY`
   - `ADMIN_TEST_EMAIL`
   - `ADMIN_TEST_PASSWORD`
   - `SUPABASE_ACCESS_TOKEN` (opzionale per Management API) o `STAGING_DATABASE_URL`

---

## 4. Comandi per Approvazione Baseline Visive e Risultati Golden

### Approvazione Baseline Visive (Snapshot)
Se hai modificato intenzionalmente l'interfaccia o la palette e i test di regressione visiva falliscono, aggiorna la baseline con:
```bash
npm run snapshots:approve
```
Le immagini approvate vengono salvate in `test/__screenshots__/`.

### Approvazione Risultati Importazione (Golden)
Se hai migliorato la logica dei parser e vuoi promuovere i nuovi risultati ChordPro:
```bash
npm run golden:approve
```
Per i file privati in `_riferimenti/`, il comando aggiorna i file `.golden.json` in `_riferimenti/golden/`.
Per le fixture sintetiche di CI, aggiorna `test/fixtures/golden/`.

Per eseguire la verifica in sola lettura:
```bash
npm run test:golden
```

---

## 5. Come Leggere un'Esecuzione Fallita di CI

Se la spunta rossa compare su un commit o PR:
1. Clicca su **Details** accanto al job fallito.
2. Controlla quale fase ha fallito:
   - **Controlli Statici e Tipi**: errore TypeScript (`tsc`) o stringa non ammessa (`service_role`, `dangerouslySetInnerHTML`).
   - **Vitest**: un test unitario, di sicurezza o un golden test non coincide. Leggi il log per vedere la riga o l'accordo divergente.
   - **Budget di Peso**: il bundle iniziale gzip ha superato 80 KiB, il precache ha superato il limite, oppure `pdf.worker` è finito nel precache.
   - **Playwright**: un selettore non ha risposto o uno screenshot differisce dalla baseline oltre la tolleranza (5%). Scarica l'artefatto `playwright-artifacts-...` dagli Artifacts in fondo alla pagina per vedere i PNG `-diff.png` che evidenziano i pixel cambiati in rosso.
   - **Lighthouse CI**: il punteggio mediano di Performance (< 85), Accessibilità (< 90) o Best Practices (< 95) è sceso sotto soglia.

---

## 6. Analisi dei Costi (GitHub Actions e Supabase)

Verifica effettuata sulla documentazione ufficiale corrente:
1. **GitHub Actions**:
   - **Repository Pubblici**: **100% GRATUITO** con minuti illimitati per tutti i runner standard (Ubuntu, Windows).
   - **Repository Privati**: 2.000 minuti gratuiti al mese nel piano Free. La nostra suite CI completa gira in circa 3-5 minuti, consentendo oltre 400 esecuzioni mensili senza alcun costo.
2. **Supabase Free Plan**:
   - Il piano Free include **fino a 2 progetti attivi contemporaneamente** per utente.
   - È quindi possibile mantenere 1 progetto di Produzione (`lpeiyzwccedtqjbficjo`) e 1 progetto di Staging a **0€/mese**.
   - Nota sulla pausa: Supabase mette in pausa i progetti gratuiti dopo 7 giorni di inattività REST. Il workflow `keepalive.yml` già attivo ogni 2 giorni previene la pausa sul database di produzione.

---

## 7. Regole Operative per l'Agente AI (Autopilota — Fase 12H)

L'agente AI che sviluppa il progetto opera in modalità autonoma attenendosi alle seguenti regole tassative:

1. **Avanzamento Continuo:** Al termine di ogni fase, se tutti i controlli della pipeline CI (`npm run typecheck`, `npm test`, `npm run check:budget`, `verify:ui`, Lighthouse) sono verdi e la fase non richiede migrazioni SQL in produzione né decisioni di business, l'agente **prosegue con la fase successiva senza chiedere il via**.
2. **Fermata Obbligatoria (Stop & Ask):** L'agente DEVE fermarsi e attendere il proprietario se e solo se:
   - È necessario eseguire una migrazione SQL sul database di produzione (le migrazioni in produzione sono manuali).
   - Un controllo o test fallisce dopo 3 tentativi di correzione (vietato indebolire le soglie o disabilitare i test).
   - Si riscontra un requisito ambiguo che impatta sulla persistenza dei dati o sulla sicurezza.
   - È necessaria una configurazione manuale sulla dashboard di GitHub o Supabase.
   - È richiesto il merge finale sul ramo `main`.
3. **Formato del Riepilogo:** Ogni riepilogo a fine fase deve sempre includere:
   - L'elenco puntuale dei controlli eseguiti con riferimento ai test.
   - La lista esplicita di ciò che **NON è verificabile in automatico** e deve essere controllato dal proprietario su un dispositivo reale (es. comportamento del Wake Lock su iOS Safari, rotazione fisica dello schermo, rendering su stampante laser/inchiostro cartacea).
