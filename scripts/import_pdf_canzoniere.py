#!/usr/bin/env python3
"""
scripts/import_pdf_canzoniere.py

Estrazione geometrica ad alta precisione di canti scout da file PDF (anche disordinati,
con accordi sopra il testo, seconde voci, multi-pagina, notazioni come Fa_| e (Do)).

Uso:
  python scripts/import_pdf_canzoniere.py --pdf "_riferimenti/danza_la_vita.pdf"
  python scripts/import_pdf_canzoniere.py --pdf "_riferimenti/danza_la_vita.pdf" --json "canti_estratti.json"
"""

import sys
import os
import re
import json
import argparse
from typing import List, Dict, Tuple, Optional

# Assicura output UTF-8 su terminale Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERRORE: PyMuPDF non trovato. Esegui: pip install PyMuPDF", file=sys.stderr)
    sys.exit(1)


CHORD_TOKEN_REGEX = re.compile(
    r'^[\(\[]?'
    r'(?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si)'
    r'(?:[#b])?'
    r'(?:m|min|maj7|maj|7|sus4|sus2|add9|dim)?'
    r'(?:[\/](?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si)(?:[#b])?)?'
    r'(?:_\||_|\|)?'
    r'[\)\]]?$',
    re.I
)

DIRECTIVE_REGEX = re.compile(r'^(intro|strum|outro|stacco|interludio|finale):\s*', re.I)


def is_chord_token(token: str) -> bool:
    """Verifica se un singolo token e' un accordo valido."""
    cleaned = token.strip().replace('\u200b', '')
    if not cleaned:
        return False
    return bool(CHORD_TOKEN_REGEX.match(cleaned))


def normalize_chord_text(token: str) -> str:
    """Pulisce la notazione dell'accordo per il formato ChordPro."""
    c = token.strip().replace('\u200b', '')
    c = re.sub(r'_\||_|\|$', '', c)
    if c.startswith('(') and c.endswith(')'):
        inner = c[1:-1]
        inner = inner[0].upper() + inner[1:] if len(inner) > 0 else inner
        return f"({inner})"
    elif c:
        return c[0].upper() + c[1:]
    return c


def cluster_page_words_into_lines(words: List[Tuple]) -> List[Dict]:
    """
    Raggruppa le parole di una pagina in righe orizzontali in base alla coordinata Y.
    """
    lines_by_y = {}
    for w in words:
        text = w[4].replace('\u200b', '').strip()
        if not text:
            continue
        y0 = round(w[1], 1)
        found_y = None
        for ey in lines_by_y:
            if abs(ey - y0) <= 4.5:
                found_y = ey
                break
        if found_y is None:
            lines_by_y[y0] = []
            found_y = y0
        lines_by_y[found_y].append({
            'x0': w[0],
            'y0': w[1],
            'x1': w[2],
            'y1': w[3],
            'text': text
        })

    sorted_lines = []
    for y in sorted(lines_by_y.keys()):
        raw_words = sorted(lines_by_y[y], key=lambda x: x['x0'])
        full_text = ' '.join(x['text'] for x in raw_words)
        sorted_lines.append({
            'y': y,
            'words': raw_words,
            'text': full_text
        })
    return sorted_lines


def merge_chords_with_lyrics(chord_words: List[Dict], lyric_words: List[Dict]) -> str:
    """
    Allinea geometricamente gli accordi con snap musicale alle sillabe/parole.
    """
    if not lyric_words:
        return ' '.join(f"[{normalize_chord_text(c['text'])}]" for c in chord_words)

    injections: Dict[int, List[Tuple[int, str]]] = {i: [] for i in range(len(lyric_words))}
    trailing_chords: List[str] = []

    for c in chord_words:
        cx = c['x0']
        c_chord = normalize_chord_text(c['text'])
        
        target_idx = None
        for i, lw in enumerate(lyric_words):
            # Se l'accordo e' prima o vicino all'inizio della parola (tolleranza 8pt)
            if cx < lw['x0'] + 8.0:
                target_idx = i
                break
            # Se l'accordo cade all'interno dei confini della parola
            if lw['x0'] <= cx <= lw['x1']:
                target_idx = i
                break

        if target_idx is None:
            if cx > lyric_words[-1]['x1'] + 6.0:
                trailing_chords.append(f"[{c_chord}]")
                continue
            target_idx = len(lyric_words) - 1

        lw = lyric_words[target_idx]
        w_len = len(lw['text'])
        w_width = max(lw['x1'] - lw['x0'], 1.0)
        rel_x = cx - lw['x0']

        # Snap intelligente
        if rel_x <= 8.0 or (rel_x / w_width) <= 0.25:
            char_pos = 0
        elif rel_x >= w_width - 4.0:
            char_pos = w_len
        else:
            ratio = rel_x / w_width
            char_pos = min(max(round(ratio * w_len), 0), w_len)

        injections[target_idx].append((char_pos, c_chord))

    result_parts = []
    for idx, lw in enumerate(lyric_words):
        word_text = lw['text']
        chord_list = sorted(injections[idx], key=lambda x: x[0], reverse=True)
        
        curr_text = word_text
        for pos, chord_name in chord_list:
            curr_text = curr_text[:pos] + f"[{chord_name}]" + curr_text[pos:]
            
        result_parts.append(curr_text)

    line_result = ' '.join(result_parts)
    if trailing_chords:
        line_result += ' ' + ' '.join(trailing_chords)

    return line_result


