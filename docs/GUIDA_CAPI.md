# Guida all'Uso per i Capi - Vault Scout Clan

Benvenuto nel **Vault Scout**, l'archivio digitale tascabile progettato per accompagnare la comunità capi e i ragazzi durante le uscite, le riunioni e i campi estivi, sia online che in completo isolamento sui sentieri di montagna.

---

## 1. Installazione come App (PWA)

Il Vault Scout funziona su qualsiasi dispositivo (smartphone, tablet, computer) e si installa direttamente dal browser senza passare dagli app store commerciali.

### Su iPhone e iPad (iOS con Safari):
1. Apri **Safari** e naviga sull'indirizzo del sito del Vault.
2. Tocca l'icona **Condividi** in basso al centro (il quadrato con la freccia verso l'alto).
3. Scorri verso il basso e seleziona **"Aggiungi alla schermata Home"**.
4. Tocca **"Aggiungi"** in alto a destra. L'icona del giglio con la targa bianca apparirà tra le tue app, pronta all'uso a schermo intero senza barre del browser.

### Su smartphone Android (con Chrome):
1. Apri **Google Chrome** e naviga sull'indirizzo del Vault.
2. In basso comparirà il banner automatico **"Aggiungi Vault Scout alla schermata iniziale"** (oppure tocca il menu con i tre puntini `⋮` in alto a destra e scegli **"Installa app"**).
3. Tocca **"Installa"**. L'app comparirà nel cassetto delle tue applicazioni.

---

## 2. Uso Offline: Prima di Partire per l'Uscita

Il Vault è stato progettato con un'architettura **Offline-First**: ogni volta che apri l'app con connessione internet attiva, tutti i testi dei canti, giochi, bans, calendario e ordini del giorno vengono automaticamente salvati nella memoria interna del tuo dispositivo (tramite un database locale IndexedDB).

### La Bussola di Sincronizzazione:
In alto a destra troverai l'icona della **Bussola Scout**:
- **Bussola che ruota:** sincronizzazione con Supabase in corso.
- **Tocca la bussola:** forza l'aggiornamento immediato di tutto l'archivio.
- **Banner grigio "Sei offline":** compare automaticamente in assenza di segnale. Puoi continuare a consultare l'intero archivio senza alcuna interruzione.

> **Consiglio per i Capi:** La sera prima di salire in montagna o al campo, apri l'app sul telefono e tocca una volta la Bussola per assicurarti di avere l'ultimissima versione dei canti e delle attività. Se prevedi di consultare spartiti PDF o immagini senza rete, entra nell'area Admin e tocca *"Scarica tutto"* alla voce Archivio Offline Allegati.

---

## 3. Canti e Canzoniere

La sezione Canti raccoglie il repertorio di clan, reparto e canti di preghiera.

### Consultazione e Accordi:
- **Accordi sopra le sillabe:** gli accordi sono posizionati con precisione tipografica sopra la sillaba corrispondente.
- **Trasposizione Tonalità:** usa i pulsanti `♭` e `♯` per trasporre all'istante tutti gli accordi in semitoni (es. se la voce della chitarra è troppo alta o bassa per il coro).
- **Dimensione Testo:** pulsanti `A-` e `A+` per ingrandire o rimpicciolire il testo per la lettura attorno al fuoco.
- **Accordi On/Off:** un pulsante dedicato permette di nascondere gli accordi per i ragazzi che devono solo cantare il testo.

### Come Inserire o Modificare un Canto (Solo Capi Admin):
Tocca il tasto `+` in basso a destra. I canti utilizzano il formato standard **ChordPro**, facilissimo e intuitivo:
- Scrivi il testo normalmente.
- Inserisci gli accordi tra **parentesi quadre** esattamente prima della sillaba su cui suonarli. Esempio:
  ```text
  [Do]Alba di un nuovo [Sol]giorno sui [Lam]monti
  ```
