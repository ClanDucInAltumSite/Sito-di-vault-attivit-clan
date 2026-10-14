import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';

export function CantiView() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'tutti' | 'clan' | 'liturgici'>('tutti');

  return (
    <div className="container">
      {/* Intestazione Sezione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {I18N.canti.title}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}>
            Canzoniere con accordi ChordPro e trasposizione
          </p>
        </div>
      </div>

      {/* Ricerca e Filtro Segmentato Canti */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <SearchField
          value={search}
          onInput={setSearch}
          placeholder={I18N.search.placeholderCanti}
          aria-label={I18N.search.placeholderCanti}
        />
        <SegmentedControl
          options={[
            { value: 'tutti', label: 'Tutti i Canti' },
            { value: 'clan', label: 'Canti di Clan' },
            { value: 'liturgici', label: 'Liturgici' },
          ]}
          value={filter}
          onChange={(val) => setFilter(val as any)}
        />
      </div>

      {/* Lista Canti Grouped iOS */}
      <GroupedList header="CANZONIERE" footer="Tocca un canto per visualizzare gli accordi, trasporre la tonalità o stampare.">
        <GroupedRow
          leading={<Icon name="canti" size={20} />}
          title="Canto della Promessa"
          subtitle="Tonalità: Sol • 108 BPM • 4/4"
          trailing={<Badge variant="azzurro" size="sm">Tradizione</Badge>}
          chevron
        />
        <GroupedRow
          leading={<Icon name="canti" size={20} />}
          title="Madre della Speranza"
          subtitle="Tonalità: Re • 85 BPM • 3/4"
          trailing={<Badge variant="neutral" size="sm">Liturgico</Badge>}
          chevron
        />
        <GroupedRow
          leading={<Icon name="canti" size={20} />}
          title="La Traccia"
          subtitle="Tonalità: Mi min • 120 BPM • 4/4"
          trailing={<Badge variant="giallo" size="sm">Strada</Badge>}
          chevron
        />
      </GroupedList>
    </div>
  );
}
