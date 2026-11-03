import os
import shutil
import zipfile
from pathlib import Path

ROOT_DIR = Path(r"c:\Users\Utente\Documents\Progetti_e_programmi\Siti miei\Sito Vault Scout")
EXPORT_DIR = ROOT_DIR / "claude_export"
ZIP_PATH = ROOT_DIR / "vault-scout-claude.zip"

CLAUDE_GUIDE_CONTENT = """# VAULT SCOUT - GUIDA ARCHITETTURALE E TECNICA PER CLAUDE

Questa cartella contiene il codice sorgente essenziale, gli schemi di database, i test e la documentazione tecnica del progetto **Vault Scout (Clan Duc In Altum)**.
È stata preparata appositamente per essere caricata su Claude con tutto ciò che serve per comprendere al 100% l'architettura, la logica di business, il frontend e il backend dell'applicazione, senza file binari pesanti o directory ridondanti.

---

## 1. SCOPO E VISIONE DEL PROGETTO
- **PWA Local-First / Offline-First**: Pensata per capi e ragazzi scout per l'uso all'aperto, durante campi e uscite nei boschi dove la connessione a Internet è assente o intermittente.
- **Flusso Dati Locale**: L'applicazione legge e scrive SEMPRE prima sul database locale del browser **IndexedDB** (`src/lib/db.ts`). Nessuna operazione utente è bloccata dall'attesa della rete.
- **Sincronizzazione Cloud con Supabase**: Quando c'è connettività, il motore di sync (`src/lib/sync.ts`) effettua il push/pull bidirezionale con Supabase PostgreSQL.
- **Eliminazioni & Tombstone**: Le cancellazioni creano record "tombstone" con incremento dell'epoca (`sync_epoch`), impedendo che un client offline re-immetta nel cloud record cancellati da altri.
- **Sicurezza Granitica**: Row Level Security (RLS) su tutte le tabelle. Lettura anonima pubblica per i contenuti, scrittura e modifica riservate esclusivamente agli amministratori autenticati (`is_admin()`). Nessuna chiave privilegiata (`service_role`) nel codice client.
- **Framework UI Leggero**: Utilizzo di **Preact** (Virtual DOM leggero con TSX) invece di React per rimanere sotto i budget di peso (Initial JS < 80 KB gzipped) e garantire fluidità massima anche su smartphone datati.

---

## 2. MODULI APPLICATIVI (FEATURES)
1. **Canti & Canzoniere A4** (`src/features/canti/`, `src/features/stampa/`, `src/lib/chordpro.ts`, `src/lib/chord_theory.ts`):
   - **Parser ChordPro**: Supporto completo per direttive `{title}`, `{subtitle}`, `{comment}`, `{artist}`, `{key}`, `{tempo}`, accordi tra parentesi `[Do]`, e blocchi ritornello (`RIT:`).
   - **Layout Responsive Mobile**: Sillabe e accordi atomici (`.canto-unit-chord` sopra `.canto-unit-lyric` dentro `.canto-word`) che vanno a capo insieme alla parola, azzerando le collisioni tra testo e accordi anche su schermi stretti.
   - **Stampa Canzoniere A4 a 2 Colonne**: Algoritmo tipografico in `src/lib/stampa.ts` con calcolo delle altezze riga per riga per disporre i canti su due colonne A4 evitando spezzature sgradevoli e debordamento d'inchiostro.
   - **Modalità Lettura a Schermo Intero (`CantoReadingMode`)**: Autoscroll a tempo basato su BPM e battute sincronizzate con Web Audio API; integrazione con History API (il tasto hardware indietro di Android chiude la vista del canto tornando all'elenco anziché uscire dal sito); dark mode automatica per la barra di sistema Android.
   - **Trasposizione e Teoria Musicale**: Trasposizione circolare a semitoni con rispetto delle alterazioni (diesis / bemolli).
2. **Giochi** (`src/features/giochi/`):
   - Archivio schede attività con classificazione per branche scout (L/C Lupetti, E/G Reparto, R/S Clan/Fuoco), ambientazione, numero partecipanti, durata, materiale e svolgimento.
3. **Bans** (`src/features/bans/`):
   - Canti con animazione e gesti, con testo, azioni ritmiche e attivazione della Screen Wake Lock API per mantenere lo schermo acceso attorno al fuoco.
4. **Calendario & Ordine del Giorno (OdG)** (`src/features/calendario/`):
   - Calendario eventi con chip colorati per categoria, gestione punti OdG con stati (proposto, discusso, approvato, rimandato), presenze e allegati.
5. **Allegati & Documenti** (`src/features/allegati/`, `src/lib/attachments.ts`, `src/lib/storage-cache.ts`):
   - Upload e visualizzazione allegati (PDF, immagini) archiviati su Supabase Storage e memorizzati nella cache locale IndexedDB per fruizione offline.
6. **Amministrazione, Stato Dati & Cestino** (`src/features/admin/`, `src/features/statodati/`, `src/lib/admin_actions.ts`):
   - Autenticazione admin tramite Supabase Auth, monitoraggio stato sincronizzazione, gestione conflitti, svuotamento/ripristino cestino (tombstones) e importazione massiva di canzonieri (Word .docx e testo).

---

## 3. MAPPA DETTAGLIATA DEL REPOSITORY
```
.
├── CLAUDE.md                       # Questo documento esplicativo
├── README.md                       # Panoramica del repository
├── package.json                    # Dipendenze (Preact, Vite, Supabase, Vitest, Playwright, idb)
├── tsconfig.json                   # Configurazione TypeScript strict
├── vite.config.ts                  # Vite, VitePWA (Workbox precache), alias @/, Vitest config
├── playwright.config.ts            # Configurazione Playwright e2e su 5 viewport (mobile, tablet, desktop)
├── index.html                      # Entrypoint HTML con CSP rigida, color-scheme, meta theme-color
│
├── src/                            # Codice sorgente completo
│   ├── main.tsx                    # Bootstrap applicazione Preact
│   ├── vite-env.d.ts               # Tipizzazioni ambiente Vite
│   ├── app/
│   │   ├── App.tsx                 # Root component, gestione notifiche e shell
│   │   ├── Shell.tsx               # Shell con TopBar, BottomNav e indicatori di stato (CompassSync)
│   │   └── router.ts               # Router reattivo client-side basato su hash (#/)
│   ├── features/                   # Moduli funzionali
│   │   ├── canti/                  # CantiView, CantoReadingMode, CantoLineRenderer, CantoFormSheet, ecc.
│   │   ├── stampa/                 # StampaView, CanzonierePageRenderer (layout tipografico A4)
│   │   ├── giochi/                 # GiochiView, GiocoDetail, GiocoFormSheet
│   │   ├── bans/                   # BansView, BanDetail, BanFormSheet
│   │   ├── calendario/             # CalendarioView, OdGManager, EventoFormSheet
│   │   ├── admin/                  # AdminView, LoginModal, CloudUploadModal
│   │   ├── allegati/               # AttachmentGallery, FileUpload
│   │   ├── home/                   # HomeView (riepilogo rapido, prossimo evento, canti recenti)
│   │   ├── design/                 # Vetrina visuale del Design System
│   │   └── statodati/              # Stato sincronizzazione, diagnostica e gestione tombstones
│   ├── lib/                        # Logica di business e librerie
│   │   ├── supabase.ts             # Client Supabase con fail-soft e policy RLS
│   │   ├── sync.ts                 # Sync Engine bidirezionale IndexedDB <-> Supabase con tombstones
│   │   ├── db.ts                   # Database locale IndexedDB (idb) con schema e migrazioni locali
│   │   ├── chordpro.ts             # Parser ChordPro, trasposizione, formattazione ritornelli
│   │   ├── chord_theory.ts         # Teoria musicale, scale cromatiche, enarmonie
│   │   ├── stampa.ts               # Calcolo impaginazione A4 a 2 colonne e gestione spezzature
│   │   ├── storage-cache.ts        # Cache offline locale per file binari e allegati
│   │   ├── auth.ts                 # Stato sessione admin e token
│   │   ├── search.tsx              # Algoritmo di ricerca full-text con diacritici e tolleranza typo
│   │   ├── wakelock.ts             # Gestione Wake Lock API per mantenere lo schermo attivo
│   │   └── admin_actions.ts        # Funzioni amministrative protette (bump sync epoch, purge)
│   ├── styles/                     # Design System (100% OKLCH Tokens, Zero Hex)
│   │   ├── tokens.css              # Variabili di colore OKLCH, tipografia Inter, spaziature, ombre
│   │   ├── components.css          # Componenti UI, bottoni, schede, modali, chip, drawer
│   │   ├── print.css               # Regole tipografiche per stampa A4 a 2 colonne (@page)
│   │   └── global.css              # Reset globale, layout shell, color-scheme
│   ├── ui/                         # Componenti atomici UI accessibili
│   │   ├── Icon.tsx                # Icone SVG vettoriali accessibili (nessun emoji come icona)
│   │   ├── ScoutMotifs.tsx         # Motivi grafici scout (TheTrail, CompassSync, LogoReveal)
│   │   ├── Button.tsx, Card.tsx, Modal.tsx, BottomSheet.tsx, SearchField.tsx, Toast.tsx, ecc.
│   │   └── BrandLogo.tsx           # Logo del Clan con targa opaca e raggio protetto
│   └── data/                       # Dati statici predefiniti (seed canzoniere 21 canti)
│
├── supabase/                       # Backend PostgreSQL e sicurezza Supabase
│   ├── full_schema.sql             # Schema SQL unificato dell'intero database
│   ├── seed_21_canti.sql           # Canzoniere ufficiale scout (21 canti con testo e accordi)
│   ├── migrations/                 # Migrazioni incrementali applicate
│   │   ├── 0001_init_schema.sql    # Tabelle, indici, CHECK constraints, trigger updated_at
│   │   ├── 0002_security_rls.sql   # RLS, funzione is_admin(), publication supabase_realtime
│   │   ├── 0003_storage.sql        # Policy di sicurezza bucket allegati (sola lettura diretta)
│   │   ├── 0004_purge_and_epoch.sql# Funzioni per tombstones e bump_sync_epoch
│   │   ├── 0005_revoke_rpc_permissions.sql # Revoca privilegi RPC a utenti non autenticati
│   │   ├── 0006_canti_bpm_testo.sql# Supporto per BPM, tempo e testo puro
│   │   ├── 0007_canti_categoria.sql# Categorie canti
│   │   └── 0008_canti_origine_fonte.sql # Metadati storici e fonti canti
│   └── tests/                      # Test di sicurezza e script di validazione RLS
│       ├── security_test.sql       # Test SQL RLS per anon vs admin
│       └── run_security_check.mjs  # Runner test sicurezza
│
├── docs/                           # Documentazione tecnica di riferimento
│   ├── ARCHITECTURE.md             # Architettura completa e specifiche tecniche
│   ├── DECISIONS.md                # Registro delle decisioni architetturali (ADR)
│   ├── DESIGN.md                   # Sistema di design, colori OKLCH e identità visiva
│   ├── AUTOMAZIONE.md              # Automazioni GitHub Actions e cron job di keepalive
│   ├── GUIDA_CAPI.md               # Manuale operativo per i capi clan
│   ├── MANUTENZIONE.md             # Procedure di backup e ripristino
│   ├── SETUP_MANUALE.md            # Guida di configurazione iniziale
│   └── TEST_CHECKLIST.md           # Matrice di collaudo e test
│
├── .github/workflows/              # Pipeline CI/CD GitHub Actions
│   ├── ci.yml                      # CI completa (TypeScript, Vitest, Lighthouse, Playwright)
│   ├── deploy.yml                  # Deploy su GitHub Pages e smoke test post-deploy
│   ├── keepalive.yml               # Ping programmato bisettimanale per evitare la pausa di Supabase
│   └── maintenance.yml             # Pulizia programmata dei vecchi tombstones (>30 gg)
│
├── scripts/                        # Script di diagnostica e utilità
│   ├── check_weight_budget.mjs     # Verifica dei budget di peso (JS < 80KB, precache < 6.8MB)
│   ├── check_prod_schema.mjs       # Verifica integrità schema di produzione
│   └── generate_seed_sql.py        # Generatore SQL per seed canti
│
└── test/                           # Suite di test Vitest e Playwright
    ├── canti_chordpro.test.ts      # Test parsing ChordPro, trasposizione e responsive line renderer
    ├── canzoniere_layout.test.ts   # Test calcolo layout A4 a 2 colonne
    ├── sync_engine.test.ts         # Test motore di sincronizzazione e gestione tombstones
    ├── calendario_odg.test.ts      # Test calendario, punti OdG e presenze
    ├── csp_compliance.test.ts      # Test rispetto Content Security Policy
    └── verify_ui.spec.ts           # Test e2e Playwright su navigazione e componenti
```

---

## 4. DESIGN SYSTEM E CONVENZIONI DI CODICE
1. **Colori OKLCH**: Non ci sono codici esadecimali (`#hex`) nei componenti e nei fogli CSS. Tutti i colori sono token `oklch(...)` con contrasto garantito WCAG AAA/AA.
2. **Accessibilità & Icone**: Nessuna emoji viene usata come icona UI (politica zero-emoji). Tutte le icone usano `<Icon name="..." />` da `src/ui/Icon.tsx`.
3. **Local-First PWA**: La UI legge SEMPRE da IndexedDB. Il sync avviene in background in modalità non-bloccante.
4. **Chord-over-Lyric su Mobile**: La classe `.canto-screen-line` usa unità atomiche `.canto-word > .canto-unit` che contengono accordo e sillaba incolonnati, andando a capo insieme per evitare sovrapposizioni.
"""

