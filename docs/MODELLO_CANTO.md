# Modello Documento Word (.docx) per l'Importazione Canti

Questa guida descrive la struttura consigliata per i documenti Microsoft Word (`.docx`) o Google Docs (scaricati in formato `.docx`) da importare nel Canzoniere di **Vault Scout**.

---

## 1. Struttura del Documento

Un documento compatibile è composto da tre sezioni principali:
1. **Intestazione (Titolo, Autore, Categoria e Parametri Musicali)**
2. **Linea di separazione** (facoltativa)
3. **Corpo del Canto** (a colonna singola o tabella a 2 colonne)

```text
TITOLO DEL CANTO
Autore del canto o evento (in corsivo)
Tempo: 4/4 ; circa 92-94 BPM. Ritmo pennata: ↓ ↑ ↓↑. Capotasto: 2. Tonalità: Do.
Categoria: Scout
------------------------------------------------------------------------
[Corpo del canto con accordi posizionati sopra il testo o tra parentesi]
```

---

## 2. Intestazione e Metadati

### Titolo
- Impostare lo stile del paragrafo su **Titolo** o **Titolo 1** (*Heading 1*), oppure testo maiuscolo in grassetto con dimensione $\ge 16\,\text{pt}$.
- Il titolo viene normalizzato automaticamente conservando la spaziatura.

### Autore / Evento
- Posizionato subito sotto il titolo, formattato in **corsivo** (*Italic*) o con stile **Sottotitolo** (*Subtitle*).
- Esempio: *Canto scout*, *B.-P.*, *Route Nazionale 2014*.

### Riga Parametri Musicali
Una riga di testo contenente i parametri con etichetta e due punti:
- **Tempo / Misura:** `Tempo: 4/4` (o `3/4`, `6/8`, `2/4`).
- **BPM:** `; circa 92-94 BPM` o `BPM: 100`.
- **Ritmo / Pennata:** `Ritmo pennata: ↓ ↑ ↓↑` o `Ritmo: Giù, Giù-Su (↓ ↑ ↓↑)`.
- **Capotasto:** `Capotasto: 2` (da 0 a 12).
- **Tonalità esplicita:** `Tonalità: Do` (o `Key: C`).

### Riga Categoria (Facoltativa)
Riga con la parola chiave `Categoria:` seguita da uno dei valori ammessi:
- `Categoria: Scout` oppure `Categoria: Canti scout` $\rightarrow$ categorizzato come `scout`
- `Categoria: Chiesa` oppure `Categoria: Canti di chiesa` $\rightarrow$ categorizzato come `chiesa`
- `Categoria: Esterni` oppure `Categoria: Canti esterni` $\rightarrow$ categorizzato come `esterni`

> Se omessa, il canto viene importato senza categoria predefinita e la categoria verrà selezionata obbligatoriamente nella schermata di revisione prima del salvataggio.

---

## 3. Corpo del Canto e Layout a Colonne

### Tabella a 2 Colonne (Consigliata per canti lunghi)
Per impaginare il canto su due colonne:
- Inserire una **tabella di 1 riga e 2 colonne** senza bordi visibili.
- La colonna di sinistra contiene la prima parte del canto (es. strofe 1 e 2, ritornello).
- La colonna di destra contiene la seconda parte del canto (es. strofe successive, finale).
- L'importatore legge prima l'intera colonna sinistra dall'alto in basso, poi l'intera colonna destra, preservando la corretta sequenza di lettura.

### Posizionamento degli Accordi
Sono supportati due formati per gli accordi nel testo:
1. **Accordi su riga sopraelevata:** la riga contenente gli accordi si trova subito sopra la riga di testo. È consigliato impostare il testo degli accordi in **grassetto**.
2. **Accordi in linea ChordPro:** accordi racchiusi tra parentesi quadre prima della sillaba di ancoraggio (es. `[Do]Canta [Fa]con la [Sol]voce`).

### Notazione degli Accordi
- Notazione italiana (`Do`, `Re`, `Mi`, `Fa`, `Sol`, `La`, `Si`) o anglosassone (`C`, `D`, `E`, `F`, `G`, `A`, `B`).
- Accordo minore con trattino: `La-` $\rightarrow$ convertito automaticamente in `Lam`.
- Alterazioni e suffissi: `#`, `b`, `7`, `maj7`, `sus4`, `add9`, `dim`, `/` (*slash chords* es. `Re/Fa#`).

### Ritornello
- Indicare l'inizio del ritornello con `RIT.` o `RIT:`.
- In alternativa, racchiudere il ritornello tra le direttive `{soc}` (start of chorus) e `{eoc}` (end of chorus).
