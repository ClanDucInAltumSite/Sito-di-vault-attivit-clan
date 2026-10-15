/**
 * Normalizzazione testo: rimozione diacritici/accenti e conversione in minuscolo.
 * Esempio: "Perché È Bell'Affare" -> "perche e bell'affare"
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Calcolo della distanza di Levenshtein standard tra due stringhe.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const stride = n + 1;
  const dp = new Int32Array((m + 1) * stride);

  for (let i = 0; i <= m; i++) dp[i * stride] = i;
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i * stride + j] = dp[(i - 1) * stride + (j - 1)]!;
      } else {
        const del = dp[(i - 1) * stride + j]!;
        const ins = dp[i * stride + (j - 1)]!;
        const sub = dp[(i - 1) * stride + (j - 1)]!;
        dp[i * stride + j] = 1 + Math.min(del, ins, sub);
      }
    }
  }

  return dp[m * stride + n]!;
}

/**
 * Regola deterministica di tolleranza ai typo:
 * - Parola < 4 caratteri: Exact match (distanza = 0)
 * - Parola 4–7 caratteri: Distanza Levenshtein <= 1
 * - Parola >= 8 caratteri: Distanza Levenshtein <= 2
 */
export function maxAllowedDistance(tokenLength: number): number {
  if (tokenLength < 4) return 0;
  if (tokenLength <= 7) return 1;
  return 2;
}

/**
 * Tokenizza una stringa in parole alfanumeriche normalizzate.
 */
export function tokenize(text: string | null | undefined): string[] {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Verifica se un token di ricerca corrisponde a una specifica parola candidata
 * rispettando la soglia deterministica dei typo.
 */
export function wordMatchesToken(candidateWord: string, queryToken: string): boolean {
  if (!candidateWord || !queryToken) return false;
  const maxD = maxAllowedDistance(queryToken.length);

  // Corrispondenza esatta di sottostringa (es. "pal" in "palla")
  if (candidateWord.includes(queryToken)) {
    return true;
  }

  // Se la parola è troppo corta per tollerare typo e non è sottostringa
  if (maxD === 0) {
    return candidateWord === queryToken;
  }

  // Verifica distanza di Levenshtein se le lunghezze sono compatibili
  if (Math.abs(candidateWord.length - queryToken.length) <= maxD) {
    if (levenshtein(candidateWord, queryToken) <= maxD) {
      return true;
    }
  }

  return false;
}

/**
 * Verifica se una riga / elemento soddisfa tutti i termini della query di ricerca (AND)
 * cercati su uno o più campi testuali (multi-field: nome, regole/testo, materiali/note_gesti).
 */
export function matchesQuery(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return true;

  const allText = fields.filter(Boolean).join(' ');
  const candidateWords = tokenize(allText);
  if (candidateWords.length === 0) return false;

  // Ciascun termine della query deve trovare riscontro in almeno una parola del candidato
  return qTokens.every((q) =>
    candidateWords.some((candidateWord) => wordMatchesToken(candidateWord, q))
  );
}

export interface HighlightPart {
  text: string;
  isMatch: boolean;
}

/**
 * Suddivide il testo originale in blocchi per l'evidenziazione, preservando
 * intatta la punteggiatura, gli spazi e le maiuscole originali.
 */
export function getHighlightParts(
  originalText: string | null | undefined,
  query: string
): HighlightPart[] {
  if (!originalText) return [];
  const qTokens = tokenize(query);
  if (qTokens.length === 0) {
    return [{ text: originalText, isMatch: false }];
  }

  // Regex per catturare separatamente parole e separatori
  const regex = /([\p{L}\p{N}]+|[^\p{L}\p{N}]+)/gu;
  const parts: HighlightPart[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(originalText)) !== null) {
    const chunk = match[0];
    const isWord = /[\p{L}\p{N}]/u.test(chunk);
    if (!isWord) {
      parts.push({ text: chunk, isMatch: false });
    } else {
      const norm = normalizeText(chunk);
      const isMatch = qTokens.some((q) => wordMatchesToken(norm, q));
      parts.push({ text: chunk, isMatch });
    }
  }

  return parts;
}

export interface HighlightTextProps {
  text: string | null | undefined;
  query: string;
  className?: string;
}

/**
 * Componente Preact per l'evidenziazione sicura in giallo del testo trovato.
 * NON ricorre a parsing HTML insicuro. Ogni blocco è un nodo Virtual DOM Preact con escaping
 * automatico contro attacchi XSS.
 */
export function HighlightText({ text, query, className = '' }: HighlightTextProps) {
  if (!text) return null;
  const parts = getHighlightParts(text, query);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.isMatch ? (
          <mark key={index} className="search-highlight">
            {part.text}
          </mark>
        ) : (
          part.text
        )
      )}
    </span>
  );
}

/**
 * Controllo duplicato soft: verifica se un nome è quasi identico a uno esistente.
 */
export function findSimilarName(
  candidateName: string,
  existingNames: string[]
): string | null {
  const normCandidate = normalizeText(candidateName).trim();
  if (normCandidate.length < 3) return null;

  for (const existing of existingNames) {
    const normExisting = normalizeText(existing).trim();
    if (!normExisting) continue;

    // Identici (eccetto maiuscole o accenti)
    if (normCandidate === normExisting) {
      return existing;
    }

    // Quasi identici (distanza Levenshtein <= 2 per nomi di almeno 5 caratteri)
    if (normCandidate.length >= 4 && normExisting.length >= 4) {
      if (Math.abs(normCandidate.length - normExisting.length) <= 2) {
        if (levenshtein(normCandidate, normExisting) <= 2) {
          return existing;
        }
      }
    }
  }

  return null;
}
