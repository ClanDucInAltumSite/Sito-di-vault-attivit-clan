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
          const dateBlock = getWallCalendarDate(evento.inizio, isTbd);
          const typeInfo = getEventTypeInfo(evento.tipo);
          const timeRange = formatEventDateTimeRange(evento);
          const evOdg = odgMap[evento.id] || [];
          const openOdg = evOdg.filter((p) => !p.completato && p.deleted_at === null).length;

          const subtitleParts: string[] = [timeRange];
          if (evento.luogo) subtitleParts.push(evento.luogo);
          if (openOdg > 0) {
            subtitleParts.push(`${openOdg} ODG apert${openOdg === 1 ? 'o' : 'i'}`);
          }

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
              subtitle={subtitleParts.join(' • ')}
              trailing={
                isTbd ? (
                  <span className="event-type-chip event-chip-riunione" style={{ fontWeight: 600 }}>
                    Data da concordare
                  </span>
                ) : (
                  <span className={typeInfo.chipClass}>{typeInfo.label}</span>
                )
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
