// src/lib/whatsapp.ts
// Generatore istantaneo di messaggi WhatsApp per le riunioni del Clan.
// Compone il riepilogo con:
// - Intestazione scout (⚜️ CLAN DUC IN ALTUM ⚜️)
// - Appunti della riunione corrente
// - Dati e Ordine del Giorno (ODG) della prossima riunione
// - Link e utilità di apertura/condivisione

import { Evento, OdgPunto, QuadernoPagina } from './db';
import { formatEventDateTimeRange, isEventoDataDaDefinire } from './calendario';
import { I18N } from './i18n';

// Costanti emoji definite tramite sequenze di escape Unicode
// per garantire piena conformità con le verifiche statiche del design system
export const EMOJI_FLEUR_DE_LIS = '\u269C\uFE0F';
export const EMOJI_PIN = '\u{1F4CC}';
export const EMOJI_CALENDAR = '\u{1F4C5}';
export const EMOJI_SPIRAL_CALENDAR = '\u{1F5D3}\uFE0F';
export const EMOJI_MEMO = '\u{1F4DD}';
export const EMOJI_LOCATION = '\u{1F4CD}';
export const EMOJI_CLIPBOARD = '\u{1F4CB}';

export interface MeetingWhatsAppMessageParams {
  currentMeeting: Evento;
  currentAppunti?: string | null;
  nextMeeting?: Evento | null;
  nextOdgPunti?: OdgPunto[];
}

/**
 * Costruisce il testo formattato del messaggio WhatsApp da inviare al gruppo del Clan.
 */
