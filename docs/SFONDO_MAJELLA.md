# Sfondo Topografico Ambientale — Massiccio della Majella

Documentazione geografica, metrologica e cartografica relativa allo sfondo vettoriale globale dell'applicazione *Vault Clan - Duc In Altum*.

---

## 1. Origine dei Dati e Metodologia di Elaborazione

Lo sfondo cartografico è generato a partire da dati orografici reali ad alta risoluzione del **Copernicus Digital Elevation Model (GLO-30)**, gestito dall'Agenzia Spaziale Europea (ESA) e dalla Commissione Europea:

- **Dataset:** Copernicus GLO-30 Public DEM (Cloud Optimized GeoTIFF, risoluzione spaziale 1 arcosecondo ≈ 30 metri).
- **Tile di riferimento:** `Copernicus_DSM_COG_10_N42_00_E014_00_DEM.tif` (Latitudine 42°–43° N, Longitudine 14°–15° E).
- **Riquadro Geografico (Bounding Box):**
  - Longitudine Ovest: `14.005° E` (versante di Caramanico, Lama Bianca e Passo San Leonardo)
  - Longitudine Est: `14.195° E` (versante orientale verso Fara San Martino)
  - Latitudine Sud: `42.060° N` (Fondo di Majella e sella di Femmina Morta)
  - Latitudine Nord: `42.120° N` (cresta di Monte Focalone e Blockhaus)