def parse_pdf_canto(pdf_path: str) -> Dict:
    doc = fitz.open(pdf_path)
    
    titolo = ""
    autore = ""
    bpm_testo = ""
    misura = "4/4"
    
    all_lines: List[Dict] = []
    
    # 1. Raccogli e raggruppa le righe di tutte le pagine
    for page_idx, page in enumerate(doc):
        dict_data = page.get_text('dict')
        page_words = page.get_text('words')
        
        # Cerca titolo nella prima pagina (font piu' grande)
        if page_idx == 0:
            for b in dict_data.get('blocks', []):
                for l in b.get('lines', []):
                    line_text = ''.join(s['text'] for s in l.get('spans', [])).strip()
                    max_size = max((s['size'] for s in l.get('spans', [])), default=0)
                    if max_size >= 18.0 and not titolo and len(line_text) > 2:
                        titolo = line_text
                    elif 'canto scout' in line_text.lower() and not autore:
                        autore = line_text
                    elif 'tempo:' in line_text.lower() and not bpm_testo:
                        bpm_testo = line_text

        page_clustered = cluster_page_words_into_lines(page_words)
        
        for line in page_clustered:
            t_clean = line['text'].strip()
            # Escludi intestazioni duplicate
            if titolo and t_clean.upper() == titolo.upper():
                continue
            if autore and t_clean.lower() == autore.lower():
                continue
            all_lines.append(line)

    if not titolo:
        titolo = os.path.splitext(os.path.basename(pdf_path))[0].replace('_', ' ').title()

    # 2. Classificazione ed elaborazione delle righe
    chordpro_lines: List[str] = []
    i = 0
    in_chorus = False

    while i < len(all_lines):
        curr = all_lines[i]
        curr_words = curr['words']
        curr_text = curr['text'].strip()

        if not curr_text or curr_text == '…   …   …' or curr_text == '...':
            i += 1
            continue

        dir_match = DIRECTIVE_REGEX.match(curr_text)
        if dir_match:
            chordpro_lines.append(f"{{comment: {curr_text}}}")
            i += 1
            continue

        chord_count = sum(1 for w in curr_words if is_chord_token(w['text']))
        is_chord_line = len(curr_words) > 0 and (chord_count / len(curr_words) >= 0.5)

        if is_chord_line:
            if i + 1 < len(all_lines):
                next_line = all_lines[i + 1]
                next_words = next_line['words']
                next_chord_count = sum(1 for w in next_words if is_chord_token(w['text']))
                next_is_chord_line = len(next_words) > 0 and (next_chord_count / len(next_words) >= 0.5)
                
                y_dist = next_line['y'] - curr['y']
                if not next_is_chord_line and 0 < y_dist < 40.0:
                    merged = merge_chords_with_lyrics(curr_words, next_words)
                    
                    if ('RIT.' in merged or 'RIT:' in merged) and not in_chorus:
                        chordpro_lines.append("{soc}")
                        in_chorus = True
                    
                    chordpro_lines.append(merged)
                    i += 2
                    continue

            chordpro_lines.append(' '.join(f"[{normalize_chord_text(w['text'])}]" for w in curr_words))
            i += 1
        else:
            if in_chorus and ('strum:' in curr_text.lower() or 'cammina' in curr_text.lower()):
                chordpro_lines.append("{eoc}")
                in_chorus = False

            chordpro_lines.append(curr_text)
            i += 1

    if in_chorus:
        chordpro_lines.append("{eoc}")

    # Pulisci e raggruppa in strofe leggibili
    final_chordpro = "\n".join(chordpro_lines)

    # Assicura righe vuote corrette prima delle strofe e dopo ritornelli
    final_chordpro = re.sub(r'(\n\{soc\})', r'\n\1', final_chordpro)
    final_chordpro = re.sub(r'(\{eoc\}\n)', r'\1\n', final_chordpro)

    return {
        'titolo': titolo,
        'autore': autore or "Canto scout",
        'testo_chordpro': final_chordpro,
        'tonalita': 'Do',
        'misura': misura,
        'bpm_testo': bpm_testo or None,
    }


def main():
    parser = argparse.ArgumentParser(description="Parser geometrico PDF -> ChordPro per Canzoniere Vault")
    parser.add_argument('--pdf', required=True, help="Percorso del file PDF da analizzare")
    parser.add_argument('--json', help="Percorso del file JSON in uscita (opzionale)")
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"File non trovato: {args.pdf}", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Analisi geometrica di {args.pdf}...")
    canto = parse_pdf_canto(args.pdf)

    print(f"\n[+] Titolo: {canto['titolo']}")
    print(f"[+] Autore: {canto['autore']}")
    print("\n--- TESTO CHORDPRO GENERATO ---\n")
    print(canto['testo_chordpro'])
    print("\n-------------------------------\n")

    if args.json:
        with open(args.json, 'w', encoding='utf-8') as f:
            json.dump([canto], f, ensure_ascii=False, indent=2)
        print(f"[+] Salvato in {args.json}")


if __name__ == '__main__':
    main()
