// src/features/calendario/CalendarioMonthView.tsx
// Vista Mese del Calendario con griglia interattiva lunedì-domenica,
// indicatori colorati per tipo attività, oggi evidenziato in rosso,
// e lista delle attività del giorno selezionato.

import { useState } from 'preact/hooks';
import { Evento, OdgPunto } from '../../lib/db';
import {
  buildMonthGrid,
  formatDateKey,
  CalendarDayCell,
  getEventTypeInfo,
  formatEventDateTimeRange,
} from '../../lib/calendario';
import { I18N } from '../../lib/i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';

export interface CalendarioMonthViewProps {
  eventi: Evento[];
  odgMap: Record<string, OdgPunto[]>;
  onSelectEvento: (evento: Evento) => void;
  initialYear?: number;
  initialMonth?: number;
}

export function CalendarioMonthView({
  eventi,
  odgMap,
  onSelectEvento,
  initialYear,
  initialMonth,
}: CalendarioMonthViewProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(initialYear ?? today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialMonth ?? today.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(formatDateKey(today));

  const grid = buildMonthGrid(currentYear, currentMonth, eventi);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDateKey(formatDateKey(now));
  };

  // Trova gli eventi della data selezionata
  const selectedEvents = eventi.filter((e) => {
    const s = e.inizio.slice(0, 10);
    const f = e.fine ? e.fine.slice(0, 10) : s;
    return selectedDateKey >= s && selectedDateKey <= f && e.deleted_at === null;
  });

  const selectedDateFormatted = (() => {
    const parts = selectedDateKey.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  })();

  return (
    <div>
      {/* Scheda Griglia Mensile */}
      <div className="calendar-month-card">
        {/* Barra di Navigazione Mese */}
        <div className="calendar-month-nav">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevMonth}
            aria-label={I18N.calendario.mesePrec}
          >
            <Icon name="chevron-left" size={18} />
          </Button>

          <div className="calendar-month-title">
            {grid.monthName} {grid.year}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleToday}
            style={{ fontSize: 'var(--font-size-xs)' }}
          >
            {I18N.calendario.tornaOggi}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextMonth}
            aria-label={I18N.calendario.meseSucc}
          >
            <Icon name="chevron-right" size={18} />
          </Button>
        </div>

        {/* Intestazione Giorni della Settimana (LUN-DOM) */}
        <div className="calendar-weekdays-row" aria-hidden="true">
          <div>LUN</div>
          <div>MAR</div>
          <div>MER</div>
          <div>GIO</div>
          <div>VEN</div>
          <div>SAB</div>
          <div>DOM</div>
        </div>

        {/* Griglia Settimane e Giorni */}
        <div className="calendar-days-grid" role="grid" aria-label={`Calendario di ${grid.monthName} ${grid.year}`}>
          {grid.weeks.map((week, wIndex) => (
            <div key={wIndex} role="row" style={{ display: 'contents' }}>
              {week.map((cell: CalendarDayCell) => {
                const isSelected = cell.dateString === selectedDateKey;
                const hasEvents = cell.events.length > 0;

                return (
                  <button
                    type="button"
                    key={cell.dateString}
                    className={`calendar-cell ${!cell.isCurrentMonth ? 'calendar-cell-other-month' : ''} ${
                      cell.isToday ? 'calendar-cell-today' : ''
                    } ${isSelected ? 'calendar-cell-selected' : ''}`}
                    onClick={() => {
                      setSelectedDateKey(cell.dateString);
                      if (!cell.isCurrentMonth) {
                        setCurrentMonth(cell.monthNumber);
                        setCurrentYear(cell.year);
                      }
                    }}
                    aria-label={`${cell.dayNumber} ${grid.monthName} ${grid.year}${
                      cell.isToday ? ', Oggi' : ''
                    }${hasEvents ? `, ${cell.events.length} attività` : ''}`}
                    aria-selected={isSelected}
                    role="gridcell"
                  >
                    <span className="calendar-cell-day-num">{cell.dayNumber}</span>

                    {/* Indicatori a pallino colorato dei tipi di evento */}
                    <div className="calendar-cell-dots" aria-hidden="true">
                      {cell.events.slice(0, 3).map((ev) => {
                        const typeInfo = getEventTypeInfo(ev.tipo);
                        return (
                          <span
                            key={ev.id}
                            className={`calendar-dot ${typeInfo.dotColorClass}`}
                            title={ev.titolo}
                          />
                        );
                      })}
                      {cell.events.length > 3 && (
                        <span
                          style={{
                            fontSize: '8px',
                            fontWeight: 700,
                            lineHeight: 1,
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          +{cell.events.length - 3}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Dettaglio Attività della Data Selezionata */}
      <GroupedList
        header={`${I18N.calendario.eventiGiorno.toUpperCase()} - ${selectedDateFormatted.toUpperCase()}`}
        footer="Seleziona un'attività per consultare dettagli logistici, allegati e l'Ordine del Giorno."
      >
        {selectedEvents.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-4)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {I18N.calendario.nessunEventoGiorno}
          </div>
        ) : (
          selectedEvents.map((ev) => {
            const typeInfo = getEventTypeInfo(ev.tipo);
            const timeRange = formatEventDateTimeRange(ev);
            const evOdg = odgMap[ev.id] || [];
            const openOdg = evOdg.filter((p) => !p.completato && p.deleted_at === null).length;

            return (
              <GroupedRow
                key={ev.id}
                title={ev.titolo}
                subtitle={`${timeRange}${ev.luogo ? ` • ${ev.luogo}` : ''}${
                  openOdg > 0 ? ` • ${openOdg} ODG apert${openOdg === 1 ? 'o' : 'i'}` : ''
                }`}
                trailing={<span className={typeInfo.chipClass}>{typeInfo.label}</span>}
                chevron
                onClick={() => onSelectEvento(ev)}
              />
            );
          })
        )}
      </GroupedList>
    </div>
  );
}
