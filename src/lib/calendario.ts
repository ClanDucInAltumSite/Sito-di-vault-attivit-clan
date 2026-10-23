// src/lib/calendario.ts
// Modulo logico e utilità per il Calendario Clan e Ordine del Giorno (ODG)
// Fuso orario fisso Europe/Rome, localizzazione it-IT, inizio settimana lunedì.
// Gestione robusta dei mesi (28, 29, 30, 31 gg) e ora legale (transizioni marzo/ottobre).

import { Evento, OdgPunto, TipoEvento } from './db';

export interface CalendarDayCell {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  monthNumber: number; // 0-11
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: Evento[];
}

export interface CalendarMonthGrid {
  year: number;
  month: number; // 0-11
  monthName: string; // "Ottobre"
  weeks: CalendarDayCell[][];
  totalDays: number;
}

const IT_MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const IT_MONTH_SHORT = [
  'GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU',
  'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'
];

const IT_WEEKDAYS_SHORT = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

/**
 * Formatta una data in stringa 'YYYY-MM-DD' nel fuso locale di Roma / dispositivo.
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const SENTINEL_DATA_DA_DEFINIRE = '2099-12-31T20:45:00.000Z';
export const TAG_DATA_DA_DEFINIRE = '[DATA_DA_DEFINIRE]';

/**
 * Verifica se un evento ha la data ancora da concordare/definire (es. per preparare l'ODG in anticipo).
 */
export function isEventoDataDaDefinire(evento: Evento | null | undefined): boolean {
  if (!evento) return false;
  return (
    evento.inizio.startsWith('2099') ||
    Boolean(evento.descrizione && evento.descrizione.includes(TAG_DATA_DA_DEFINIRE))
  );
}

/**
 * Rimuove il tag [DATA_DA_DEFINIRE] dalla descrizione visibile all'utente.
 */
export function getCleanDescrizione(descrizione: string | null | undefined): string {
  if (!descrizione) return '';
  return descrizione.replace(/\[DATA_DA_DEFINIRE\]\s*/g, '').trim();
}

/**
 * Converte una stringa ISO o YYYY-MM-DD in data locale azzerando le ore.
 */
export function parseDateOnly(isoOrDateString: string): Date {
  const [yearStr, monthStr, dayStr] = isoOrDateString.slice(0, 10).split('-');
  return new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr), 0, 0, 0, 0);
}

/**
 * Verifica se un evento ricade in un determinato giorno (YYYY-MM-DD).
 * Gestisce eventi su singolo giorno, multi-day e tutto il giorno.
 */
export function isEventOnDate(evento: Evento, dateKey: string): boolean {
  if (evento.deleted_at !== null) return false;
  // Gli eventi con data da definire non compaiono su giorni fissi del calendario
  if (isEventoDataDaDefinire(evento)) return false;

  const targetDate = parseDateOnly(dateKey).getTime();
  const startDate = parseDateOnly(evento.inizio).getTime();

  if (!evento.fine) {
    return startDate === targetDate;
  }

  const endDate = parseDateOnly(evento.fine).getTime();
  return targetDate >= startDate && targetDate <= endDate;
}

/**
 * Calcola i giorni totali di un mese gestendo anni bisestili (es. Febbraio 28 o 29 gg).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Genera la griglia mensile completa (settimane di 7 giorni, lunedì primo giorno).
 * Resiliente all'ora legale (usa date assolute anno/mese/giorno senza delta millisecondi fissi).
 */
export function buildMonthGrid(year: number, month: number, eventi: Evento[] = []): CalendarMonthGrid {
  const daysInMonth = getDaysInMonth(year, month);
  const todayKey = formatDateKey(new Date());

  // Indice del primo giorno del mese (0 = Domenica, 1 = Lunedì ... 6 = Sabato)
  const firstDay = new Date(year, month, 1);
  const jsDay = firstDay.getDay();
  // Converti a Lunedì = 0, ..., Domenica = 6
  const startDayOffset = (jsDay === 0 ? 6 : jsDay - 1);

  // Giorni del mese precedente
  const daysInPrevMonth = getDaysInMonth(year, month - 1);
  const prevMonthCells: CalendarDayCell[] = [];
  for (let i = startDayOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const date = new Date(year, month - 1, dayNum, 12, 0, 0);
    const dateString = formatDateKey(date);
    const evs = eventi.filter((e) => isEventOnDate(e, dateString));
    const dayOfWeek = date.getDay();

    prevMonthCells.push({
      date,
      dateString,
      dayNumber: dayNum,
      monthNumber: date.getMonth(),
      year: date.getFullYear(),
      isCurrentMonth: false,
      isToday: dateString === todayKey,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      events: evs,
    });
  }

  // Giorni del mese corrente
  const currentMonthCells: CalendarDayCell[] = [];
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date = new Date(year, month, dayNum, 12, 0, 0);
    const dateString = formatDateKey(date);
    const evs = eventi.filter((e) => isEventOnDate(e, dateString));
    const dayOfWeek = date.getDay();

    currentMonthCells.push({
      date,
      dateString,
      dayNumber: dayNum,
      monthNumber: month,
      year,
      isCurrentMonth: true,
      isToday: dateString === todayKey,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      events: evs,
    });
  }

  // Giorni del mese successivo per completare l'ultima settimana (multipli di 7)
  const allCurrentAndPrev = [...prevMonthCells, ...currentMonthCells];
  const remainder = allCurrentAndPrev.length % 7;
  const paddingNext = remainder === 0 ? 0 : 7 - remainder;

  const nextMonthCells: CalendarDayCell[] = [];
  for (let dayNum = 1; dayNum <= paddingNext; dayNum++) {
    const date = new Date(year, month + 1, dayNum, 12, 0, 0);
    const dateString = formatDateKey(date);
    const evs = eventi.filter((e) => isEventOnDate(e, dateString));
    const dayOfWeek = date.getDay();

    nextMonthCells.push({
      date,
      dateString,
      dayNumber: dayNum,
      monthNumber: date.getMonth(),
      year: date.getFullYear(),
      isCurrentMonth: false,
      isToday: dateString === todayKey,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      events: evs,
    });
  }

  const allCells = [...allCurrentAndPrev, ...nextMonthCells];

  // Raggruppa in settimane di 7 giorni
  const weeks: CalendarDayCell[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weeks.push(allCells.slice(i, i + 7));
  }

  return {
    year,
    month,
    monthName: IT_MONTH_NAMES[month] || '',
    weeks,
    totalDays: daysInMonth,
  };
}

