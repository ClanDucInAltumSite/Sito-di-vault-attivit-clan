// src/features/calendario/CalendarioListView.tsx
// Vista Lista del Calendario con blocco data da parete (.calendar-date-block),
// chip tipo attività, contatore ODG aperti e distinzione tra prossimi e passati.

import { Evento, OdgPunto } from '../../lib/db';
import {
  getWallCalendarDate,
  formatEventDateTimeRange,
  getEventTypeInfo,
  parseDateOnly,
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
    const start = parseDateOnly(e.inizio).getTime();
    const end = e.fine ? parseDateOnly(e.fine).getTime() : start;

    if (mode === 'prossimi') {
      return end >= todayTime;
    }
    if (mode === 'passati') {
      return end < todayTime;
    }
    return true;
  });

  // Ordinamento: prossimi in ordine crescente (più vicini prima), passati in ordine decrescente (più recenti prima)
  filtered.sort((a, b) => {
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
          const dateBlock = getWallCalendarDate(evento.inizio);
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
                  className={`calendar-date-block ${
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
              trailing={<span className={typeInfo.chipClass}>{typeInfo.label}</span>}
              chevron
              onClick={() => onSelectEvento(evento)}
            />
          );
        })
      )}
    </GroupedList>
  );
}
