import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';

export function BansView() {
  const [search, setSearch] = useState('');

  return (
    <div className="container">
      {/* Intestazione Sezione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {I18N.bans.title}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}>
            Canti e balli di gruppo a memoria per i fuochi serali
          </p>
        </div>
      </div>

      {/* Ricerca Rapida Bans */}
      <div style={{ marginBottom: '20px' }}>
        <SearchField
          value={search}
          onInput={setSearch}
          placeholder={I18N.search.placeholderBans}
          aria-label={I18N.search.placeholderBans}
        />
      </div>

      {/* Lista Bans Grouped iOS */}
      <GroupedList header="BANS E CANTI DI FUOCO" footer="Tocca un ban per aprire la modalità lettura all'aperto ad alto contrasto.">
        <GroupedRow
          leading={<Icon name="bans" size={20} />}
          title="La Macchina del Capo"
          subtitle="Testo cumulativo a gesti • Ritmo incalzante"
          trailing={<Badge variant="giallo" size="sm">Gesti</Badge>}
          chevron
        />
        <GroupedRow
          leading={<Icon name="bans" size={20} />}
          title="Tepitepiti"
          subtitle="Ban di riscaldamento rapido a squadre"
          trailing={<Badge variant="azzurro" size="sm">Ritmo</Badge>}
          chevron
        />
        <GroupedRow
          leading={<Icon name="bans" size={20} />}
          title="A Ram Sam Sam"
          subtitle="Tradizionale per fuochi di bivacco"
          trailing={<Badge variant="neutral" size="sm">Classico</Badge>}
          chevron
        />
      </GroupedList>
    </div>
  );
}