/**
 * Restituisce i dettagli per il blocco data calendario da parete (.calendar-date-block).
 */
export function getWallCalendarDate(isoString: string, isDataDaDefinire?: boolean): {
  month: string;
  day: string;
  weekday: string;
  isToday: boolean;
} {
  if (isDataDaDefinire || isoString.startsWith('2099')) {
    return {
      month: 'ODG',
      day: '?',
      weekday: 'DA DEFINIRE',
      isToday: false,
    };
  }

  const d = new Date(isoString);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  return {
    month: IT_MONTH_SHORT[d.getMonth()] || '',
    day: String(d.getDate()),
    weekday: isToday ? 'OGGI' : (IT_WEEKDAYS_SHORT[d.getDay()] || ''),
    isToday,
  };
}

/**
 * Calcola il testo di countdown (es. "Oggi", "Domani", "Tra 4 giorni", "In corso", "Concluso").
 */
export function getEventCountdownText(evento: Evento): string {
  if (isEventoDataDaDefinire(evento)) {
    return 'Data da concordare';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = parseDateOnly(evento.inizio);
  const end = evento.fine ? parseDateOnly(evento.fine) : start;

  const diffDays = Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Oggi';
  if (diffDays === 1) return 'Domani';
  if (diffDays > 1) return `Tra ${diffDays} giorni`;

  // Se diffDays < 0: verifica se l'evento multi-day è ancora in corso
  if (end.getTime() >= today.getTime()) {
    return 'In corso';
  }

  return 'Concluso';
}

/**
 * Formattazione testuale completa dell'intervallo data/ora in italiano.
 */
export function formatEventDateTimeRange(evento: Evento): string {
  if (isEventoDataDaDefinire(evento)) {
    return 'Data e ora da concordare';
  }

  const start = new Date(evento.inizio);
  const isMultiDay = evento.fine && parseDateOnly(evento.inizio).getTime() !== parseDateOnly(evento.fine).getTime();

  const optionsDate: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  };

  const optionsTime: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  if (evento.tutto_il_giorno) {
    if (!evento.fine || !isMultiDay) {
      return `${start.toLocaleDateString('it-IT', optionsDate)} • Tutto il giorno`;
    }
    const end = new Date(evento.fine);
    return `${start.toLocaleDateString('it-IT', optionsDate)} – ${end.toLocaleDateString('it-IT', optionsDate)} • Tutto il giorno`;
  }

  const startTimeStr = start.toLocaleTimeString('it-IT', optionsTime);

  if (!evento.fine) {
    return `${start.toLocaleDateString('it-IT', optionsDate)}, ${startTimeStr}`;
  }

  const end = new Date(evento.fine);
  const endTimeStr = end.toLocaleTimeString('it-IT', optionsTime);

  if (!isMultiDay) {
    return `${start.toLocaleDateString('it-IT', optionsDate)}, ${startTimeStr} – ${endTimeStr}`;
  }

  return `${start.toLocaleDateString('it-IT', optionsDate)} ${startTimeStr} – ${end.toLocaleDateString('it-IT', optionsDate)} ${endTimeStr}`;
}

/**
 * Restituisce la classe CSS e l'etichetta descrittiva del chip del tipo evento.
 */
export function getEventTypeInfo(tipo: TipoEvento): {
  chipClass: string;
  dotColorClass: string;
  label: string;
} {
  switch (tipo) {
    case 'riunione':
      return {
        chipClass: 'event-type-chip event-chip-riunione',
        dotColorClass: 'event-dot-riunione',
        label: 'Riunione',
      };
    case 'uscita':
      return {
        chipClass: 'event-type-chip event-chip-uscita',
        dotColorClass: 'event-dot-uscita',
        label: 'Uscita',
      };
    case 'scadenza':
      return {
        chipClass: 'event-type-chip event-chip-scadenza',
        dotColorClass: 'event-dot-scadenza',
        label: 'Scadenza',
      };
    case 'evento':
      return {
        chipClass: 'event-type-chip event-chip-evento',
        dotColorClass: 'event-dot-evento',
        label: 'Evento',
      };
    case 'altro':
    default:
      return {
        chipClass: 'event-type-chip event-chip-altro',
        dotColorClass: 'event-dot-altro',
        label: 'Altro',
      };
  }
}

/**
 * Conta i punti ODG ancora aperti (non completati e non eliminati).
 */
export function countOpenOdgPoints(points: OdgPunto[]): number {
  return points.filter((p) => !p.completato && p.deleted_at === null).length;
}
