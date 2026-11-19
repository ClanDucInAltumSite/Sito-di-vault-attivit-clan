// src/features/quaderno/quaderno_dom.ts
// Utility sicure per conversione bi-direzionale tra Markdown e DOM nativo per l'Editor WYSIWYG Quaderno
// Conforme al 100% con le verifiche di sicurezza del design system e CSP: manipolazione DOM pulita

interface InlineRule {
  regex: RegExp;
  createNode: (match: RegExpMatchArray) => HTMLElement;
  getInnerText: (match: RegExpMatchArray) => string;
}

const REGEX_INLINE_RULES: InlineRule[] = [
  // 1. Immagine inline: ![alt](url)
  {
    regex: /!\[(.*?)\]\((.*?)\)/,
    createNode: (m) => {
      const img = document.createElement('img');
      img.src = m[2] || '';
      img.alt = m[1] ? m[1].trim() : 'Immagine allegata';
      img.className = 'doc-inline-img';
      return img;
    },
    getInnerText: () => '',
  },
  // 2. Evidenziatore con colore: ==green:testo==
  {
    regex: /==([a-z]+):(.*?)==/,
    createNode: (m) => {
      const color = m[1] || 'yellow';
      const mark = document.createElement('mark');
      mark.className = `doc-highlight doc-highlight-${color}`;
      mark.dataset.highlight = color;
      return mark;
    },
    getInnerText: (m) => m[2] || '',
  },
  // 3. Evidenziatore semplice: ==testo==
  {
    regex: /==(.*?)==/,
    createNode: () => {
      const mark = document.createElement('mark');
      mark.className = 'doc-highlight doc-highlight-yellow';
      mark.dataset.highlight = 'yellow';
      return mark;
    },
    getInnerText: (m) => m[1] || '',
  },
  // 4. Grassetto: **testo**
  {
    regex: /\*\*(.*?)\*\*/,
    createNode: () => document.createElement('strong'),
    getInnerText: (m) => m[1] || '',
  },
  // 5. Corsivo: *testo*
  {
    regex: /\*([^*]+)\*/,
    createNode: () => document.createElement('em'),
    getInnerText: (m) => m[1] || '',
  },
  // 6. Sottolineato: <u>testo</u>
  {
    regex: /<u>(.*?)<\/u>/,
    createNode: () => document.createElement('u'),
    getInnerText: (m) => m[1] || '',
  },
  // 7. Sottolineato alternativo: ++testo++
  {
    regex: /\+\+(.*?)\+\+/,
    createNode: () => document.createElement('u'),
    getInnerText: (m) => m[1] || '',
  },
  // 8. Barrato: ~~testo~~
  {
    regex: /~~(.*?)~~/,
    createNode: () => document.createElement('s'),
    getInnerText: (m) => m[1] || '',
  },
];

interface MatchedBracketTag {
  index: number;
  length: number;
  createNode: () => HTMLElement;
  innerText: string;
}

/**
 * Ricerca di tag con parentesi quadre ([color:...], [font:...], [size:...])
 * con conteggio della profondità delle parentesi quadre per supportare l'annidamento.
 */
