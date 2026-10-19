/**
 * Configurazione frasi e pattern di rumore web / copia-incolla per il Canzoniere (Fase 10B)
 * Elenco modificabile di espressioni tipiche che compaiono copiando testi da siti web o PDF.
 */

export interface NoiseRule {
  pattern: RegExp;
  description: string;
}

export const NOISE_RULES: NoiseRule[] = [
  // Diritti e copyright
  {
    pattern: /^(?:tutti\s+i\s+diritti\s+riservati|all\s+rights\s+reserved|copyright|©|\(c\))\b.*$/i,
    description: 'Dicitura copyright / diritti riservati',
  },
  {
    pattern: /^testo\s+e\s+accordi\s+(?:di|per|su)\b.*$/i,
    description: 'Intestazione sito web (Testo e accordi di...)',
  },
  {
    pattern: /^accordi\s+per\s+chitarra\b.*$/i,
    description: 'Dicitura spartito chitarra',
  },

  // Condivisione, social e pulsanti web
  {
    pattern: /^(?:condividi|share|facebook|twitter|whatsapp|telegram|instagram)\b.*$/i,
    description: 'Pulsante o menu di condivisione social',
  },
  {
    pattern: /^(?:stampa|print|salva\s+in\s+pdf|scarica\s+pdf|download\s+pdf)\b.*$/i,
    description: 'Pulsante di stampa / download web',
  },
  {
    pattern: /^(?:trasponi|transpose|cambia\s+tonalit[aà]|tonalit[aà]\s*:\s*[+-]?\d+)\b.*$/i,
    description: 'Controlli di trasposizione web',
  },
  {
    pattern: /^(?:menu|home|cerca|search|canzoniere\s+online|archivio\s+canti)\b.*$/i,
    description: 'Voci di navigazione / menu web',
  },

  // Pubblicità e placeholder
  {
    pattern: /^(?:pubblicit[aà]|advertisement|banner|annuncio|continua\s+sotto|scorri\s+in\s+basso)\b.*$/i,
    description: 'Annuncio pubblicitario web',
  },

  // Numeri di pagina isolati (es. "1", "12", "- 4 -", "pag. 5", "pagina 7", "Pagina 1 di 4")
  {
    pattern: /^(?:pag\.?|pagina)?\s*-?\s*\d{1,3}(?:\s*(?:di|\/)\s*\d{1,3})?\s*-?\s*$/i,
    description: 'Numero di pagina isolato',
  },

  // URL web e domini isolati (es. https://..., www.canzonierionline.it/download)
  {
    pattern: /^(?:https?:\/\/|www\.)\S+$/i,
    description: 'Indirizzo web / link',
  },
];

/**
 * Verifica se una riga corrisponde a una regola di rumore web nota.
 */
export function matchNoiseLine(line: string): NoiseRule | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  for (const rule of NOISE_RULES) {
    if (rule.pattern.test(trimmed)) {
      return rule;
    }
  }
  return null;
}