- **Rapporto di Forma:** Il riquadro reale (~15.65 km × 6.66 km, rapporto ~2.35:1) è calibrato sul `viewBox="0 0 1200 480"` dell'SVG (rapporto 2.5:1), garantendo proporzioni naturali senza deformazioni percepibili.
- **Generazione in fase di build:** Le curve di livello sono calcolate tramite lo script [`scripts/generate_majella_svg.mjs`](file:///scripts/generate_majella_svg.mjs) utilizzando l'algoritmo di contorno a soglie discrete e la semplificazione vettoriale di **Douglas-Peucker** ($\epsilon = 0.95\text{ px}$ su coordinate SVG).
- **Peso e Prestazioni:**
  - Peso SVG non compresso: **54.4 KB**.
  - Peso SVG compresso (GZIP): **20.3 KB** (sotto la soglia limite di 40 KB).
  - Parallasse fluida: applicata tramite trasformazione diretta sul nodo DOM (`ref.style.transform = translate3d(0, -Ypx, 0)`), senza alcun ciclo di re-rendering né ricalcolo VDOM in scroll.

---

## 2. Punti Cartografici Ufficiali Verificati (Massimo 7 Etichette)

Tutti i toponimi, le quote e le coordinate sono stati ricavati incrociando almeno due fonti cartografiche attendibili (Club Alpino Italiano, Parco Nazionale della Majella, IGM e CTR Regionale) e convalidati numericamente sul DEM Copernicus.

| # | Luogo / Toponimo | Quota Ufficiale | Quota DEM | Coordinate WGS84 (Lat, Lon) | Coordinate SVG (x, y) | Marcatore | Descrizione Oro-Idrografica | Fonti Cartografiche Consultate |
|---|------------------|-----------------|-----------|-----------------------------|-----------------------|-----------|-----------------------------|--------------------------------|
| 1 | **Monte Amaro** | 2.793 m | 2.788 m | `42° 05′ 11″ N, 14° 05′ 09″ E`<br>(`42.086307° N, 14.085878° E`) | `(510.8, 269.5)` | ▲ Vetta con punto giallo scout (`--color-giochi`) | Vetta principale e tetto della Majella (seconda cima più alta degli Appennini dopo il Corno Grande del Gran Sasso). | 1. CAI Pescara / CAI Sulmona (Carta 1:25.000)<br>2. Parco Nazionale della Majella (Catasto Vette)<br>3. IGM Foglio 147 IV NO "Monte Amaro" |
| 2 | **Rava del Ferro** | 2.100 m *(mediana)* | 2.115 m | `42° 05′ 29″ N, 14° 04′ 21″ E`<br>(`42.0915° N, 14.0725° E`) | `(426.3, 228.0)`<br>rotazione: -32° | Tracciato canalone (testo inclinato) | Impressionante e ripido canalone glaciale sul versante occidentale risalito dallo storico sentiero alpinistico CAI B5. | 1. CAI Pescara – Relazione tecnica Sentiero B5<br>2. Parco Nazionale della Majella – Rete Sentieri<br>3. Guida Monti d'Italia CAI-TCI "Appennino Centrale" |
| 3 | **Bivacco Pelino** | 2.790 m | 2.788 m | `42° 05′ 12″ N, 14° 05′ 14″ E`<br>(`42.0868° N, 14.0872° E`) | `(519.2, 265.6)` | • Punto rifugio | Caratteristico bivacco geodetico ad igloo rosso metallico intitolato a Cesare Mario Pelino, installato in vetta dal CAI Sulmona nel 1966. | 1. CAI Sezione di Sulmona (Ente gestore)<br>2. Parco Nazionale della Majella – Elenco Bivacchi d'Alta Quota |
| 4 | **Monte Focalone** | 2.676 m | 2.677 m | `42° 06′ 26″ N, 14° 06′ 54″ E`<br>(`42.1072° N, 14.1150° E`) | `(694.7, 102.4)` | ▲ Vetta secondaria | Rilievo piramidale strategico della dorsale nord che domina il vallone di Santo Spirito e l'anfiteatro delle Murelle. | 1. Parco Nazionale della Majella (Carta Escursionistica 1:25.000)<br>2. IGM Foglio 147 IV NE |
| 5 | **Monte Acquaviva** | 2.737 m | 2.726 m | `42° 06′ 12″ N, 14° 07′ 16″ E`<br>(`42.1033° N, 14.1211° E`) | `(733.3, 133.6)` | ▲ Vetta secondaria | Seconda cima più elevata del gruppo della Majella, caratterizzata da vasti pianori rocciosi d'alta quota. | 1. CAI Chieti – Itinerari delle vette<br>2. CTR Regione Abruzzo 1:10.000 (Foglio 360090) |
| 6 | **Passo San Leonardo** | 1.282 m | 1.281 m | `42° 04′ 25″ N, 14° 01′ 49″ E`<br>(`42.0736° N, 14.0303° E`) | `(159.8, 371.2)` | • Punto valico | Storico valico appenninico di comunicazione fra i comuni di Pacentro e Sant'Eufemia a Maiella, porta d'accesso occidentale al massiccio. | 1. Parco Nazionale della Majella – Guida agli accessi e sentiero Q7<br>2. IGM Foglio 146 I NE |
| 7 | **Lama Bianca** | 1.500 m | 1.509 m | `42° 06′ 01″ N, 14° 03′ 34″ E`<br>(`42.1003° N, 14.0594° E`) | `(343.6, 157.6)` | • Punto base sentiero | Riserva Naturale Statale con faggeta secolare alle pendici occidentali, punto di partenza carrabile del sentiero B5 per la Rava del Ferro. | 1. Carabinieri Biodiversità Pescara – Riserva Naturale Lama Bianca<br>2. CAI Pescara – Punto di partenza escursionistico |

---

## 3. Sentiero Escursionistico Scout (CAI B5)

Nel disegno vettoriale è tracciata con linea a tratteggio giallo ambra (`--color-giochi`, classe `.topo-line-accent`) l'ascesa reale del sentiero CAI B5:

1. **Partenza:** Piazzale boschivo di Lama Bianca (quota 1.496 m, coordinate `42.1003° N, 14.0594° E`).
2. **Avvicinamento:** Risalita del versante boscato fino al poggio panoramico (quota 1.606 m, `42.0932° N, 14.0674° E`).
3. **Canalone:** Salita faticosa lungo l'asse della Rava del Ferro fino a quota 2.280 m (`42.0905° N, 14.0755° E`).
4. **Sbocco di Cresta:** Uscita sui pianori sommitali lunari a quota 2.450 m (`42.0890° N, 14.0790° E`).
5. **Cima:** Arrivo sul punto culminante di Monte Amaro e Bivacco Pelino a quota 2.793 m (`42.086307° N, 14.085878° E`), dove è collocato il marcatore circolare dorato con bordatura inchiostro.

---

## 4. Gerarchia Visiva, Contrasto e Accessibilità (WCAG AA)

- **Curve Intermedie (passo 100 m):** Opacità 0.055 (tema chiaro) / 0.08 (tema scuro), spessore 0.8px con colore `--color-ink`.
- **Curve Maestre (passo 200 m):** Opacità 0.12 (tema chiaro) / 0.16 (tema scuro), spessore 1.25px con tinta azzurro nobile (`--color-canti`).
- **Etichette:** Opacità 0.22 - 0.32, font sans-serif dell'applicazione (`--font-sans`), posizionate in aree non interferenti con i testi dei contenuti.
- **Maschera Verticale:** `-webkit-mask-image: linear-gradient(to top, black 25%, transparent 100%)` che dissolve completamente lo sfondo verso l'alto dello schermo.
- **Nascosto in Stampa e Lettura:**
  - `@media print`: `.topo-contour-wrapper { display: none !important; }`.
  - Modalità lettura a tutto schermo: `CantoReadingMode` possiede `z-index: 100` e sfondo opaco `var(--color-bg)`, isolando completamente la vista.
- **Rispetto di `prefers-reduced-motion`:**
  - Qualsiasi animazione o parallasse viene disattivata istantaneamente (`animation: none !important; transform: none !important;`).