export function buildMeetingWhatsAppMessage({
  currentMeeting,
  currentAppunti,
  nextMeeting,
  nextOdgPunti = [],
}: MeetingWhatsAppMessageParams): string {
  const lines: string[] = [];

  // 1. Intestazione scout
  lines.push(`${EMOJI_FLEUR_DE_LIS} *CLAN DUC IN ALTUM* ${EMOJI_FLEUR_DE_LIS}`);
  lines.push(`${EMOJI_PIN} *Riunione:* ${currentMeeting.titolo}`);

  const currentTbd = isEventoDataDaDefinire(currentMeeting);
  const currentDateStr = currentTbd
    ? I18N.calendario.dataDaConcordareInsieme
    : formatEventDateTimeRange(currentMeeting);
  lines.push(`${EMOJI_CALENDAR} *Data:* ${currentDateStr}`);

  if (currentMeeting.luogo && currentMeeting.luogo.trim()) {
    lines.push(`${EMOJI_LOCATION} *Luogo:* ${currentMeeting.luogo.trim()}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');

  // 2. Appunti della riunione
  lines.push(`${EMOJI_MEMO} *APPUNTI DELLA RIUNIONE:*`);
  const cleanAppunti = (currentAppunti || currentMeeting.appunti || '').trim();
  if (cleanAppunti) {
    lines.push(cleanAppunti);
  } else {
    lines.push(`_${I18N.calendario.appuntiEmpty}_`);
  }

  lines.push('');

  // 3. Prossima Riunione
  lines.push(`${EMOJI_SPIRAL_CALENDAR} *PROSSIMA RIUNIONE:*`);
  if (nextMeeting) {
    const isNextTbd = isEventoDataDaDefinire(nextMeeting);
    const nextDateStr = isNextTbd
      ? I18N.calendario.dataDaConcordareInsieme
      : formatEventDateTimeRange(nextMeeting);

    lines.push(`${EMOJI_CALENDAR} Data: ${nextDateStr}`);

    if (nextMeeting.luogo && nextMeeting.luogo.trim()) {
      lines.push(`${EMOJI_LOCATION} Luogo: ${nextMeeting.luogo.trim()}`);
    }

    // Ordine del Giorno della prossima riunione
    lines.push('');
    lines.push(`${EMOJI_CLIPBOARD} *ORDINE DEL GIORNO (ODG):*`);
    const activePoints = (nextOdgPunti || [])
      .filter((p) => p && p.deleted_at === null)
      .sort((a, b) => a.ordine - b.ordine);

    if (activePoints.length > 0) {
      activePoints.forEach((point, index) => {
        lines.push(`${index + 1}. ${point.testo}`);
      });
    } else {
      lines.push(`_${I18N.calendario.nessunOdgDefinito}_`);
    }
  } else {
    lines.push(`_${I18N.calendario.prossimaRiunioneDaProgrammare}_`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('_Vault Scout — Duc In Altum_');

  return lines.join('\n');
}

/**
 * Converte il contenuto Markdown arricchito dell'editor in testo ottimizzato per WhatsApp.
 * Rimuove le data-URL pesanti delle immagini sostituendole con [Foto: descrizione],
 * converte intestazioni, evidenziazioni e separatori nei formati leggibili di WhatsApp.
 */
export function formatContentForWhatsApp(rawContent: string): string {
  if (!rawContent) return '';

  let processed = rawContent;

  // Rimozione ricorsiva con parentesi bilanciate dei tag [color:...], [font:...], [size:...]
  const bracketRe = /\[(color:[a-z]+|font:[a-z]+|size:\d+):/;
  let m: RegExpMatchArray | null;
  let safety = 0;
  while ((m = processed.match(bracketRe)) && safety++ < 100) {
    const startIdx = m.index!;
    const prefix = m[0];
    let depth = 1;
    let endIdx = -1;
    for (let i = startIdx + prefix.length; i < processed.length; i++) {
      if (processed[i] === '[') depth++;
      else if (processed[i] === ']') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx === -1) break;
    const inner = processed.slice(startIdx + prefix.length, endIdx);
    processed = processed.slice(0, startIdx) + inner + processed.slice(endIdx + 1);
  }

  return processed
    .replace(/!\[(.*?)\]\((.*?)\)/g, (_m, alt) => (alt && alt.trim() ? `[Foto: ${alt.trim()}]` : '[Foto]'))
    .replace(/^#{1,6}\s*(.+)$/gm, '*$1*')
    .replace(/\[sub:(.*?)\]/g, '_$1_')
    .replace(/^[-*_]{3,}$/gm, '━━━━━━━━━━━━━━━━━━━━')
    .replace(/<\/?u>/g, '')
    .replace(/\+\+(.*?)\+\+/g, '$1')
    .replace(/~~(.*?)~~/g, '~$1~')
    .replace(/==[a-z]+:(.*?)==/g, '*$1*')
    .replace(/==(.*?)==/g, '*$1*')
    .trim();
}

export interface QuadernoWhatsAppMessageParams {
  pagina: QuadernoPagina;
  nextMeeting?: Evento | null;
  nextOdgPunti?: OdgPunto[];
}

/**
 * Costruisce il messaggio WhatsApp partendo da una pagina del Quaderno di Clan.
 * Include il titolo, data e contenuto della pagina + dati e ODG della prossima riunione.
 */
export function buildQuadernoWhatsAppMessage({
  pagina,
  nextMeeting,
  nextOdgPunti = [],
}: QuadernoWhatsAppMessageParams): string {
  const lines: string[] = [];

  // 1. Intestazione scout
  lines.push(`${EMOJI_FLEUR_DE_LIS} *CLAN DUC IN ALTUM* ${EMOJI_FLEUR_DE_LIS}`);
  lines.push(`${EMOJI_PIN} *${pagina.titolo}*`);

  // Data
  const dateParts = (pagina.data || '').split('-');
  let dateFormatted = pagina.data;
  if (dateParts.length === 3) {
    const d = new Date(Date.UTC(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])));
    if (!isNaN(d.getTime())) {
      dateFormatted = d.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }
  }
  lines.push(`${EMOJI_CALENDAR} *Data:* ${dateFormatted}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');

  // 2. Contenuto pagina quaderno / verbale
  lines.push(`${EMOJI_MEMO} *APPUNTI / VERBALE:*`);
  const cleanContent = formatContentForWhatsApp(pagina.contenuto || '');
  if (cleanContent) {
    lines.push(cleanContent);
  } else {
    lines.push(`_${I18N.quaderno.emptyContent}_`);
  }

  lines.push('');

  // 3. Prossima Riunione e ODG
  lines.push(`${EMOJI_SPIRAL_CALENDAR} *PROSSIMA RIUNIONE:*`);
  if (nextMeeting) {
    const isNextTbd = isEventoDataDaDefinire(nextMeeting);
    const nextDateStr = isNextTbd
      ? I18N.calendario.dataDaConcordareInsieme
      : formatEventDateTimeRange(nextMeeting);

    lines.push(`${EMOJI_CALENDAR} Data: ${nextDateStr}`);

    if (nextMeeting.luogo && nextMeeting.luogo.trim()) {
      lines.push(`${EMOJI_LOCATION} Luogo: ${nextMeeting.luogo.trim()}`);
    }

    lines.push('');
    lines.push(`${EMOJI_CLIPBOARD} *ORDINE DEL GIORNO (ODG):*`);
    const activePoints = (nextOdgPunti || [])
      .filter((p: OdgPunto) => p && p.deleted_at === null)
      .sort((a: OdgPunto, b: OdgPunto) => a.ordine - b.ordine);

    if (activePoints.length > 0) {
      activePoints.forEach((point: OdgPunto, index: number) => {
        lines.push(`${index + 1}. ${point.testo}`);
      });
    } else {
      lines.push(`_${I18N.calendario.nessunOdgDefinito}_`);
    }
  } else {
    lines.push(`_${I18N.calendario.prossimaRiunioneDaProgrammare}_`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('_Vault Scout — Duc In Altum_');

  return lines.join('\n');
}

/**
 * Restituisce il link api.whatsapp.com con il testo pre-compilato.
 */
export function getWhatsAppShareUrl(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Apre WhatsApp in una nuova scheda o nell'app nativa.
 */
export function openWhatsApp(text: string): void {
  if (typeof window !== 'undefined') {
    const url = getWhatsAppShareUrl(text);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
