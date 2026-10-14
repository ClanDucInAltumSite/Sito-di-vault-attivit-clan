import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';

export function CalendarioView() {
  const [viewMode, setViewMode] = useState<'lista' | 'mese'>('lista');

  return (
    <div className="container">
      {/* Intestazione Sezione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {I18N.calendario.title}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}>
            Attività, uscite, campi e Ordine del Giorno
          </p>
        </div>
      </div>

      {/* Switch Mese / Lista */}
      <div style={{ marginBottom: '20px' }}>
        <SegmentedControl
          options={[
            { value: 'lista', label: I18N.calendario.vistaLista },
            { value: 'mese', label: I18N.calendario.vistaMese },
          ]}
          value={viewMode}
          onChange={(val) => setViewMode(val as any)}
        />
      </div>

      {/* Lista Eventi */}
      <GroupedList header="PROSSIMI EVENTI IN PROGRAMMA" footer="Tocca un evento per visualizzare i dettagli completi e l'Ordine del Giorno.">
        <GroupedRow
          leading={<Icon name="calendario" size={20} />}
          title="Riunione di Clan e Verifica"
          subtitle="Sabato 18 Ottobre • 16:30 - 19:00 • Sede Clan"
          trailing={<Badge variant="rosso" size="sm">Oggi</Badge>}
          chevron
        />
        <GroupedRow
          leading={<Icon name="map-pin" size={20} />}
          title="Uscita sui Monti Sibillini"
          subtitle="25 - 26 Ottobre • Partenza ore 08:00 • Zaino spalla"
          trailing={<Badge variant="azzurro" size="sm">Uscita</Badge>}
          chevron
        />
        <GroupedRow
          leading={<Icon name="file-text" size={20} />}
          title="Consiglio Capi / Pattuglia"
          subtitle="Mercoledì 29 Ottobre • 21:00 • Online"
          trailing={<Badge variant="neutral" size="sm">ODG</Badge>}
          chevron
        />
      </GroupedList>
    </div>
  );
}