README_CONTENT = """# Vault Scout - Clan Duc In Altum

Applicazione web progressiva (PWA) **Local-First / Offline-First** per la gestione delle attività, canti, bans, giochi e calendario per Clan Scout.

Consulta il file **[CLAUDE.md](./CLAUDE.md)** per la panoramica architetturale completa e la mappa di tutti i file inclusi in questo archivio.
"""

def prepare_export():
    if EXPORT_DIR.exists():
        shutil.rmtree(EXPORT_DIR)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Root configuration files
    root_files = [
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        "playwright.config.ts",
        "index.html",
        ".gitignore",
        ".lighthouserc.json"
    ]
    for rf in root_files:
        src_file = ROOT_DIR / rf
        if src_file.exists():
            shutil.copy2(src_file, EXPORT_DIR / rf)

    # Write CLAUDE.md and README.md
    (EXPORT_DIR / "CLAUDE.md").write_text(CLAUDE_GUIDE_CONTENT, encoding="utf-8")
    (EXPORT_DIR / "README.md").write_text(README_CONTENT, encoding="utf-8")

    # 2. Copy src/ (recursively, skipping .woff2 font binaries)
    src_target = EXPORT_DIR / "src"
    for path in (ROOT_DIR / "src").rglob("*"):
        if path.is_file():
            if path.suffix.lower() == ".woff2":
                continue # Skip binary fonts
            rel_path = path.relative_to(ROOT_DIR / "src")
            dest = src_target / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)

    # 3. Copy supabase/ (recursively, skip __pycache__)
    supabase_target = EXPORT_DIR / "supabase"
    for path in (ROOT_DIR / "supabase").rglob("*"):
        if path.is_file():
            if "__pycache__" in str(path):
                continue
            rel_path = path.relative_to(ROOT_DIR / "supabase")
            dest = supabase_target / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)

    # 4. Copy docs/ (only markdown files, preserving subdirs)
    docs_target = EXPORT_DIR / "docs"
    for path in (ROOT_DIR / "docs").rglob("*.md"):
        if path.is_file():
            rel_path = path.relative_to(ROOT_DIR / "docs")
            dest = docs_target / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)

    # 5. Copy .github/workflows/
    gh_target = EXPORT_DIR / ".github" / "workflows"
    gh_target.mkdir(parents=True, exist_ok=True)
    for path in (ROOT_DIR / ".github" / "workflows").glob("*.yml"):
        if path.is_file():
            shutil.copy2(path, gh_target / path.name)

    # 6. Copy scripts/ (only .mjs, .py, .json)
    scripts_target = EXPORT_DIR / "scripts"
    scripts_target.mkdir(parents=True, exist_ok=True)
    for path in (ROOT_DIR / "scripts").glob("*"):
        if path.is_file() and path.suffix.lower() in [".mjs", ".py", ".json", ".sql"]:
            shutil.copy2(path, scripts_target / path.name)

    # 7. Copy test/ (test files and fixtures, skipping binary docx/pdf)
    test_target = EXPORT_DIR / "test"
    for path in (ROOT_DIR / "test").rglob("*"):
        if path.is_file():
            if path.suffix.lower() in [".docx", ".pdf"]:
                continue # Skip binary documents
            rel_path = path.relative_to(ROOT_DIR / "test")
            dest = test_target / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)

    # Count files and total size
    all_files = list(EXPORT_DIR.rglob("*"))
    file_count = sum(1 for f in all_files if f.is_file())
    uncompressed_size = sum(f.stat().st_size for f in all_files if f.is_file())

    print(f"File preparati per Claude: {file_count} file")
    print(f"Dimensione non compressa: {uncompressed_size / 1024:.1f} KB ({uncompressed_size / (1024*1024):.2f} MB)")

    # Create ZIP
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        for file_path in EXPORT_DIR.rglob("*"):
            if file_path.is_file():
                arcname = file_path.relative_to(EXPORT_DIR)
                zipf.write(file_path, arcname)

    zip_size = ZIP_PATH.stat().st_size
    print(f"Archivio ZIP creato con successo: {ZIP_PATH}")
    print(f"Dimensione ZIP compressa: {zip_size / 1024:.1f} KB ({zip_size / (1024*1024):.2f} MB)")

    # Clean up staging directory
    shutil.rmtree(EXPORT_DIR)
    print("Cartella di staging temporanea ripulita.")

if __name__ == "__main__":
    prepare_export()
