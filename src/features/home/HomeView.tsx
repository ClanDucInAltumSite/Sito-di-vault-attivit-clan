import { useState, useEffect } from 'preact/hooks';
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
import { Icon } from '../../ui/Icon';
import { PwaInstallGuide } from '../../ui/PwaInstallGuide';
import {
  getSectionCounts,
  getRecentItems,
  getNextUpcomingEvent,
  RecentItem,
  Evento,
} from '../../lib/db';
import {
  getWallCalendarDate,
  getEventCountdownText,
  getEventTypeInfo,
} from '../../lib/calendario';
import {
  subscribeSyncState,
  syncNow,
  SyncState,
  getSyncState,
} from '../../lib/sync';
import { useAdmin } from '../../lib/auth';

export function HomeView() {
  const { isAdmin } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState({ giochi: 0, bans: 0, canti: 0, calendario: 0 });
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [nextEventData, setNextEventData] = useState<{
    evento: Evento;
    odgCount: number;
    openOdgCount: number;
  } | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [secCounts, recents, nextEv] = await Promise.all([
        getSectionCounts(),
        getRecentItems(4),
        getNextUpcomingEvent(),
      ]);
      setCounts(secCounts);
      setRecentItems(recents);
      setNextEventData(nextEv);
    } catch (err) {
      console.error('Errore caricamento dati home da IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Aggiorna quando lo stato di sincronizzazione cambia
    const unsubscribe = subscribeSyncState((state) => {
      setSyncState(state);
      loadData();
    });

    return () => unsubscribe();
  }, []);

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

        {/* 4. GUIDA DI INSTALLAZIONE PWA AL PRIMO UTILIZZO (DISMISSIBILE) */}
        <PwaInstallGuide />

        {/* 5. BARRA DI RICERCA GLOBALE RAPIDA */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <SearchField
            value={searchQuery}
            onInput={setSearchQuery}
            placeholder={I18N.search.placeholderGlobale}
            aria-label={I18N.search.placeholderGlobale}
          />
        </div>

        {/* 6. CARD PROSSIMO EVENTO (CALENDARIO DA PARETE) CON STATO VUOTO CURATO */}
        {nextEventData ? (
          (() => {
            const dateInfo = getWallCalendarDate(nextEventData.evento.inizio);
            const countdown = getEventCountdownText(nextEventData.evento);
            const typeInfo = getEventTypeInfo(nextEventData.evento.tipo);
            const openOdg = nextEventData.openOdgCount ?? 0;
            const timeStr = nextEventData.evento.tutto_il_giorno
              ? 'Tutto il giorno'
              : `Ore ${new Date(nextEventData.evento.inizio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;

            return (
              <div
                className="home-event-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`calendario?id=${nextEventData.evento.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`calendario?id=${nextEventData.evento.id}`);
                  }
                }}
                aria-label={`Prossimo evento: ${nextEventData.evento.titolo}`}
              >
                <div
                  className={`calendar-date-block ${dateInfo.isToday ? 'calendar-date-block-today' : ''}`}
                  aria-hidden="true"
                >
                  <div className="calendar-date-month">{dateInfo.month}</div>
                  <div className="calendar-date-day">{dateInfo.day}</div>
                  <div className="calendar-date-weekday">{dateInfo.weekday}</div>
                </div>
                <div className="home-event-body">
                  <div className="home-event-header">
                    <span className={typeInfo.chipClass}>{typeInfo.label}</span>
                    <span
                      className="home-event-countdown"
                      style={dateInfo.isToday ? { color: 'var(--color-bans)' } : undefined}
                    >
                      {countdown}
                    </span>
                  </div>
                  <div className="home-event-title">{nextEventData.evento.titolo}</div>
                  <div className="home-event-meta">
                    <span>
                      {timeStr}
                      {nextEventData.evento.luogo ? ` • ${nextEventData.evento.luogo}` : ''}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {openOdg > 0 ? (
                        <>
                          <span className="odg-open-badge">{openOdg}</span>
                          <span>punt{openOdg === 1 ? 'o' : 'i'} ODG apert{openOdg === 1 ? 'o' : 'i'}</span>
                        </>
                      ) : nextEventData.odgCount > 0 ? (
                        <span>Tutti i {nextEventData.odgCount} punti ODG completati</span>
                      ) : (
                        <span>ODG in definizione</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div
            className="home-event-card"
            style={{ opacity: 0.9 }}
            role="button"
            tabIndex={0}
            onClick={() => navigate('calendario')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('calendario');
              }
            }}
            aria-label="Nessun evento in programma. Tocca per aprire il calendario."
          >
            <div className="calendar-date-block" aria-hidden="true">
              <div className="calendar-date-month">—</div>
              <div className="calendar-date-day">--</div>
              <div className="calendar-date-weekday">CAL</div>
            </div>
            <div className="home-event-body">
              <div className="home-event-header">
                <span className="event-type-chip">In attesa</span>
                <span className="home-event-countdown">Prossime date</span>
              </div>
              <div className="home-event-title">Nessun evento in programma</div>
              <div className="home-event-meta">
                <span>Tocca per consultare o pianificare uscite e riunioni</span>
              </div>
            </div>
          </div>
        )}

        {/* 7. TESSERE A TINTA UNITA 2X2 COLLEGATE AL DATABASE LOCALE */}
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
              <span className="home-tile-count tabular-nums">
                {isLoading ? '…' : counts.giochi}
              </span>
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
              <span className="home-tile-count tabular-nums">
                {isLoading ? '…' : counts.bans}
              </span>
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
              <span className="home-tile-count tabular-nums">
                {isLoading ? '…' : counts.canti}
              </span>
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
              <span className="home-tile-count tabular-nums">
                {isLoading ? '…' : counts.calendario}
              </span>
            </div>
            <div>
              <h2 className="home-tile-title">{I18N.nav.calendario}</h2>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Attività e punti ODG
              </p>
            </div>
          </div>
        </div>

        {/* 8. AGGIUNTI DI RECENTE (DINAMICO DA INDEXEDDB LOCALE) */}
        <GroupedList header="AGGIUNTI DI RECENTE">
          {recentItems.length > 0 ? (
            recentItems.map((item) => (
              <GroupedRow
                key={`${item.section}-${item.id}`}
                leading={<SectionIcon section={item.section} size="sm" />}
                title={item.title}
                subtitle={item.subtitle}
                trailing={
                  item.extraChip ? (
                    <span className="event-type-chip event-chip-uscita">{item.extraChip}</span>
                  ) : item.isNew ? (
                    <Badge variant="giallo" size="sm">Nuovo</Badge>
                  ) : undefined
                }
                chevron
                onClick={() => navigate(item.section)}
              />
            ))
          ) : (
            <GroupedRow
              leading={<Icon name="info" size={20} />}
              title="Nessun elemento recente nell'archivio locale"
              subtitle={syncState.status === 'syncing' ? 'Sincronizzazione in corso...' : 'Tocca qui per avviare il download dei dati.'}
              onClick={() => syncNow({ trigger: 'home_empty_click' })}
            />
          )}
        </GroupedList>

        {/* 9. STATO E BUSSOLA SCOUT VIVA */}
        <GroupedList header="STATO E SINCRONIZZAZIONE">
          <GroupedRow
            leading={<CompassSync isSyncing={syncState.status === 'syncing'} size={24} />}
            title={
              syncState.status === 'syncing'
                ? 'Sincronizzazione in corso…'
                : syncState.isOnline
                ? 'Archivio Locale e Offline'
                : 'Modalità Offline (Sola Lettura)'
            }
            subtitle={
              syncState.lastSyncCompletedAt
                ? `Ultimo aggiornamento: ${new Date(syncState.lastSyncCompletedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} • 100% disponibile offline`
                : 'In attesa di completamento primo download'
            }
            trailing={
              <Badge
                variant={
                  syncState.status === 'syncing'
                    ? 'azzurro'
                    : syncState.isOnline
                    ? 'azzurro'
                    : 'giallo'
                }
                size="sm"
              >
                {syncState.status === 'syncing'
                  ? 'In corso'
                  : syncState.isOnline
                  ? 'Aggiornato'
                  : 'Offline'}
              </Badge>
            }
            chevron={isAdmin}
            onClick={isAdmin ? () => navigate('stato-dati') : undefined}
          />
        </GroupedList>

        {/* 10. STRUMENTI */}
        <GroupedList header="STRUMENTI">
          <GroupedRow
            leading={<SectionIcon section="stampa" size="sm" />}
            title={I18N.stampa.title}
            subtitle="Componi fascicoli cartacei A4 per uscite e campi"
            chevron
            onClick={() => navigate('stampa')}
          />
        </GroupedList>
      </div>
    </div>
  );
}
