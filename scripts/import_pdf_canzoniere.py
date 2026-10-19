#!/usr/bin/env python3
"""
scripts/import_pdf_canzoniere.py

Estrazione geometrica ad alta precisione di canti scout da file PDF.
Supporta:
- Riconoscimento titoli e sottotitoli
- Filtro rumore web (watermark, siti, numeri di pagina)
- Prevenzione trappole parole italiane (La carta e la colla insieme NON è una riga di accordi)
- Normalizzazione accordi italiani (La- -> Lam, Do#- -> Do#m, Si- -> Sim)
- Modulazioni (Do -> Re -> Mi)
- Allineamento sillabico perfetto [Accordo]parola
- Cucitura continua multipagina
"""

import sys
import os
import re
import json
import argparse
from typing import List, Dict, Tuple, Optional

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERRORE: PyMuPDF non trovato. Esegui: pip install PyMuPDF", file=sys.stderr)
    sys.exit(1)


# Regex per accordi: supporta notazione italiana e inglese con alterazioni e suffissi come '-' (minore)
CHORD_TOKEN_REGEX = re.compile(
    r'^[\(\[]?'
    r'(?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si|DO|RE|MI|FA|SOL|LA|SI)'
    r'(?:[#b])?'
    r'(?:m|min|maj7|maj|7|sus4|sus2|add9|dim|\-)?'
    r'(?:[\/](?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si|DO|RE|MI|FA|SOL|LA|SI)(?:[#b])?)?'
    r'(?:_\||_|\|)?'
    r'[\)\]\.\,]?$',
    re.I
)

DIRECTIVE_REGEX = re.compile(r'^(intro|strum|outro|stacco|interludio|finale):\s*', re.I)

# Frasi e pattern di rumore tipici (siti, pagine, watermark)
NOISE_PATTERNS = [
    re.compile(r'maestro\s+dei\s+giochi', re.I),
    re.compile(r'www\.[a-z0-9\.\-_]+\.[a-z]{2,}', re.I),
    re.compile(r'https?://[^\s]+', re.I),
    re.compile(r'^\d+$'),                     # Numero di pagina isolato (1, 2, 3...)
    re.compile(r'^pag(?:ina)?\.?\s*\d+', re.I),
    re.compile(r'^canti/categoria\s+', re.I), # Metadato categoria
]

# Nomi delle note italiane base
VALID_BASE_CHORDS = {
    'do', 're', 'mi', 'fa', 'sol', 'la', 'si',
    'c', 'd', 'e', 'f', 'g', 'a', 'b'
}

# Parole italiane comuni che NON devono mai essere scambiate per accordi
ITALIAN_COMMON_WORDS = {
    'il', 'lo', 'i', 'gli', 'le', 'un', 'uno', 'una',
    'di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
    'ed', 'od', 'ma', 'se', 'che', 'non',
    'carta', 'colla', 'insieme', 'ragazzi', 'ancora', 'tempo',
    'aperto', 'davanti', 'giorni', 'lunghi', 'calzoni', 'corti',
    'caccia', 'vento', 'semplici', 'sogni', 'morti', 'danze',
    'mondo', 'terra', 'strada', 'fiori', 'cuore', 'potere', 'ladri',
    'stella', 'fuoco', 'luce', 'notte', 'sole', 'passi', 'mare',
    'volare', 'vola', 'vallate', 'portato', 'acque', 'chiara', 'idee',
    'pensare', 'evasione', 'grano', 'seme', 'uomo', 'donna', 'spalle'
}


def is_noise_line(text: str) -> bool:
    cleaned = text.strip()
    if not cleaned:
        return True
    for pat in NOISE_PATTERNS:
        if pat.search(cleaned):
            return True
    return False


def is_chord_token(token: str) -> bool:
    cleaned = token.strip().replace('\u200b', '')
    if not cleaned:
        return False
    cleaned = re.sub(r'[\.\,]$', '', cleaned)
    # Se è una congiunzione o preposizione italiana non musicale
    if cleaned.lower() in {'ed', 'od', 'da', 'in', 'su', 'di', 'ma', 'se', 'non'}:
        return False
    return bool(CHORD_TOKEN_REGEX.match(cleaned))