function findBracketTag(text: string): MatchedBracketTag | null {
  const startRegex = /\[(color:[a-z]+|font:[a-z]+|size:\d+):/;
  const m = text.match(startRegex);
  if (!m || m.index === undefined) return null;

  const startIdx = m.index;
  const prefix = m[0];
  const tagSpec = m[1] ?? '';

  let depth = 1;
  let endIdx = -1;
  for (let i = startIdx + prefix.length; i < text.length; i++) {
    if (text[i] === '[') {
      depth++;
    } else if (text[i] === ']') {
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

  const createNode = (): HTMLElement => {
    if (tagSpec.startsWith('color:')) {
      const color = tagSpec.slice(6) || 'default';
      const span = document.createElement('span');
      span.className = `doc-color-${color}`;
      span.dataset.color = color;
      if (color === 'purple') span.style.color = 'var(--color-quaderno)';
      else if (color === 'blue') span.style.color = 'var(--color-canti)';
      else if (color === 'cyan') span.style.color = 'var(--color-doc-cyan)';
      else if (color === 'green') span.style.color = 'var(--color-calendario)';
      else if (color === 'lime') span.style.color = 'var(--color-doc-lime)';
      else if (color === 'amber') span.style.color = 'var(--color-giochi)';
      else if (color === 'red') span.style.color = 'var(--color-bans)';
      else if (color === 'pink') span.style.color = 'var(--color-doc-pink)';
      else if (color === 'brown') span.style.color = 'var(--color-doc-brown)';
      else if (color === 'navy') span.style.color = 'var(--color-doc-navy)';
      else if (color === 'gray') span.style.color = 'var(--color-doc-gray)';
      return span;
    }
    if (tagSpec.startsWith('font:')) {
      const font = tagSpec.slice(5) || 'sans';
      const span = document.createElement('span');
      span.className = `doc-font-${font}`;
      span.dataset.font = font;
      if (font === 'serif') span.style.fontFamily = 'Georgia, Cambria, "Times New Roman", serif';
      else if (font === 'mono') span.style.fontFamily = 'var(--font-mono)';
      else span.style.fontFamily = 'var(--font-sans)';
      return span;
    }
    if (tagSpec.startsWith('size:')) {
      const sizePx = Number(tagSpec.slice(5)) || 16;
      const span = document.createElement('span');
      span.className = 'doc-size-span';
      span.dataset.size = String(sizePx);
      span.style.fontSize = `${sizePx}px`;
      return span;
    }
    return document.createElement('span');
  };

  return {
    index: startIdx,
    length,
    createNode,
    innerText,
  };
}

/**
 * Parsing ricorsivo di una stringa inline in nodi DOM reali.
 * Rendering nativo ed è completamente sicuro da injection.
 */
export function parseInlineToDomNodes(text: string): Node[] {
  if (!text) return [];

  // 1. Cerca la regola regex più a sinistra
  let earliestRegex: { match: RegExpMatchArray; rule: InlineRule; index: number } | null = null;
  for (const rule of REGEX_INLINE_RULES) {
    const m = text.match(rule.regex);
    if (m && m.index !== undefined) {
      if (earliestRegex === null || m.index < earliestRegex.index) {
        earliestRegex = { match: m, rule, index: m.index };
      }
    }
  }

  // 2. Cerca l'eventuale tag bilanciato tra parentesi quadre ([color:...], [font:...], [size:...])
  const bracketTag = findBracketTag(text);

  // Nessuna corrispondenza trovata
  if (!earliestRegex && !bracketTag) {
    return [document.createTextNode(text)];
  }

  // Se il tag a parentesi bilanciate compare prima della regola regex
  if (bracketTag && (!earliestRegex || bracketTag.index < earliestRegex.index)) {
    const before = text.slice(0, bracketTag.index);
    const after = text.slice(bracketTag.index + bracketTag.length);

    const nodes: Node[] = [];
    if (before) {
      nodes.push(document.createTextNode(before));
    }

    const element = bracketTag.createNode();
    if (bracketTag.innerText) {
      const innerNodes = parseInlineToDomNodes(bracketTag.innerText);
      for (const inNode of innerNodes) {
        element.appendChild(inNode);
      }
    }
    nodes.push(element);

    if (after) {
      nodes.push(...parseInlineToDomNodes(after));
    }

    return nodes;
  }

  // Altrimenti consuma la regola regex più a sinistra
  if (earliestRegex) {
    const { match, rule, index } = earliestRegex;
    const before = text.slice(0, index);
    const matchedFull = match[0];
    const after = text.slice(index + matchedFull.length);

    const nodes: Node[] = [];
    if (before) {
      nodes.push(document.createTextNode(before));
    }

    const element = rule.createNode(match);
    const innerText = rule.getInnerText(match);
    if (innerText) {
      const innerNodes = parseInlineToDomNodes(innerText);
      for (const inNode of innerNodes) {
        element.appendChild(inNode);
      }
    }
    nodes.push(element);

    if (after) {
      nodes.push(...parseInlineToDomNodes(after));
    }

    return nodes;
  }

  return [document.createTextNode(text)];
}

/**
 * Popola un container DOM con elementi nativi a partire da Markdown.
 * Conforme a WCAG e CSP.
 */
export function renderMarkdownToContainer(markdown: string, container: HTMLElement): void {
  // Svuota in modo pulito e sicuro
  container.replaceChildren();

  if (!markdown || !markdown.trim()) {
    const p = document.createElement('p');
    p.className = 'doc-p';
    p.appendChild(document.createElement('br'));
    container.appendChild(p);
    return;
  }

  const lines = markdown.split('\n');
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? '';
    const trimmed = rawLine.trim();

    // 1. Linee vuote: in Markdown standard 1 riga vuota tra blocchi è solo la spaziatura sintattica (\n\n).
    // Solo righe vuote eccedenti (> 1) o all'inizio rappresentano paragrafi vuoti intenzionali.
    if (!trimmed) {
      let emptyCount = 0;
      while (index < lines.length && !(lines[index] ?? '').trim()) {
        emptyCount++;
        index++;
      }
      const isStart = container.childNodes.length === 0;
      const extraEmpty = isStart ? emptyCount : emptyCount - 1;
      for (let i = 0; i < extraEmpty; i++) {
        const p = document.createElement('p');
        p.className = 'doc-p';
        p.appendChild(document.createElement('br'));
        container.appendChild(p);
      }
      continue;
    }

    // 2. Separatore orizzontale
    if (/^[-*_]{3,}$/.test(trimmed)) {
      const hr = document.createElement('hr');
      hr.className = 'doc-divider';
      container.appendChild(hr);
      index++;
      continue;
    }

    // 3. Intestazioni
    if (trimmed.startsWith('#### ')) {
      const h4 = document.createElement('h4');
      h4.className = 'doc-h4';
      const nodes = parseInlineToDomNodes(trimmed.slice(5));
      for (const n of nodes) h4.appendChild(n);
      container.appendChild(h4);
      index++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      const h3 = document.createElement('h3');
      h3.className = 'doc-h3';
      const nodes = parseInlineToDomNodes(trimmed.slice(4));
      for (const n of nodes) h3.appendChild(n);
      container.appendChild(h3);
      index++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      const h2 = document.createElement('h2');
      h2.className = 'doc-h2';
      const nodes = parseInlineToDomNodes(trimmed.slice(3));
      for (const n of nodes) h2.appendChild(n);
      container.appendChild(h2);
      index++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      const h1 = document.createElement('h1');
      h1.className = 'doc-h1';
      const nodes = parseInlineToDomNodes(trimmed.slice(2));
      for (const n of nodes) h1.appendChild(n);
      container.appendChild(h1);
      index++;
      continue;
    }

    // 3b. Sottotitolo: [sub:testo]
    if (trimmed.startsWith('[sub:') && trimmed.endsWith(']')) {
      const subText = trimmed.slice(5, -1);
      const p = document.createElement('p');
      p.className = 'doc-subtitle';
      p.dataset.role = 'subtitle';
      const nodes = parseInlineToDomNodes(subText);
      for (const n of nodes) p.appendChild(n);
      container.appendChild(p);
      index++;
      continue;
    }

    // 4. Immagine riga intera: ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const altText = imgMatch[1]?.trim() || '';
      const srcUrl = imgMatch[2]?.trim() || '';
      const figure = document.createElement('figure');
      figure.className = 'doc-figure';
      const img = document.createElement('img');
      img.src = srcUrl;
      img.alt = altText || 'Immagine allegata';
      img.className = 'doc-image';
      figure.appendChild(img);
      if (altText) {
        const cap = document.createElement('figcaption');
        cap.className = 'doc-figcaption';
        cap.textContent = altText;
        figure.appendChild(cap);
      }
      container.appendChild(figure);
      index++;
      continue;
    }

    // 5. Citazione
    if (trimmed.startsWith('> ')) {
      const blockquote = document.createElement('blockquote');
      blockquote.className = 'doc-blockquote';
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('> ')) {
        const qLine = (lines[index] ?? '').trim().slice(2);
        const p = document.createElement('p');
        p.className = 'doc-quote-p';
        const nodes = parseInlineToDomNodes(qLine);
        for (const n of nodes) p.appendChild(n);
        blockquote.appendChild(p);
        index++;
      }
      container.appendChild(blockquote);
      continue;
    }

    // 6. Elenco puntato
    if (/^[-*]\s+/.test(trimmed)) {
      const ul = document.createElement('ul');
      ul.className = 'doc-ul';
      while (index < lines.length && /^[-*]\s+/.test((lines[index] ?? '').trim())) {
        const itemText = (lines[index] ?? '').trim().replace(/^[-*]\s+/, '');
        const li = document.createElement('li');
        li.className = 'doc-li';
        const nodes = parseInlineToDomNodes(itemText);
        for (const n of nodes) li.appendChild(n);
        ul.appendChild(li);
        index++;
      }
      container.appendChild(ul);
      continue;
    }

    // 7. Elenco numerato
    if (/^\d+\.\s+/.test(trimmed)) {
      const ol = document.createElement('ol');
      ol.className = 'doc-ol';
      while (index < lines.length && /^\d+\.\s+/.test((lines[index] ?? '').trim())) {
        const itemText = (lines[index] ?? '').trim().replace(/^\d+\.\s+/, '');
        const li = document.createElement('li');
        li.className = 'doc-li';
        const nodes = parseInlineToDomNodes(itemText);
        for (const n of nodes) li.appendChild(n);
        ol.appendChild(li);
        index++;
      }
      container.appendChild(ol);
      continue;
    }

    // 8. Paragrafo standard
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
        /^[-*_]{3,}$/.test(currentTrimmed) ||
        /^!\[(.*?)\]\((.*?)\)$/.test(currentTrimmed)
      ) {
        break;
      }
      pLines.push(currentRaw);
      index++;
    }

    if (pLines.length > 0) {
      const p = document.createElement('p');
      p.className = 'doc-p';
      pLines.forEach((pLine, pIdx) => {
        if (pIdx > 0) {
          p.appendChild(document.createElement('br'));
        }
        const nodes = parseInlineToDomNodes(pLine);
        for (const n of nodes) p.appendChild(n);
      });
      container.appendChild(p);
    }
  }

  if (container.childNodes.length === 0) {
    const p = document.createElement('p');
    p.className = 'doc-p';
    p.appendChild(document.createElement('br'));
    container.appendChild(p);
  }
}

