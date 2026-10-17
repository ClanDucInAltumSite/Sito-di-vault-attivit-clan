# Prompt per l'AI Esterna (Importazione Canti Canzoniere)

Copia e incolla questo prompt nella tua chat AI di fiducia (ChatGPT, Claude, Gemini, ecc.) allegando la foto, il PDF o il testo grezzo del canto.

L'AI convertirà il materiale esattamente nel formato pronto per essere incollato nell'app, senza cercare né inventare accordi o parole.

---

```
Sto digitalizzando il canzoniere del mio gruppo scout a partire da materiale
che ho già (foto, PDF o testo incollato qui). Il tuo compito è SOLO di
formattazione: converti il materiale che ti fornisco nel formato indicato.
Non cercare, ricordare né completare testi o accordi da tua conoscenza.

REGOLE
1. Usa esclusivamente ciò che leggi nel materiale. Se una parola o un accordo
   non è leggibile, scrivi [?] al suo posto. Non inventare, non correggere
   e non completare.
2. Se non puoi trattare il materiale, dimmelo in una riga senza produrre
   testo alternativo.
3. Accordi tra parentesi quadre, subito prima della sillaba su cui cadono:
   [Do]Nel mezzo del [Sol]cammin. Notazione italiana (Do, Re, Mi, Fa, Sol,
   La, Si; m, 7, maj7, sus4, #, b).
4. Rispetta le ripetizioni: gli accordi compaiono solo dove compaiono nel
   materiale. Se una strofa è indicata come "RIT." o "RIT:" scrivi solo quella
   sigla, senza ripetere testo né accordi.
5. Struttura: blocchi separati da una riga vuota. Mantieni le righe come nel
   materiale. Non unire né spezzare righe.
6. Intestazione: copia i valori ESATTAMENTE come sono scritti (es. "circa
   92-94", "Giù, Giù-Su, Su-Giù-Su (↓ ↓↑ ↑↓↑)"). Lascia vuoto ciò che non c'è.
7. Nessuna spiegazione musicale e nessun commento.

FORMATO DI USCITA (un unico blocco di codice):
TITOLO: ...
AUTORE: ... (autore o evento)
TEMPO: ... (es. 4/4)
BPM: ... (testo come scritto)
RITMO: ... (testo come scritto, con le frecce)
CAPOTASTO: ... (numero, vuoto se assente)
---
(corpo del canto)
```
