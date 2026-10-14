import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { navigate } from '../../app/router';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { LogoReveal, TheTrail, CompassSync } from '../../ui/ScoutMotifs';

export function HomeView() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="container">
      {/* Intestazione Apple con Logo Reveal e Il Sentiero */}
      <header style={{ textAlign: 'center', padding: '16px 0 8px' }}>
        <LogoReveal size={68} />
        <h1
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            marginTop: '12px',
          }}
        >
          {I18N.app.title}
        </h1>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            marginTop: '4px',
            maxWidth: '460px',
            marginInline: 'auto',
          }}
        >
          {I18N.app.subtitle}
        </p>

        {/* Motivo Scout 2: The Trail (Il Sentiero) */}
        <TheTrail className="scout-trail-home" />
      </header>

      {/* Barra di ricerca rapida iOS */}
      <div style={{ marginBottom: '24px' }}>
        <SearchField
          value={searchQuery}
          onInput={setSearchQuery}
          placeholder={I18N.search.placeholderGlobale}
          aria-label={I18N.search.placeholderGlobale}
        />
      </div>

      {/* Lista Raggruppata iOS: Le 4 Aree di Contenuto */}
      <GroupedList header="ARCHIVIO CLAN">
        <GroupedRow
          leading={<Icon name="giochi" size={20} />}
          title={I18N.nav.giochi}
          subtitle="Regole, svolgimento e materiali per i giochi"
          chevron
          onClick={() => navigate('giochi')}
        />
        <GroupedRow
          leading={<Icon name="bans" size={20} />}
          title={I18N.nav.bans}
          subtitle="Testi e gesti a memoria per i fuochi serali"
          chevron
          onClick={() => navigate('bans')}
        />
        <GroupedRow
          leading={<Icon name="canti" size={20} />}
          title={I18N.nav.canti}
          subtitle="Canzoniere con accordi ChordPro e trasposizione"
          chevron
          onClick={() => navigate('canti')}
        />
        <GroupedRow
          leading={<Icon name="calendario" size={20} />}
          title={I18N.nav.calendario}
          subtitle="Attività, uscite e Ordine del Giorno delle riunioni"
          chevron
          onClick={() => navigate('calendario')}
        />
      </GroupedList>

      {/* Prossima Attività in Evidenza (Grouped List) */}
      <GroupedList header="PROSSIMA ATTIVITÀ">
        <GroupedRow
          leading={<Icon name="clock" size={20} />}
          title="Nessun evento in programma"
          subtitle="Consulta il calendario completo per date e ODG"
          trailing={<Badge variant="neutral" size="sm">Clan</Badge>}
          chevron
          onClick={() => navigate('calendario')}
        />
      </GroupedList>

      {/* Stato e Bussola Scout */}
      <GroupedList header="STATO E SINCRONIZZAZIONE">
        <GroupedRow
          leading={<CompassSync isSyncing={false} size={22} />}
          title="Archivio Locale e Offline"
          subtitle="Pronto all'uso senza connessione internet"
          trailing={<Badge variant="azzurro" size="sm">Online</Badge>}
        />
      </GroupedList>

      {/* Strumenti & Design System */}
      <GroupedList header="STRUMENTI">
        <GroupedRow
          leading={<Icon name="stampa" size={20} />}
          title={I18N.stampa.title}
          subtitle="Componi fascicoli A4 per uscite e campi"
          chevron
          onClick={() => navigate('stampa')}
        />
        <GroupedRow
          leading={<Icon name="settings" size={20} />}
          title="Sistema di Design (FASE 1B)"
          subtitle="Verifica palette OKLCH, componenti Apple e contrasti"
          chevron
          onClick={() => navigate('design')}
        />
      </GroupedList>
    </div>
  );
}