/**
 * Serializza ricorsivamente nodi inline in formato Markdown arricchito.
 */
function serializeInlineNodes(node: Node, options?: { ignoreLists?: boolean }): string {
  let result = '';

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      // Rimuove gli spazi a larghezza zero inseriti per guidare il cursore
      const cleanText = (child.textContent || '').replace(/\u200B/g, '');
      result += cleanText;
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (options?.ignoreLists && (tag === 'UL' || tag === 'OL')) {
      continue;
    }

    if (tag === 'BR') {
      result += '\n';
      continue;
    }

    if (tag === 'IMG') {
      const img = el as HTMLImageElement;
      const alt = img.alt || img.getAttribute('alt') || 'Immagine allegata';
      result += `![${alt}](${img.src})`;
      continue;
    }

    const inner = serializeInlineNodes(el, options);
    if (!inner) continue;

    let formatted = inner;

    // 1. Dimensione testo
    if (el.dataset.size) {
      formatted = `[size:${el.dataset.size}:${formatted}]`;
    } else if (el.style.fontSize) {
      const pxMatch = el.style.fontSize.match(/(\d+)px/);
      if (pxMatch && pxMatch[1]) {
        formatted = `[size:${pxMatch[1]}:${formatted}]`;
      }
    }

    // 2. Carattere tipografico / Font family
    if (el.dataset.font) {
      if (el.dataset.font !== 'sans') {
        formatted = `[font:${el.dataset.font}:${formatted}]`;
      }
    } else if (el.style.fontFamily) {
      const ff = el.style.fontFamily.toLowerCase();
      const fam = ff.includes('serif') ? 'serif' : ff.includes('mono') ? 'mono' : 'sans';
      if (fam !== 'sans') {
        formatted = `[font:${fam}:${formatted}]`;
      }
    }

    // 3. Colore testo
    if (el.dataset.color) {
      if (el.dataset.color !== 'default') {
        formatted = `[color:${el.dataset.color}:${formatted}]`;
      }
    } else if (el.className && el.className.includes('doc-color-')) {
      const match = el.className.match(/doc-color-([a-z]+)/);
      if (match && match[1] && match[1] !== 'default') {
        formatted = `[color:${match[1]}:${formatted}]`;
      }
    } else if (el.style.color && el.style.color !== 'inherit') {
      const c = el.style.color;
      let colName = 'default';
      if (c.includes('quaderno')) colName = 'purple';
      else if (c.includes('canti')) colName = 'blue';
      else if (c.includes('doc-cyan')) colName = 'cyan';
      else if (c.includes('calendario')) colName = 'green';
      else if (c.includes('doc-lime')) colName = 'lime';
      else if (c.includes('giochi')) colName = 'amber';
      else if (c.includes('bans')) colName = 'red';
      else if (c.includes('doc-pink')) colName = 'pink';
      else if (c.includes('doc-brown')) colName = 'brown';
      else if (c.includes('doc-navy')) colName = 'navy';
      else if (c.includes('doc-gray')) colName = 'gray';
      if (colName !== 'default') formatted = `[color:${colName}:${formatted}]`;
    }

    // 4. Evidenziatore
    if (tag === 'MARK' || el.dataset.highlight) {
      let hl = el.dataset.highlight || 'yellow';
      if (el.classList.contains('doc-highlight-green')) hl = 'green';
      else if (el.classList.contains('doc-highlight-blue')) hl = 'blue';
      else if (el.classList.contains('doc-highlight-coral')) hl = 'coral';
      else if (el.classList.contains('doc-highlight-purple')) hl = 'purple';
      else if (el.classList.contains('doc-highlight-amber')) hl = 'amber';
      else if (el.classList.contains('doc-highlight-cyan')) hl = 'cyan';
      else if (el.classList.contains('doc-highlight-gray')) hl = 'gray';
      formatted = `==${hl}:${formatted}==`;
    }

    // 5. Barrato
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || el.style.textDecoration.includes('line-through')) {
      formatted = `~~${formatted}~~`;
    }

    // 6. Sottolineato
    if (tag === 'U' || el.style.textDecoration.includes('underline')) {
      formatted = `<u>${formatted}</u>`;
    }

    // 7. Corsivo
    if (tag === 'EM' || tag === 'I' || el.style.fontStyle === 'italic') {
      formatted = `*${formatted}*`;
    }

    // 8. Grassetto
    if (tag === 'STRONG' || tag === 'B' || el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight, 10) >= 700) {
      formatted = `**${formatted}**`;
    }

    result += formatted;
  }

  return result;
}