def normalize_chord_text(token: str) -> str:
    c = token.strip().replace('\u200b', '')
    c = re.sub(r'[\.\,]$', '', c)
    c = re.sub(r'_\||_|\|$', '', c)
    
    has_paren = c.startswith('(') and c.endswith(')')
    if has_paren:
        c = c[1:-1]

    # Converti '-' in 'm' (minore), es. LA- -> Lam, DO#- -> Do#m, SI- -> Sim
    if c.endswith('-'):
        c = c[:-1] + 'm'

    match = re.match(r'^([A-Za-z]+)(.*)$', c)
    if match:
        root = match.group(1).capitalize()
        rest = match.group(2)
        if rest.startswith('M') and not rest.startswith('Maj'):
            rest = 'm' + rest[1:]
        c = root + rest

    if has_paren:
        return f"({c})"
    return c


def is_strictly_chord_line(words: List[Dict]) -> bool:
    if not words:
        return False

    tokens = [w['text'].strip().replace('\u200b', '') for w in words]
    tokens = [re.sub(r'[\.\,]$', '', t) for t in tokens if t]
    
    if not tokens:
        return False

    # Se c'e' una qualsiasi parola italiana comune di senso compiuto, NON puo' essere riga di accordi
    for t in tokens:
        t_low = t.lower()
        if t_low in ITALIAN_COMMON_WORDS:
            return False
        if len(t) >= 4 and not is_chord_token(t):
            return False

    # Almeno il 60% dei token deve essere un accordo valido
    chord_count = sum(1 for t in tokens if is_chord_token(t))
    return (chord_count / len(tokens)) >= 0.60


