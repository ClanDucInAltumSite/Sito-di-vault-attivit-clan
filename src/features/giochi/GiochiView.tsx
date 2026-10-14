import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SectionIcon } from '../../ui/SectionIcon';
import { HeaderBanner } from '../../ui/HeaderBanner';
import { Badge } from '../../ui/Badge';

export function GiochiView() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'tutti' | 'aperto' | 'seduti'>('tutti');

  return (
    <div>
      {/* 1. FASCIA FOTOGRAFICA D'INTESTAZIONE */}
      <HeaderBanner
        photoId="giochi"
        title={I18N.giochi.title}
        count="24 giochi salvati"
        section="giochi"
      />

      <div className="container" style={{ paddingTop: 'var(--space-4)' }}>
        {/* 2. RICERCA E FILTRI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <SearchField
            value={search}
            onInput={setSearch}
            placeholder={I18N.search.placeholderGiochi}
            aria-label={I18N.search.placeholderGiochi}
          />
          <SegmentedControl
            options={[
              { value: 'tutti', label: 'Tutti i Giochi' },
              { value: 'aperto', label: "All'aperto" },
              { value: 'seduti', label: 'Al chiuso / Seduti' },
            ]}
            value={filter}
            onChange={(val) => setFilter(val as any)}
          />
        </div>

        {/* 3. LISTA GIOCHI GROUPED IOS */}
        <GroupedList
          header="GIOCHI DISPONIBILI"
          footer="Tutti i giochi sono disponibili offline con regole e schemi di gioco."
        >
          <GroupedRow
            leading={<SectionIcon section="giochi" size="sm" />}
            title="Palla Avvelenata dei Clan"
            subtitle="All'aperto • Materiali: 2 palloni leggeri"
            trailing={<Badge variant="azzurro" size="sm">Clan</Badge>}
            chevron
          />
          <GroupedRow
            leading={<SectionIcon section="giochi" size="sm" />}
            title="Alce Rossa"
            subtitle="Bosco o prato aperto • Gioco di tattica e furtività"
            trailing={<Badge variant="giallo" size="sm">Tattica</Badge>}
            chevron
          />
          <GroupedRow
            leading={<SectionIcon section="giochi" size="sm" />}
            title="Rover Run"
            subtitle="Pattuglia • Staffetta di orientamento e topografia"
            trailing={<Badge variant="neutral" size="sm">Staffetta</Badge>}
            chevron
          />
          <GroupedRow
            leading={<SectionIcon section="giochi" size="sm" />}
            title="Scalpo Notturno"
            subtitle="Notte all'aperto • Fazzolettoni e torce tascabili"
            trailing={<Badge variant="rosso" size="sm">Notturno</Badge>}
            chevron
          />
        </GroupedList>
      </div>
    </div>
  );
}
