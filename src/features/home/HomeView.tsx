import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { navigate } from '../../app/router';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { Badge } from '../../ui/Badge';
import { BrandLogo } from '../../ui/BrandLogo';
import { HeaderBanner } from '../../ui/HeaderBanner';
import { SectionIcon } from '../../ui/SectionIcon';
import { TheTrail, CompassSync } from '../../ui/ScoutMotifs';
import { TopographicBackground } from '../../ui/TopographicBackground';

export function HomeView() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div>
      {/* 1. FASCIA FOTOGRAFICA D'INTESTAZIONE */}
      <HeaderBanner
        photoId="home"
        isHome={true}
        title={I18N.app.shortTitle}
        section="neutral"
      />

      <div className="container" style={{ position: 'relative' }}>
        {/* 2. TARGA BIANCA DEL LOGO (IL PROTAGONISTA A CAVALLO DELLA FOTO) */}
        <div className="home-logo-medallion">
          <BrandLogo
            variant="completo"
            withTarga={true}
            priority={true}
            className="brand-logo-completo"
          />
        </div>

        {/* 3. INTESTAZIONE TESTUALE E MOTIVO SCOUT IL SENTIERO */}
        <header style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h1 className="home-title-display">
            {I18N.app.title}
          </h1>
          <p className="home-subtitle-display">
            {I18N.app.subtitle}
          </p>

          {/* Motivo Scout: The Trail (Il Sentiero con punto giallo) */}
          <div style={{ maxWidth: '280px', margin: '0 auto' }}>
            <TheTrail className="scout-trail-home" />
          </div>
        </header>

        {/* 4. BARRA DI RICERCA GLOBALE RAPIDA */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <SearchField
            value={searchQuery}
            onInput={setSearchQuery}
            placeholder={I18N.search.placeholderGlobale}
            aria-label={I18N.search.placeholderGlobale}
          />
        </div>

        {/* 5. CARD PROSSIMO EVENTO (CALENDARIO DA PARETE) */}
        <div
          className="home-event-card"
          role="button"
          tabIndex={0}
          onClick={() => navigate('calendario')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('calendario');
            }
          }}
          aria-label="Prossimo evento: Uscita dei Passaggi sui Sibillini"
        >
          <div className="calendar-date-block" aria-hidden="true">
            <div className="calendar-date-month">OTT</div>
            <div className="calendar-date-day">19</div>
            <div className="calendar-date-weekday">SAB</div>
          </div>
          <div className="home-event-body">
            <div className="home-event-header">
              <span className="event-type-chip event-chip-uscita">Uscita</span>
              <span className="home-event-countdown">Tra 4 giorni</span>
            </div>
            <div className="home-event-title">Uscita dei Passaggi sui Sibillini</div>
            <div className="home-event-meta">
              <span>Partenza ore 08:30 • Sede</span>
              <span>3 punti all'ODG</span>
            </div>
          </div>
        </div>

        {/* 6. TESSERE A TINTA UNITA 2X2 (ARCHIVIO DELLE 4 AREE) */}
        <div className="home-tiles-grid" role="navigation" aria-label="Aree archivio">
          <div
            className="home-tile"
            role="button"
            tabIndex={0}
            onClick={() => navigate('giochi')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('giochi');
              }
            }}
          >
            <div className="home-tile-header">
              <SectionIcon section="giochi" size="md" />
              <span className="home-tile-count">24</span>
            </div>
            <div>
              <h2 className="home-tile-title">{I18N.nav.giochi}</h2>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Regole e materiali
              </p>
            </div>
          </div>

          <div
            className="home-tile"
            role="button"
            tabIndex={0}
            onClick={() => navigate('bans')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('bans');
              }
            }}
          >
            <div className="home-tile-header">
              <SectionIcon section="bans" size="md" />
              <span className="home-tile-count">18</span>
            </div>
            <div>
              <h2 className="home-tile-title">{I18N.nav.bans}</h2>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Gesti e fuochi serali
              </p>
            </div>
          </div>

          <div
            className="home-tile"
            role="button"
            tabIndex={0}
            onClick={() => navigate('canti')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('canti');
              }
            }}
          >
            <div className="home-tile-header">
              <SectionIcon section="canti" size="md" />
              <span className="home-tile-count">56</span>
            </div>
            <div>
              <h2 className="home-tile-title">{I18N.nav.canti}</h2>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Accordi e trasposizione
              </p>
            </div>
          </div>

          <div
            className="home-tile"
            role="button"
            tabIndex={0}
            onClick={() => navigate('calendario')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('calendario');
              }
            }}
          >
            <div className="home-tile-header">
              <SectionIcon section="calendario" size="md" />
              <span className="home-tile-count">6</span>
            </div>
            <div>
              <h2 className="home-tile-title">{I18N.nav.calendario}</h2>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Attività e punti ODG
              </p>
            </div>
          </div>
        </div>

        {/* 7. AGGIUNTI DI RECENTE */}
        <GroupedList header="AGGIUNTI DI RECENTE">
          <GroupedRow
            leading={<SectionIcon section="giochi" size="sm" />}
            title="Palla Avvelenata dei Clan"
            subtitle="All'aperto • Regole e varianti"
            trailing={<Badge variant="giallo" size="sm">Nuovo</Badge>}
            chevron
            onClick={() => navigate('giochi')}
          />
          <GroupedRow
            leading={<SectionIcon section="canti" size="sm" />}
            title="Strade e Pensieri per Domani"
            subtitle="Canzoniere • Con accordi per chitarra"
            trailing={<Badge variant="giallo" size="sm">Nuovo</Badge>}
            chevron
            onClick={() => navigate('canti')}
          />
          <GroupedRow
            leading={<SectionIcon section="bans" size="sm" />}
            title="Il Grillo e la Formica"
            subtitle="Fuoco di bivacco • Animazione e cori"
            chevron
            onClick={() => navigate('bans')}
          />
          <GroupedRow
            leading={<SectionIcon section="calendario" size="sm" />}
            title="Route Invernale 2026"
            subtitle="3 giorni in rifugio appenninico"
            trailing={<span className="event-type-chip event-chip-uscita">Uscita</span>}
            chevron
            onClick={() => navigate('calendario')}
          />
        </GroupedList>

        {/* 8. STATO E BUSSOLA SCOUT */}
        <GroupedList header="STATO E SINCRONIZZAZIONE">
          <GroupedRow
            leading={<CompassSync isSyncing={false} size={24} />}
            title="Archivio Locale e Offline"
            subtitle="100% disponibile e leggibile senza rete"
            trailing={<Badge variant="azzurro" size="sm">Sincronizzato</Badge>}
          />
        </GroupedList>

        {/* 9. STRUMENTI & DESIGN SYSTEM */}
        <GroupedList header="STRUMENTI">
          <GroupedRow
            leading={<SectionIcon section="stampa" size="sm" />}
            title={I18N.stampa.title}
            subtitle="Componi fascicoli cartacei A4 per uscite e campi"
            chevron
            onClick={() => navigate('stampa')}
          />
          <GroupedRow
            leading={<SectionIcon section="admin" size="sm" />}
            title="Sistema di Design (FASE 1B)"
            subtitle="Verifica palette OKLCH, 5 foto, targa e motivi scout"
            chevron
            onClick={() => navigate('design')}
          />
        </GroupedList>

        {/* 10. SFONDO TOPOGRAFICO CON ISOIPSE CARTOGRAFICHE */}
        <TopographicBackground />
      </div>
    </div>
  );
}