- Per il ritornello, racchiudilo con `[RIT]` oppure `{soc}` all'inizio e `{eoc}` alla fine:
  ```text
  [RIT]
  Canta con noi il cammino che va,
  verso la vetta la gioia sarà!
  ```
  Nel testo comparirà evidenziato da una barra verticale dorata laterale.

### Importazione Automatica di un Canto (Word, Testo o con AI Esterna):
Per evitare di digitare manualmente accordi e testi lunghi, tocca il pulsante **"Importa"** (icona con freccia in giù) visibile nella barra della sezione Canti quando sei autenticato come admin.

Sono disponibili tre modalità:
1. **Documento Word (.docx):**
   - Trascina o seleziona un file Word (`.docx`) del tuo canzoniere parrocchiale o di gruppo.
   - Il sistema estrae automaticamente il titolo, l'autore o evento, la tonalità, l'andamento ritmico con le frecce (`↓ ↑`) e converte la struttura a colonne e accordi nel formato ChordPro ottimizzato per il Vault.
2. **Incolla Testo Diretto:**
   - Incolla il testo del canto con gli accordi sopra le righe o già formattato tra parentesi quadre (`[Do]`).
   - L'elaboratore converte automaticamente gli accordi sovrapposti e struttura il testo pronto per la revisione.
3. **Con l'Aiuto di un'AI Esterna (ChatGPT, Claude, Google Gemini):**
   - Tocca **"Copia Prompt AI"** per copiare negli appunti le istruzioni pronte (disponibili anche nel documento [`docs/PROMPT_IMPORT_CANTI.md`](./PROMPT_IMPORT_CANTI.md)).
   - Apri ChatGPT, Claude o Gemini sul browser del tuo smartphone o computer, incolla il prompt e aggiungi il testo della canzone (o carica la foto dello spartito).
   - Incolla il codice generato dall'AI nel Vault e tocca **"Elabora Testo"**.
   - **Cosa fare se l'AI si rifiuta per copyright:** I filtri di sicurezza di OpenAI o Claude a volte rifiutano di trascrivere testi di canzoni coperte da copyright (*"I cannot reproduce copyrighted lyrics"*). In questo caso:
     - Chiedi all'AI: *"Non scrivere il testo, mostrami solo la sequenza degli accordi e la struttura strofe/ritornello"*;
     - Oppure usa l'opzione 1 caricando direttamente il file `.docx`;
     - Oppure inserisci le sole parole essenziali o usa l'editor diretto.

**Anteprima e Salvataggio:**
Prima di salvare, visualizzerai l'anteprima esatta del canto con tutti i campi compilati (titolo, autore, tonalità, ritmo, testo formattato). Modifica pure qualsiasi valore e tocca **"Salva Canto"**: il brano sarà immediatamente sincronizzato nel Vault e impaginato nel canzoniere cartaceo.

---

## 4. Giochi e Bans

### Ricerca Veloce e Tolleranza agli Errori:
La barra di ricerca è dotata di correzione automatica dei typo: anche digitando di fretta con una mano sola sul campo (es. *"pala aveleata"*), il sistema troverà correttamente *"Palla avvelenata"*.

### Modalità Lettura Bans:
Aprendo un bans e toccando **"Modalità Lettura"**:
- Il testo passa a caratteri giganti ad altissimo contrasto.
- I gesti e le movenze compaiono distinti tra parentesi corsive e colorate.
- **Schermo Sempre Acceso (Wake Lock):** il display dello smartphone non si spegnerà mentre animi il bans in cerchio attorno al fuoco.

---

## 5. Centro Stampa: Canzonieri e Fascicoli Cartacei

Accessibile toccando l'icona della stampante nella barra superiore o nella schermata Home:
- **Canzoniere Personalizzato:** seleziona i canti che desideri (oppure *"Seleziona tutti"*) e componi un PDF A4 pronto per la stampa fronte/retro.
- **Indice Reale Automatico:** il sistema calcola esattamente in quale pagina finisce ciascun brano e genera un indice analitico impeccabile.
- **Fascicoli Giochi & Bans:** stampa in blocco le schede attività per il capo gioco o per i capisquadriglia.
- **Stampa ODG della Riunione:** stampa l'ordine del giorno dell'uscita con la checklist da compilare a penna.

