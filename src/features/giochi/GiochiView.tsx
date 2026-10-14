import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';

export function GiochiView() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'tutti' | 'aperto' | 'seduti'>('tutti');

  return (
    <div className="container">
      {/* Intestazione Sezione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {I18N.giochi.title}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}>
            Archivio di regole, materiali e schemi di gioco
          </p>
        </div>
      </div>

      {/* Ricerca e Filtro Segmentato */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <SearchField
          value={search}
          onInput={setSearch}
          placeholder={I18N.search.placeholderGiochi}
          aria-label={I18N.search.placeholderGiochi}
        />
        <SegmentedControl
          options={[
            { value: 'tutti', label: 'Tutti i Giochi' },
            { value: 'aperto', label: 'All\'aperto' },
            { value: 'seduti', label: 'Al chiuso / Seduti' },
          ]}
          value={filter}
          onChange={(val) => setFilter(val as any)}
        />
      </div>

      {/* Lista Giochi Grouped iOS */}
      <GroupedList header="GIOCHI DISPONIBILI" footer="I dati vengono sincronizzati automaticamente e memorizzati offline.">
        <GroupedRow
          leading={<Icon name="giochi" size={20} />}
          title="Palla Avvelenata dei Clan"
          subtitle="All'aperto • Materiali: 2 palloni leggeri"
          trailing={<Badge variant="azzurro" size="sm">Clan</Badge>}
          chevron
        />
        <GroupedRow
          leading={<Icon name="giochi" size={20} />}
          title="Alce Rossa"
          subtitle="Bosco o campo aperto • Gioco di tattica e furtività"
          trailing={<Badge variant="giallo" size="sm">Tattica</Badge>}
          chevron
        />
        <GroupedRow
          leading={<Icon name="giochi" size={20} />}
          title="Rover Run"
          subtitle="Pattuglia • Staffetta di orientamento e topografia"
          trailing={<Badge variant="neutral" size="sm">Staffetta</Badge>}
          chevron
        />
      </GroupedList>
    </div>
  );
}
