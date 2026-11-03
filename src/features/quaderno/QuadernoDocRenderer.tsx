// src/features/quaderno/QuadernoDocRenderer.tsx
// Renderer Virtual DOM Preact puro per documenti Quaderno in Markdown arricchito
// Conforme a sicurezza XSS (zero HTML injection e rendering nativo VDOM)

import { JSX, Fragment } from 'preact';

interface PatternRule {
  regex: RegExp;
  render: (m: RegExpMatchArray, key: string) => JSX.Element;
}

const REGEX_INLINE_PATTERNS: PatternRule[] = [
  // Immagine inline
  {
    regex: /!\[(.*?)\]\((.*?)\)/,
    render: (m, k) => (
      <img
        key={k}
        src={m[2] ?? ''}
        alt={m[1] ? m[1].trim() : 'Immagine allegata'}
        className="doc-inline-img"
      />
    ),
  },
  // Evidenziatore con colore esplicito: ==green:testo==, ==blue:testo==, ==coral:testo==, ==yellow:testo==
  {
    regex: /==([a-z]+):(.*?)==/,
    render: (m, k) => {
      const colorName = m[1] ?? 'yellow';
      const inner = m[2] ?? '';
      const valid = ['green', 'blue', 'coral', 'yellow'].includes(colorName);
      const cls = valid ? `doc-highlight doc-highlight-${colorName}` : 'doc-highlight doc-highlight-yellow';
      return (
        <mark key={k} className={cls}>
          {parseInlineText(inner)}
        </mark>
      );
    },
  },
  // Evidenziatore semplice (default giallo): ==testo==
  {
    regex: /==(.*?)==/,
    render: (m, k) => (
      <mark key={k} className="doc-highlight doc-highlight-yellow">
        {parseInlineText(m[1] ?? '')}
      </mark>
    ),
  },
  // Grassetto **testo**
  {
    regex: /\*\*(.*?)\*\*/,
    render: (m, k) => <strong key={k}>{parseInlineText(m[1] ?? '')}</strong>,
  },
  // Corsivo *testo*
  {
    regex: /\*([^*]+)\*/,
    render: (m, k) => <em key={k}>{parseInlineText(m[1] ?? '')}</em>,
  },
  // Sottolineato <u>testo</u>
  {
    regex: /<u>(.*?)<\/u>/,
    render: (m, k) => <u key={k}>{parseInlineText(m[1] ?? '')}</u>,
  },
  // Sottolineato alternativo ++testo++
  {
    regex: /\+\+(.*?)\+\+/,
    render: (m, k) => <u key={k}>{parseInlineText(m[1] ?? '')}</u>,
  },
  // Barrato ~~testo~~
  {
    regex: /~~(.*?)~~/,
    render: (m, k) => <del key={k}>{parseInlineText(m[1] ?? '')}</del>,
  },
];

interface MatchedBracketPattern {
  index: number;
  length: number;
  render: (key: string) => JSX.Element;
}

/**
 * Parsing a parentesi bilanciate per tag [color:...], [font:...], [size:...]
 */
