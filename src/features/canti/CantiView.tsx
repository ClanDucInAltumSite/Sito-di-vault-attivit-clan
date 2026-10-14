import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SectionIcon } from '../../ui/SectionIcon';
import { HeaderBanner } from '../../ui/HeaderBanner';
import { Badge } from '../../ui/Badge';

export function CantiView() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'tutti' | 'clan' | 'liturgici'>('tutti');
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div>
      {/* 1. FASCIA FOTOGRAFICA D'INTESTAZIONE */}
      <HeaderBanner
        photoId="canti"
        title={I18N.canti.title}
        count="56 canti con accordi"
        section="canti"
      />

      <div className="container" style={{ paddingTop: 'var(--space-4)' }}>
        {/* 2. RICERCA RAPIDA E FILTRI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
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

        {/* 3. LISTA CANTI GROUPED IOS */}
        <GroupedList
          header="CANZONIERE"
          footer="Tocca un canto per visualizzare gli accordi, trasporre la tonalità o stampare."
        >
          <GroupedRow
            leading={<SectionIcon section="canti" size="sm" />}
            title="Strade e Pensieri per Domani"
            subtitle="Tonalità: Re magg • 112 BPM • 4/4"
            trailing={<Badge variant="giallo" size="sm">Nuovo</Badge>}
            chevron
            onClick={() => setShowPreview(!showPreview)}
          />
          <GroupedRow
            leading={<SectionIcon section="canti" size="sm" />}
            title="Canto della Promessa"
            subtitle="Tonalità: Sol • 108 BPM • 4/4"
            trailing={<Badge variant="azzurro" size="sm">Tradizione</Badge>}
            chevron
          />
          <GroupedRow
            leading={<SectionIcon section="canti" size="sm" />}
            title="Madre della Speranza"
            subtitle="Tonalità: Re • 85 BPM • 3/4"
            trailing={<Badge variant="neutral" size="sm">Liturgico</Badge>}
            chevron
          />
          <GroupedRow
            leading={<SectionIcon section="canti" size="sm" />}
            title="La Traccia"
            subtitle="Tonalità: Mi min • 120 BPM • 4/4"
            trailing={<Badge variant="giallo" size="sm">Strada</Badge>}
            chevron
          />
        </GroupedList>

        {/* 4. ANTEPRIMA STRUTTURA CANTO CON ACCORDI E RITORNELLO */}
        <div style={{ marginTop: 'var(--space-6)' }}>
          <div className="ios-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div>
                <span className="ios-badge ios-badge-sm ios-badge-azzurro">Esempio Tipografico Accordi</span>
                <h3 className="song-title-display" style={{ fontSize: 'var(--font-size-lg)', marginTop: '4px' }}>
                  Strade e Pensieri per Domani
                </h3>
              </div>
              <span className="ios-badge ios-badge-sm ios-badge-neutral">Capo II</span>
            </div>

            {/* Strofa */}
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8, marginBottom: 'var(--space-3)' }}>
              <div><span className="song-chord">Re</span> Sai da dove viene, <span className="song-chord">Sol</span> sai dove ti porta</div>
              <div><span className="song-chord">La</span> Questo camminare, <span className="song-chord">Re</span> questa strada aperta</div>
            </div>

            {/* Ritornello con barra gialla e sfondo giallino tenue */}
            <div className="song-chorus-block">
              <span className="song-chorus-label">Ritornello</span>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8 }}>
                <div><span className="song-chord">Sol</span> Canta con noi, <span className="song-chord">La</span> batti le mani</div>
                <div><span className="song-chord">Fa#m</span> Danza sui passi dei <span className="song-chord">Sim</span> tuoi domani</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
