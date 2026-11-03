// src/features/calendario/CalendarioListView.tsx
// Vista Lista del Calendario con blocco data da parete (.calendar-date-block),
// chip tipo attività, contatore ODG aperti e distinzione tra prossimi e passati.

import { Evento, OdgPunto } from '../../lib/db';
import {
  getWallCalendarDate,
  formatEventDateTimeRange,
  getEventTypeInfo,
  parseDateOnly,
  isEventoDataDaDefinire,
  getEventCountdownText,
} from '../../lib/calendario';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';

export interface CalendarioListViewProps {
  eventi: Evento[];
  odgMap: Record<string, OdgPunto[]>;
  onSelectEvento: (evento: Evento) => void;
  mode: 'prossimi' | 'passati' | 'tutti';
}

export function CalendarioListView({
  eventi,
  odgMap,
  onSelectEvento,
  mode,
}: CalendarioListViewProps) {
  const todayTime = new Date().setHours(0, 0, 0, 0);

  // Filtra eventi
  const filtered = eventi.filter((e) => {
    if (e.deleted_at !== null) return false;
    const isTbd = isEventoDataDaDefinire(e);

    if (mode === 'prossimi') {
      if (isTbd) return true;
      const start = parseDateOnly(e.inizio).getTime();
      const end = e.fine ? parseDateOnly(e.fine).getTime() : start;
      return end >= todayTime;
    }
    if (mode === 'passati') {
      if (isTbd) return false; // Un'attività con data da concordare non è passata
      const start = parseDateOnly(e.inizio).getTime();
      const end = e.fine ? parseDateOnly(e.fine).getTime() : start;
      return end < todayTime;
    }
    return true;
  });

  // Ordinamento: prossimi in ordine crescente (quelli con data da concordare sempre in cima!), passati in ordine decrescente
  filtered.sort((a, b) => {
    const aTbd = isEventoDataDaDefinire(a);
    const bTbd = isEventoDataDaDefinire(b);
    if (aTbd && !bTbd) return -1;
    if (!aTbd && bTbd) return 1;
    if (aTbd && bTbd) {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    }

    const timeA = new Date(a.inizio).getTime();
    const timeB = new Date(b.inizio).getTime();
    return mode === 'passati' ? timeB - timeA : timeA - timeB;
  });

  const headerTitle =
    mode === 'prossimi'
      ? 'ATTIVITÀ IN PROGRAMMA'
      : mode === 'passati'
      ? 'ATTIVITÀ PASSATE'
      : 'TUTTE LE ATTIVITÀ';

  return (
    <GroupedList
      header={headerTitle}
      footer="Tocca un'attività per visualizzare dettagli logistici, note, allegati e Ordine del Giorno."
    >
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-6)',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)',
          }}
        >
          {mode === 'passati'
            ? 'Nessuna attività passata registrata.'
            : I18N.calendario.empty}
        </div>
      ) : (
        filtered.map((evento) => {
          const isTbd = isEventoDataDaDefinire(evento);
          const dateBlock = getWallCalendarDate(evento.inizio, isTbd, evento.tipo);
          const typeInfo = getEventTypeInfo(evento.tipo);
          const timeRange = formatEventDateTimeRange(evento);
          const evOdg = odgMap[evento.id] || [];
          const openOdg = evOdg.filter((p) => !p.completato && p.deleted_at === null).length;

          const subtitleParts: string[] = [timeRange];
          if (evento.luogo && evento.luogo.trim()) {
            subtitleParts.push(evento.luogo);
          }
          if (openOdg > 0) {
            subtitleParts.push(`${openOdg} ODG apert${openOdg === 1 ? 'o' : 'i'}`);
          }

          const countdownText = getEventCountdownText(evento);
          let countdownModifier = 'calendar-row-countdown-future';
          if (countdownText === 'Oggi') {
            countdownModifier = `calendar-row-countdown-today calendar-row-countdown-today-${evento.tipo || 'altro'}`;
          } else if (countdownText === 'Domani') {
            countdownModifier = 'calendar-row-countdown-tomorrow';
          } else if (countdownText === 'In corso') {
            countdownModifier = 'calendar-row-countdown-ongoing';
          } else if (isTbd || countdownText === 'Data da concordare') {
            countdownModifier = 'calendar-row-countdown-tbd';
          }

          const showCountdown = mode !== 'passati';

          const subtitleContent = (
            <span>
              <span style={dateBlock.isToday ? { color: typeInfo.colorVar, fontWeight: 600 } : undefined}>
                {timeRange}
              </span>
              {evento.luogo && evento.luogo.trim() ? ` • ${evento.luogo}` : ''}
              {openOdg > 0 ? ` • ${openOdg} ODG apert${openOdg === 1 ? 'o' : 'i'}` : ''}
            </span>
          );

          return (
            <GroupedRow
              key={evento.id}
              leading={
                <div
                  className={`calendar-date-block calendar-date-block-${evento.tipo || 'altro'} ${
                    dateBlock.isToday ? 'calendar-date-block-today' : ''
                  }`}
                  aria-hidden="true"
                >
                  <div className="calendar-date-month">{dateBlock.month}</div>
                  <div className="calendar-date-day">{dateBlock.day}</div>
                  <div className="calendar-date-weekday">{dateBlock.weekday}</div>
                </div>
              }
              title={evento.titolo}
              subtitle={subtitleContent}
              trailing={
                <div className="calendar-row-trailing">
                  <span className={typeInfo.chipClass}>{typeInfo.label}</span>
                  {showCountdown && countdownText && (
                    <span className={`calendar-row-countdown ${countdownModifier}`}>
                      {countdownText}
                    </span>
                  )}
                </div>
              }
              chevron
              onClick={() => onSelectEvento(evento)}
            />
          );
        })
      )}
    </GroupedList>
  );
}
