import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SectionIcon } from '../../ui/SectionIcon';
import { HeaderBanner } from '../../ui/HeaderBanner';
import { Badge } from '../../ui/Badge';

export function BansView() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'tutti' | 'gesti' | 'seduti'>('tutti');

  return (
    <div>
      {/* 1. FASCIA FOTOGRAFICA D'INTESTAZIONE */}
      <HeaderBanner
        photoId="bans"
        title={I18N.bans.title}
        count="18 bans salvati"
        section="bans"
      />

      <div className="container" style={{ paddingTop: 'var(--space-4)' }}>
        {/* 2. RICERCA RAPIDA E FILTRI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <SearchField
            value={search}
            onInput={setSearch}
            placeholder={I18N.search.placeholderBans}
            aria-label={I18N.search.placeholderBans}
          />
          <SegmentedControl
            options={[
              { value: 'tutti', label: 'Tutti i Bans' },
              { value: 'gesti', label: 'A gesti / Ballati' },
              { value: 'seduti', label: 'Di veglia / Seduti' },
            ]}
            value={filter}
            onChange={(val) => setFilter(val as any)}
          />
        </div>

        {/* 3. LISTA BANS GROUPED IOS */}
        <GroupedList
          header="BANS E CANTI DI FUOCO"
          footer="Tocca un ban per aprire la modalità lettura all'aperto ad alto contrasto per i fuochi serali."
        >
          <GroupedRow
            leading={<SectionIcon section="bans" size="sm" />}
            title="La Macchina del Capo"
            subtitle="Testo cumulativo a gesti • Ritmo incalzante"
            trailing={<Badge variant="giallo" size="sm">Gesti</Badge>}
            chevron
          />
          <GroupedRow
            leading={<SectionIcon section="bans" size="sm" />}
            title="Tepitepiti"
            subtitle="Ban di riscaldamento rapido a squadre"
            trailing={<Badge variant="azzurro" size="sm">Ritmo</Badge>}
            chevron
          />
          <GroupedRow
            leading={<SectionIcon section="bans" size="sm" />}
            title="A Ram Sam Sam"
            subtitle="Tradizionale per fuochi di bivacco"
            trailing={<Badge variant="neutral" size="sm">Classico</Badge>}
            chevron
          />
          <GroupedRow
            leading={<SectionIcon section="bans" size="sm" />}
            title="Il Grillo e la Formica"
            subtitle="Fuoco di bivacco • Animazione e cori a più voci"
            trailing={<Badge variant="giallo" size="sm">Nuovo</Badge>}
            chevron
          />
        </GroupedList>
      </div>
    </div>
  );
}