/**
 * Serializza un elemento elenco (UL o OL) preservando ciascun elemento,
 * supportando ritorni a capo interni e gestendo eventuali elenchi annidati.
 */
function serializeListElement(
  listEl: HTMLElement,
  listType: 'ul' | 'ol',
  indentLevel = 0
): string[] {
  const resultLines: string[] = [];
  const indent = '  '.repeat(indentLevel);
  let itemCounter = 1;

  for (const child of Array.from(listEl.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (tag === 'LI') {
      // 1. Estrai il testo inline del <li> ignorando eventuali elenchi annidati
      const rawText = serializeInlineNodes(el, { ignoreLists: true }).trim();
      const lines = rawText ? rawText.split('\n').map((l) => l.trim()).filter(Boolean) : [];

      if (lines.length > 0) {
        for (const line of lines) {
          const prefix = listType === 'ul' ? `${indent}- ` : `${indent}${itemCounter}. `;
          resultLines.push(`${prefix}${line}`);
          if (listType === 'ol') itemCounter++;
        }
      }

      // 2. Controlla se il <li> contiene elenchi annidati
      const subLists = Array.from(el.children).filter((c) => {
        const cTag = c.tagName.toUpperCase();
        return cTag === 'UL' || cTag === 'OL';
      }) as HTMLElement[];

      for (const subList of subLists) {
        const subType = subList.tagName.toUpperCase() === 'OL' ? 'ol' : 'ul';
        const subLines = serializeListElement(subList, subType, indentLevel + 1);
        resultLines.push(...subLines);
      }
    } else if (tag === 'UL' || tag === 'OL') {
      // Elenco direttamente dentro l'elenco (anomalia DOM a volte generata da incolla o execCommand)
      const subType = tag === 'OL' ? 'ol' : 'ul';
      const subLines = serializeListElement(el, subType, indentLevel + 1);
      resultLines.push(...subLines);
    }
  }

  return resultLines;
}

/**
 * Converte il contenuto di un container DOM (contenteditable) in Markdown pulito e strutturato.
 */
export function domToMarkdown(container: HTMLElement): string {
  const blocks: string[] = [];
  const children = Array.from(container.childNodes);

  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\u200B/g, '').trim();
      if (text) blocks.push(text);
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();

    // Blocchi foglia standard che gestiscono direttamente il proprio contenuto
    const isLeafBlock =
      ['H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'FIGURE', 'IMG', 'HR'].includes(tag) ||
      el.classList.contains('doc-subtitle') ||
      el.dataset.role === 'subtitle';

    // Se un elemento contenitore (DIV, P, SECTION, SPAN ecc.) racchiude blocchi annidati,
    // elabora ricorsivamente per estrarre tutti i blocchi senza appiattirli in una singola riga inline.
    if (!isLeafBlock && el.querySelector('p, h1, h2, h3, h4, ul, ol, li, blockquote, figure, hr')) {
      let innerBlocks = domToMarkdown(el);
      if (innerBlocks) {
        // Se il contenitore esterno (es. span o div) aveva un colore o formattazione,
        // propagalo a ciascuna riga o blocco interno per evitare che diventi bianco
        const containerColor = el.dataset.color || el.className.match(/doc-color-([a-z]+)/)?.[1];
        if (containerColor && containerColor !== 'default') {
          const lines = innerBlocks.split('\n');
          const colored = lines.map((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('![')) return line;
            if (line.includes('[color:')) return line; // Già colorato internamente
            // Intestazione
            if (/^#{1,4}\s+/.test(line)) {
              return line.replace(/^(#{1,4}\s+)(.*)$/, `$1[color:${containerColor}:$2]`);
            }
            // Elenco puntato
            if (/^(\s*[-*]\s+)(.*)$/.test(line)) {
              return line.replace(/^(\s*[-*]\s+)(.*)$/, `$1[color:${containerColor}:$2]`);
            }
            // Elenco numerato
            if (/^(\s*\d+\.\s+)(.*)$/.test(line)) {
              return line.replace(/^(\s*\d+\.\s+)(.*)$/, `$1[color:${containerColor}:$2]`);
            }
            return `[color:${containerColor}:${line}]`;
          });
          innerBlocks = colored.join('\n');
        }
        blocks.push(innerBlocks);
      }
      continue;
    }

    if (tag === 'H1') {
      const text = serializeInlineNodes(el).trim();
      if (text) blocks.push(`# ${text}`);
    } else if (tag === 'H2') {
      const text = serializeInlineNodes(el).trim();
      if (text) blocks.push(`## ${text}`);
    } else if (tag === 'H3') {
      const text = serializeInlineNodes(el).trim();
      if (text) blocks.push(`### ${text}`);
    } else if (tag === 'H4') {
      const text = serializeInlineNodes(el).trim();
      if (text) blocks.push(`#### ${text}`);
    } else if (el.classList.contains('doc-subtitle') || el.dataset.role === 'subtitle') {
      const text = serializeInlineNodes(el).trim();
      if (text) blocks.push(`[sub:${text}]`);
    } else if (tag === 'HR') {
      blocks.push('---');
    } else if (tag === 'BLOCKQUOTE') {
      const pElements = Array.from(el.querySelectorAll('p'));
      if (pElements.length > 0) {
        const quoteLines = pElements.map((p) => `> ${serializeInlineNodes(p).trim()}`);
        blocks.push(quoteLines.join('\n'));
      } else {
        const text = serializeInlineNodes(el).trim();
        if (text) blocks.push(`> ${text}`);
      }
    } else if (tag === 'UL') {
      const listLines = serializeListElement(el, 'ul');
      if (listLines.length > 0) {
        blocks.push(listLines.join('\n'));
      }
    } else if (tag === 'OL') {
      const listLines = serializeListElement(el, 'ol');
      if (listLines.length > 0) {
        blocks.push(listLines.join('\n'));
      }
    } else if (tag === 'LI') {
      // Elemento di elenco orfano al livello radice del documento
      const rawText = serializeInlineNodes(el, { ignoreLists: true }).trim();
      const lines = rawText ? rawText.split('\n').map((l) => l.trim()).filter(Boolean) : [];
      if (lines.length > 0) {
        blocks.push(lines.map((l) => `- ${l}`).join('\n'));
      }
    } else if (tag === 'FIGURE') {
      const img = el.querySelector('img');
      if (img) {
        const alt = img.alt || img.getAttribute('alt') || 'Immagine allegata';
        blocks.push(`![${alt}](${img.src})`);
      }
    } else if (tag === 'IMG') {
      const img = el as HTMLImageElement;
      const alt = img.alt || img.getAttribute('alt') || 'Immagine allegata';
      blocks.push(`![${alt}](${img.src})`);
    } else if (tag === 'P' || tag === 'DIV') {
      // Verifica se contiene solo un'immagine
      const img = el.querySelector('img');
      if (img && el.textContent?.trim() === '') {
        const alt = img.alt || img.getAttribute('alt') || 'Immagine allegata';
        blocks.push(`![${alt}](${img.src})`);
      } else {
        const text = serializeInlineNodes(el).trim();
        if (text) {
          blocks.push(text);
        } else {
          // Paragrafo vuoto intenzionale nel documento
          blocks.push('');
        }
      }
    } else {
      const text = serializeInlineNodes(el).trim();
      if (text) blocks.push(text);
    }
  }

  return joinMarkdownBlocks(blocks);
}

/**
 * Unisce i blocchi Markdown preservando con precisione le righe vuote intenzionali.
 */
export function joinMarkdownBlocks(blocks: string[]): string {
  const clean = [...blocks];
  while (clean.length > 0 && clean[0] === '') {
    clean.shift();
  }
  while (clean.length > 0 && clean[clean.length - 1] === '') {
    clean.pop();
  }
  if (clean.length === 0) return '';

  let result = '';
  for (let i = 0; i < clean.length; i++) {
    const b = clean[i] ?? '';
    if (i === 0) {
      result = b;
    } else if (b === '') {
      result += '\n';
    } else {
      result += '\n\n' + b;
    }
  }
  return result;
}

/**
 * Pulisce il Markdown grezzo del Quaderno da ogni tag o sintassi interna,
 * restituendo testo continuo e pulito per l'anteprima nelle card della lista.
 */
export function stripQuadernoSnippet(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // 1. Rimuovi ricorsivamente con parentesi bilanciate i tag [color:...], [font:...], [size:...], ecc.
  const bracketRe = /\[([a-z]+:[^:]*):/;
  let m: RegExpMatchArray | null;
  let safety = 0;
  while ((m = text.match(bracketRe)) && safety++ < 100) {
    const startIdx = m.index!;
    const prefix = m[0];
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
    if (endIdx === -1) {
      text = text.slice(0, startIdx) + text.slice(startIdx + prefix.length);
      continue;
    }
    const inner = text.slice(startIdx + prefix.length, endIdx);
    text = text.slice(0, startIdx) + inner + text.slice(endIdx + 1);
  }

  // 2. Rimuovi immagini markdown: ![alt](url) -> [Foto: alt] o [Foto]
  text = text.replace(/!\[(.*?)\]\(.*?\)/g, (_match, alt) => {
    const trimmed = (alt || '').trim();
    return trimmed ? `[Foto: ${trimmed}]` : '[Foto]';
  });

  // 3. Rimuovi intestazioni markdown: # Titolo -> Titolo
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 3b. Rimuovi sottotitoli: [sub:testo] -> testo
  text = text.replace(/\[sub:(.*?)\]/g, '$1');

  // 4. Rimuovi separatori orizzontali
  text = text.replace(/^[-*_]{3,}\s*$/gm, ' ');

  // 5. Rimuovi elenchi puntati e numerati
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // 6. Rimuovi citazioni
  text = text.replace(/^>\s*/gm, '');

  // 7. Rimuovi formattazioni inline: evidenziatori, grassetto, corsivo, sottolineato, barrato
  text = text.replace(/==[a-z]+:(.*?)==/g, '$1');
  text = text.replace(/==(.*?)==/g, '$1');
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/~~(.*?)~~/g, '$1');
  text = text.replace(/<\/?u>/g, '');
  text = text.replace(/\+\+(.*?)\+\+/g, '$1');

  // In caso rimangano asterischi residui di formattazione non chiusa
  text = text.replace(/^\*+|\*+$/g, '');

  // 8. Normalizza spazi bianchi e a capo in spazi singoli
  text = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  return text;
}