function findBracketPattern(text: string): MatchedBracketPattern | null {
  const startRegex = /\[(color:[a-z]+|font:[a-z]+|size:\d+):/;
  const m = text.match(startRegex);
  if (!m || m.index === undefined) return null;

  const startIdx = m.index;
  const prefix = m[0];
  const tagSpec = m[1] ?? '';

  let depth = 1;
  let endIdx = -1;
  for (let i = startIdx + prefix.length; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx === -1) return null;

  const innerText = text.slice(startIdx + prefix.length, endIdx);
  const length = endIdx - startIdx + 1;

  const render = (k: string): JSX.Element => {
    if (tagSpec.startsWith('color:')) {
      const color = tagSpec.slice(6) || 'default';
      let colorVar = 'inherit';
      if (color === 'purple') colorVar = 'var(--color-quaderno)';
      else if (color === 'blue') colorVar = 'var(--color-canti)';
      else if (color === 'green') colorVar = 'var(--color-calendario)';
      else if (color === 'red') colorVar = 'var(--color-bans)';
      else if (color === 'amber') colorVar = 'var(--color-giochi)';

      return (
        <span key={k} style={{ color: colorVar, fontWeight: color !== 'default' ? 600 : 'inherit' }}>
          {parseInlineText(innerText)}
        </span>
      );
    }
    if (tagSpec.startsWith('font:')) {
      const family = tagSpec.slice(5) || 'sans';
      const fontVal =
        family === 'serif'
          ? 'Georgia, Cambria, "Times New Roman", serif'
          : family === 'mono'
          ? 'var(--font-mono)'
          : 'var(--font-sans)';
      return (
        <span key={k} style={{ fontFamily: fontVal }}>
          {parseInlineText(innerText)}
        </span>
      );
    }
    if (tagSpec.startsWith('size:')) {
      const sizePx = Number(tagSpec.slice(5)) || 16;
      return (
        <span key={k} style={{ fontSize: `${sizePx}px` }}>
          {parseInlineText(innerText)}
        </span>
      );
    }
    return <span key={k}>{parseInlineText(innerText)}</span>;
  };

  return {
    index: startIdx,
    length,
    render,
  };
}

/**
 * Parsing ricorsivo per la formattazione inline del testo.
 */
export function parseInlineText(text: string): (string | JSX.Element)[] {
  if (!text) return [];

  let earliestRegex: { match: RegExpMatchArray; pattern: PatternRule; index: number } | null = null;
  for (const rule of REGEX_INLINE_PATTERNS) {
    const m = text.match(rule.regex);
    if (m && m.index !== undefined) {
      if (earliestRegex === null || m.index < earliestRegex.index) {
        earliestRegex = { match: m, pattern: rule, index: m.index };
      }
    }
  }

  const bracketPattern = findBracketPattern(text);

  if (!earliestRegex && !bracketPattern) {
    return [text];
  }

  if (bracketPattern && (!earliestRegex || bracketPattern.index < earliestRegex.index)) {
    const before = text.slice(0, bracketPattern.index);
    const after = text.slice(bracketPattern.index + bracketPattern.length);

    const result: (string | JSX.Element)[] = [];
    if (before) result.push(before);
    result.push(bracketPattern.render(`tok_b_${bracketPattern.index}_${bracketPattern.length}`));
    if (after) result.push(...parseInlineText(after));
    return result;
  }

  if (earliestRegex) {
    const { match, pattern, index } = earliestRegex;
    const before = text.slice(0, index);
    const matchedFull = match[0];
    const after = text.slice(index + matchedFull.length);

    const result: (string | JSX.Element)[] = [];
    if (before) result.push(before);
    result.push(pattern.render(match, `tok_${index}_${matchedFull.length}`));
    if (after) result.push(...parseInlineText(after));

    return result;
  }

  return [text];
}

export interface QuadernoDocRendererProps {
  content: string;
  className?: string;
  style?: JSX.CSSProperties;
}

/**
 * Componente Documento Google Docs nativo per la lettura e l'anteprima formattata.
 */
export function QuadernoDocRenderer({ content, className = '', style }: QuadernoDocRendererProps) {
  if (!content || !content.trim()) {
    return (
      <div className={`doc-rendered doc-rendered-empty ${className}`.trim()} style={style}>
        <p className="doc-empty-note">Nessun contenuto nel documento.</p>
      </div>
    );
  }

  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? '';
    const trimmed = rawLine.trim();

    // 1. Linea vuota
    if (!trimmed) {
      index++;
      continue;
    }

    // 2. Separatore orizzontale (---, *** o ___)
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(<hr key={`hr_${index}`} className="doc-divider" />);
      index++;
      continue;
    }

    // 3. Intestazioni (# Titolo, ## Titolo, ### Titolo, #### Titolo)
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4_${index}`} className="doc-h4">
          {parseInlineText(trimmed.slice(5))}
        </h4>
      );
      index++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3_${index}`} className="doc-h3">
          {parseInlineText(trimmed.slice(4))}
        </h3>
      );
      index++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2_${index}`} className="doc-h2">
          {parseInlineText(trimmed.slice(3))}
        </h2>
      );
      index++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1_${index}`} className="doc-h1">
          {parseInlineText(trimmed.slice(2))}
        </h1>
      );
      index++;
      continue;
    }

    // 3b. Sottotitolo: [sub:testo]
    if (trimmed.startsWith('[sub:') && trimmed.endsWith(']')) {
      const subText = trimmed.slice(5, -1);
      elements.push(
        <p key={`sub_${index}`} className="doc-subtitle">
          {parseInlineText(subText)}
        </p>
      );
      index++;
      continue;
    }

    // 4. Immagine singola su riga intera: ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const altText = imgMatch[1]?.trim() || '';
      const srcUrl = imgMatch[2]?.trim() || '';
      elements.push(
        <figure key={`fig_${index}`} className="doc-figure">
          <img
            src={srcUrl}
            alt={altText || 'Immagine allegata'}
            className="doc-image"
          />
          {altText ? <figcaption className="doc-figcaption">{altText}</figcaption> : null}
        </figure>
      );
      index++;
      continue;
    }

    // 5. Citazione (> testo)
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('> ')) {
        quoteLines.push((lines[index] ?? '').trim().slice(2));
        index++;
      }
      elements.push(
        <blockquote key={`quote_${index}`} className="doc-blockquote">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className="doc-quote-p">
              {parseInlineText(ql)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 6. Elenco puntato (- item o * item)
    if (/^[-*]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test((lines[index] ?? '').trim())) {
        listItems.push((lines[index] ?? '').trim().replace(/^[-*]\s+/, ''));
        index++;
      }
      elements.push(
        <ul key={`ul_${index}`} className="doc-ul">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx} className="doc-li">
              {parseInlineText(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 7. Elenco numerato (1. item)
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test((lines[index] ?? '').trim())) {
        listItems.push((lines[index] ?? '').trim().replace(/^\d+\.\s+/, ''));
        index++;
      }
      elements.push(
        <ol key={`ol_${index}`} className="doc-ol">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx} className="doc-li">
              {parseInlineText(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 8. Paragrafo standard (raccoglie righe consecutive)
    const pLines: string[] = [];
    while (index < lines.length) {
      const currentRaw = lines[index] ?? '';
      const currentTrimmed = currentRaw.trim();
      if (
        !currentTrimmed ||
        currentTrimmed.startsWith('#') ||
        currentTrimmed.startsWith('> ') ||
        /^[-*]\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed) ||
        /^---+$/.test(currentTrimmed) ||
        /^\*\*\*+$/.test(currentTrimmed) ||
        /^!\[(.*?)\]\((.*?)\)$/.test(currentTrimmed)
      ) {
        break;
      }
      pLines.push(currentRaw);
      index++;
    }

    if (pLines.length > 0) {
      elements.push(
        <p key={`p_${index}`} className="doc-p">
          {pLines.map((pLine, pIdx) => (
            <Fragment key={pIdx}>
              {pIdx > 0 && <br />}
              {parseInlineText(pLine)}
            </Fragment>
          ))}
        </p>
      );
    }
  }

  return (
    <div className={`doc-rendered ${className}`.trim()} style={style}>
      {elements}
    </div>
  );
}