---

## 6. Calendario e Ordine del Giorno (ODG)

Il Calendario permette di pianificare uscite, riunioni di Clan e Co.Ca., bivacchi e route.

### Punti all'Ordine del Giorno:
Durante una riunione, apri la scheda dell'evento per consultare l'ODG:
- Tocca la casella di un punto quando viene completato.
- **Riporto Idempotente:** se una discussione rimane aperta per mancanza di tempo, tocca il pulsante **"Riporta punti aperti"**. Il punto verrà automaticamente copiato alla riunione successiva senza duplicazioni. Se non ci sono future riunioni in calendario, l'app proporrà di crearne una nuova con un tap.

---

## 7. Amministrazione e Sicurezza

### Accesso Admin:
Tocca il pulsante **"Accedi"** in alto a destra. Inserisci l'email e la password concordate per la staff capi. Una volta effettuato l'accesso, comparirà l'icona admin che ti permetterà di inserire nuovi contenuti, modificare gli esistenti e accedere alle funzioni avanzate.

### Cestino e Ripristino:
Quando cancelli un elemento, questo viene spostato nel **Cestino** per 180 giorni. Un elemento cancellato per sbaglio può sempre essere ripristinato da qualsiasi capo.

### Backup dei Dati e Conservazione Allegati:
Ogni mese (o prima di grandi uscite):
1. Entra nel menu **Admin**.
2. **Backup Dati JSON:** Tocca **"Esporta"** accanto a *"Backup Completo (JSON)"*. Verrà scaricato un file compatto con tutti i testi, accordi, date e punti ODG. Conservalo nel Google Drive di Clan o sulla cartella condivisa dei capi.
   - **ATTENZIONE:** Il file JSON contiene tutti i dati del database, ma **NON contiene i file fisici (foto e PDF)** caricati nello Storage!
3. **Conservazione delle Foto e dei PDF:**
   - **Chiarimento sul Manifest:** Il file esportabile da Admin (*"Esporta Elenco"*) è unicamente un elenco strutturato di indirizzi web (URL) e metadati; **NON è un archivio di backup dei file**.
   - **Chiarimento sulla Cache Offline:** Il pulsante *"Scarica tutto"* scarica le immagini e i PDF esclusivamente nella memoria temporanea del browser di **quel dispositivo**, consentendo la lettura offline al singolo capo.
   - **Il Vero Backup dei File:** I file originali (PDF, schemi, foto delle attività) devono essere conservati ordinatamente dalla staff capi nella **cartella condivisa del Clan (es. Google Drive della staff)**.
   - **Dump di Emergenza:** Periodicamente, un capo può accedere alla dashboard web di Supabase -> *Storage* -> bucket `allegati` e scaricare un archivio compresso di tutti i file sul computer della staff.
4. Per ripristinare il database da un backup JSON, tocca **"Ripristina da Backup JSON"**: l'anteprima differenziale ti mostrerà esattamente cosa verrà aggiunto o aggiornato prima di applicare le modifiche.

---

## 8. Risoluzione Problemi Rapida

- **Non vedo un canto appena aggiunto da un altro capo:** Tocca la bussola in alto a destra per forzare la sincronizzazione immediata. Assicurati di essere connesso a internet.
- **Il telefono mostra una schermata bianca:** Ricarica la pagina tirando verso il basso (*pull-to-refresh*) oppure chiudi l'app dalla schermata delle applicazioni recenti e riaprila.
- **Password dimenticata:** Consulta la guida tecnica [`docs/SETUP_MANUALE.md`](./SETUP_MANUALE.md) per reimpostare la password tramite la dashboard di Supabase.

*Buona caccia e buona strada!*
