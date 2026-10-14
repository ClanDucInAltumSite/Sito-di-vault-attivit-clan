import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { HeaderBanner } from '../../ui/HeaderBanner';

export function CalendarioView() {
  const [viewMode, setViewMode] = useState<'prossimi' | 'passati' | 'tutti'>('prossimi');

  return (
    <div>
      {/* 1. FASCIA FOTOGRAFICA D'INTESTAZIONE */}
      <HeaderBanner
        photoId="calendario"
        title={I18N.calendario.title}
        count="6 attività in programma"
        section="calendario"
      />

      <div className="container" style={{ paddingTop: 'var(--space-4)' }}>
        {/* 2. FILTRI VISTA */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <SegmentedControl
            options={[
              { value: 'prossimi', label: 'Prossimi Eventi' },
              { value: 'passati', label: 'Eventi Passati' },
              { value: 'tutti', label: 'Anno Completo' },
            ]}
            value={viewMode}
            onChange={(val) => setViewMode(val as any)}
          />
        </div>

        {/* 3. LISTA EVENTI CON BLOCCO DATA CALENDARIO DA PARETE E CHIP TIPO EVENTO */}
        <GroupedList
          header="ATTIVITÀ E ORDINE DEL GIORNO"
          footer="Tocca un evento per visualizzare i dettagli logistici e l'Ordine del Giorno (ODG)."
        >
          {/* Evento 1: Oggi (Riunione) */}
          <GroupedRow
            leading={
              <div className="calendar-date-block calendar-date-block-today">
                <div className="calendar-date-month">OTT</div>
                <div className="calendar-date-day">14</div>
                <div className="calendar-date-weekday">OGGI</div>
              </div>
            }
            title="Riunione di Clan e Verifica Fasi"
            subtitle="18:30 - 20:30 • Sede Clan • 4 punti ODG"
            trailing={<span className="event-type-chip event-chip-riunione">Riunione</span>}
            chevron
          />

          {/* Evento 2: Uscita dei Passaggi */}
          <GroupedRow
            leading={
              <div className="calendar-date-block">
                <div className="calendar-date-month">OTT</div>
                <div className="calendar-date-day">19</div>
                <div className="calendar-date-weekday">SAB</div>
              </div>
            }
            title="Uscita dei Passaggi sui Sibillini"
            subtitle="Partenza 08:30 • Monte Vettore • Zaino spalla"
            trailing={<span className="event-type-chip event-chip-uscita">Uscita</span>}
            chevron
          />

          {/* Evento 3: Scadenza Iscrizioni */}
          <GroupedRow
            leading={
              <div className="calendar-date-block">
                <div className="calendar-date-month">OTT</div>
                <div className="calendar-date-day">31</div>
                <div className="calendar-date-weekday">GIO</div>
              </div>
            }
            title="Scadenza Iscrizioni Route Invernale"
            subtitle="Invio quota caparra e adesione definitiva"
            trailing={<span className="event-type-chip event-chip-scadenza">Scadenza</span>}
            chevron
          />

          {/* Evento 4: Evento di Gruppo */}
          <GroupedRow
            leading={
              <div className="calendar-date-block">
                <div className="calendar-date-month">NOV</div>
                <div className="calendar-date-day">08</div>
                <div className="calendar-date-weekday">VEN</div>
              </div>
            }
            title="Veglia d'Armi e Rinnovo Promessa"
            subtitle="21:00 • Chiesa Parrocchiale di San Giovanni"
            trailing={<span className="event-type-chip event-chip-evento">Evento</span>}
            chevron
          />

          {/* Evento 5: Altro / Manutenzione */}
          <GroupedRow
            leading={
              <div className="calendar-date-block">
                <div className="calendar-date-month">NOV</div>
                <div className="calendar-date-day">15</div>
                <div className="calendar-date-weekday">SAB</div>
              </div>
            }
            title="Manutenzione Tende e Materiali"
            subtitle="15:00 - 18:00 • Magazzino di Gruppo"
            trailing={<span className="event-type-chip event-chip-altro">Altro</span>}
            chevron
          />
        </GroupedList>
      </div>
    </div>
  );
}