def cluster_page_words_into_lines(words: List[Tuple]) -> List[Dict]:
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
    if not lyric_words:
        return ' '.join(f"[{normalize_chord_text(c['text'])}]" for c in chord_words)

    injections: Dict[int, List[Tuple[int, str]]] = {i: [] for i in range(len(lyric_words))}
    trailing_chords: List[str] = []

    for c in chord_words:
        cx = c['x0']
        c_chord = normalize_chord_text(c['text'])
        
        target_idx = None
        for i, lw in enumerate(lyric_words):
            if cx < lw['x0'] + 10.0:
                target_idx = i
                break
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

        if rel_x <= 10.0 or (rel_x / w_width) <= 0.30:
            char_pos = 0
        elif target_idx + 1 < len(lyric_words) and cx >= lw['x1'] - 6.0:
            # Snap all'inizio della parola successiva se l'accordo cade a cavallo dello spazio
            target_idx += 1
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
        # Ripristino caratteri accentati corrotti da font PDF senza ToUnicode CMap
        word_text = re.sub(r'pi[\uFFFD\?]', 'più', word_text)
        word_text = re.sub(r'l[\uFFFD\?]', 'là', word_text)
        word_text = re.sub(r'^[\uFFFD\?]$', 'è', word_text)
        word_text = re.sub(r'cambier[\uFFFD\?]', 'cambierà', word_text)
        word_text = re.sub(r"c'[\uFFFD\?]", "c'è", word_text)
        word_text = re.sub(r"^E'$", "È", word_text)

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
    sottotitolo = ""
    autore = ""
    
    all_lines: List[Dict] = []
    
    for page_idx, page in enumerate(doc):
        dict_data = page.get_text('dict')
        page_words = page.get_text('words')
        
        if page_idx == 0:
            for b in dict_data.get('blocks', []):
                for l in b.get('lines', []):
                    line_text = ''.join(s['text'] for s in l.get('spans', [])).strip()
                    max_size = max((s['size'] for s in l.get('spans', [])), default=0)
                    
                    if is_noise_line(line_text):
                        continue
                        
                    if max_size >= 16.0 and not titolo and len(line_text) > 2:
                        titolo = line_text
                    elif titolo and not sottotitolo and line_text.startswith('(') and line_text.endswith(')'):
                        sottotitolo = line_text
                    elif 'canto scout' in line_text.lower() and not autore:
                        autore = line_text

        page_clustered = cluster_page_words_into_lines(page_words)
        
        for line in page_clustered:
            t_clean = line['text'].strip()
            if is_noise_line(t_clean):
                continue
            if titolo and t_clean.upper() == titolo.upper():
                continue
            if sottotitolo and t_clean == sottotitolo:
                continue
            if autore and t_clean.lower() == autore.lower():
                continue
            all_lines.append(line)

    if not titolo:
        titolo = os.path.splitext(os.path.basename(pdf_path))[0].replace('_', ' ').title()

    chordpro_lines: List[str] = []
    i = 0
    in_chorus = False

    while i < len(all_lines):
        curr = all_lines[i]
        curr_words = curr['words']
        curr_text = curr['text'].strip()

        if not curr_text or curr_text in {'…   …   …', '...', '… … …'}:
            i += 1
            continue

        # Ripara caratteri accentati corrotti dal font del PDF
        curr_text = re.sub(r'pi[\uFFFD\?]', 'più', curr_text)
        curr_text = re.sub(r'l[\uFFFD\?]', 'là', curr_text)
        curr_text = re.sub(r'\b[\uFFFD\?]\b', 'è', curr_text)
        curr_text = re.sub(r'cambier[\uFFFD\?]', 'cambierà', curr_text)
        curr_text = re.sub(r"c'[\uFFFD\?]", "c'è", curr_text)
        curr_text = re.sub(r"^E'\s", "È ", curr_text)

        dir_match = DIRECTIVE_REGEX.match(curr_text)
        if dir_match:
            chordpro_lines.append(f"{{comment: {curr_text}}}")
            i += 1
            continue

        # Gestione riga RIT. isolata (promemoria ritornello)
        if curr_text.upper() in {'RIT.', 'RIT:'}:
            if in_chorus:
                chordpro_lines.append("{eoc}")
                in_chorus = False

            has_lyrics_after = False
            if i + 2 < len(all_lines):
                if is_strictly_chord_line(all_lines[i+1]['words']) and not is_strictly_chord_line(all_lines[i+2]['words']):
                    # Se non è una strofa di modulazione (es. non inizia con Ed ancora o E spingendo)
                    t_after = all_lines[i+2]['text'].strip()
                    if not any(t_after.startswith(w) for w in ["Ed ancora", "E spingendo"]):
                        has_lyrics_after = True

            if has_lyrics_after:
                chordpro_lines.append("{soc}")
                chordpro_lines.append("RIT.")
                in_chorus = True
            else:
                chordpro_lines.append("RIT.")
            i += 1
            continue

        if is_strictly_chord_line(curr_words):
            if i + 1 < len(all_lines):
                next_line = all_lines[i + 1]
                next_words = next_line['words']
                
                y_dist = next_line['y'] - curr['y']
                if not is_strictly_chord_line(next_words) and 0 < y_dist < 40.0:
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
            if in_chorus and any(curr_text.startswith(w) for w in ["È ", "E' ", "Ed ", "E spingendo", "i nostri aquiloni", "[Re]", "[Mi]", "Non ", "Meccanismi"]):
                chordpro_lines.append("{eoc}")
                in_chorus = False

            chordpro_lines.append(curr_text)
            i += 1

    if in_chorus:
        chordpro_lines.append("{eoc}")

    final_chordpro = "\n".join(chordpro_lines)

    return {
        'titolo': titolo,
        'sottotitolo': sottotitolo,
        'autore': autore or "Canto scout",
        'testo_chordpro': final_chordpro,
        'tonalita': 'Do',
        'misura': '4/4',
    }


def main():
    parser = argparse.ArgumentParser(description="Parser geometrico PDF -> ChordPro")
    parser.add_argument('--pdf', required=True, help="Percorso del file PDF")
    parser.add_argument('--json', help="Percorso del file JSON in uscita")
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"File non trovato: {args.pdf}", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Analisi di {args.pdf}...")
    canto = parse_pdf_canto(args.pdf)

    full_title = canto['titolo']
    if canto.get('sottotitolo'):
        full_title += f" {canto['sottotitolo']}"

    print(f"\n[+] Titolo: {full_title}")
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
