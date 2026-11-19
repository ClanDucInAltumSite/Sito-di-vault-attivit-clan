import { useState, useEffect, useMemo } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { navigate } from '../../app/router';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { Badge } from '../../ui/Badge';
import { BrandLogo } from '../../ui/BrandLogo';
import { HeaderBanner } from '../../ui/HeaderBanner';
import { SectionIcon } from '../../ui/SectionIcon';
import { TheTrail } from '../../ui/ScoutMotifs';
import { Icon } from '../../ui/Icon';
import { PwaInstallGuide } from '../../ui/PwaInstallGuide';
import {
  getSectionCounts,
  getNextUpcomingEvent,
  Evento,
} from '../../lib/db';
import {
  getWallCalendarDate,
  getEventCountdownText,
  getEventTypeInfo,
  isEventoOrariDaDefinire,
  formatEventDateTimeRange,
} from '../../lib/calendario';
import {
  subscribeSyncState,
} from '../../lib/sync';
import { useAdmin } from '../../lib/auth';
import { openPdfDocument } from '../../lib/pdf_utils';
import { Button } from '../../ui/Button';
import { lazy, Suspense } from 'preact/compat';
import {
  getVademecumItems,
  subscribeVademecum,
  deleteVademecumItem,
  VademecumItem,
  VademecumDocType,
  DEFAULT_VADEMECUM_ITEMS,
} from '../../lib/vademecum';
import {
  getPropostePerVisualizzazione,
  approvaPropostaAdmin,
  ritiraPropostaLocale,
  subscribeProposte,
  PropostaItem,
} from '../../lib/proposte';
import { HEADER_PHOTOS } from '../../lib/photos';
import { Toast } from '../../ui/Toast';

function stripMarkdownPreview(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/==([a-z]+:)?(.*?)==/g, '$2')
    .replace(/[#*`_~>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VademecumWideReadingMode = lazy(() =>
  import('../vademecum/VademecumWideReadingMode').then((m) => ({ default: m.VademecumWideReadingMode }))
);
const VademecumEditSheet = lazy(() =>
  import('../vademecum/VademecumEditSheet').then((m) => ({ default: m.VademecumEditSheet }))
);
const CartaFotoEditModal = lazy(() =>
  import('../vademecum/CartaFotoEditModal').then((m) => ({ default: m.CartaFotoEditModal }))
);
const QuadernoDocEditor = lazy(() =>
  import('../quaderno/QuadernoDocEditor').then((m) => ({ default: m.QuadernoDocEditor }))
);

const RifiutaPropostaModal = lazy(() =>
  import('../admin/RifiutaPropostaModal').then((m) => ({ default: m.RifiutaPropostaModal }))
);
const DeleteConfirmModal = lazy(() =>
  import('../../ui/DeleteConfirmModal').then((m) => ({ default: m.DeleteConfirmModal }))
);

export function HomeView() {
  const { isAdmin } = useAdmin();
  const [counts, setCounts] = useState({ giochi: 0, bans: 0, canti: 0, calendario: 0, quaderno: 0 });
  const [nextEventData, setNextEventData] = useState<{
    evento: Evento;
    odgCount: number;
    openOdgCount: number;
  } | null>(null);
  const [vademecumItems, setVademecumItems] = useState<VademecumItem[]>([]);
  const [pendingCanovacciIds, setPendingCanovacciIds] = useState<Set<string>>(new Set());
  const [pendingProposteMap, setPendingProposteMap] = useState<Map<string, PropostaItem>>(new Map());
  const [rejectingProposta, setRejectingProposta] = useState<PropostaItem | null>(null);
  const [selectedWideDoc, setSelectedWideDoc] = useState<VademecumItem | null>(null);
  const [isWideOpen, setIsWideOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VademecumItem | null>(null);
  const [editingSection, setEditingSection] = useState<VademecumDocType>('carta_clan');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<VademecumItem | null>(null);
  const [isCartaPhotoOpen, setIsCartaPhotoOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [secCounts, nextEv, vademecumData, proposteCanovacci] = await Promise.all([
        getSectionCounts(),
        getNextUpcomingEvent(),
        getVademecumItems(),
        getPropostePerVisualizzazione('canovacci', isAdmin),
      ]);
      setCounts(secCounts);
      setNextEventData(nextEv);

      const pendingMap = new Set<string>();
      const propMap = new Map<string, PropostaItem>();
      const convertedPending: VademecumItem[] = proposteCanovacci.map((p) => {
        pendingMap.add(p.id);
        propMap.set(p.id, p);
        const d = p.dati as Partial<VademecumItem>;
        return {
          id: p.id,
          section: 'canovaccio' as const,
          titolo: p.titolo,
          descrizioneBreve: d.descrizioneBreve || '',
          contenuto: d.contenuto || '',
          pdfNome: d.pdfNome || null,
          pdfDataUrl: d.pdfDataUrl || null,
          pdfSize: d.pdfSize || null,
          updatedAt: p.created_at,
        };
      });
      setPendingCanovacciIds(pendingMap);
      setPendingProposteMap(propMap);
      setVademecumItems([...convertedPending, ...vademecumData]);
    } catch (err) {
      console.error('Errore caricamento dati home da IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Aggiorna quando lo stato di sincronizzazione cambia
    const unsubscribeSync = subscribeSyncState(() => {
      loadData();
    });

    // Aggiorna in tempo reale quando un documento Vademecum viene salvato
    const unsubscribeVademecum = subscribeVademecum(() => {
      loadData();
    });

    // Aggiorna in tempo reale quando una proposta locale viene aggiunta o ritirata
    const unsubscribeProposte = subscribeProposte(() => {
      loadData();
    });

    return () => {
      unsubscribeSync();
      unsubscribeVademecum();
      unsubscribeProposte();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const cartaDoc =
    vademecumItems.find((d: VademecumItem) => d.section === 'carta_clan') ||
    DEFAULT_VADEMECUM_ITEMS.find((d: VademecumItem) => d.id === 'carta_clan');
  const regoleDoc =
    vademecumItems.find((d: VademecumItem) => d.section === 'regole_clan') ||
    DEFAULT_VADEMECUM_ITEMS.find((d: VademecumItem) => d.id === 'regole_clan');
  const canovacciList = vademecumItems.filter((d) => d.section === 'canovaccio');

  const regoleSnippet = useMemo(() => {
    const clean = stripMarkdownPreview(regoleDoc?.contenuto || '');
    if (!clean) return '';
    return clean.slice(0, 160) + (clean.length > 160 ? '…' : '');
  }, [regoleDoc?.contenuto]);

  const handleOpenWideDoc = (item: VademecumItem | undefined) => {
    if (!item) return;
    setSelectedWideDoc(item);
    setIsWideOpen(true);
  };

  const handleOpenEdit = (item: VademecumItem | undefined, section: VademecumDocType) => {
    setEditingItem(item || null);
    setEditingSection(section);
    setIsEditOpen(true);
  };

  const handleCreateNewCanovaccio = () => {
    setEditingItem(null);
    setEditingSection('canovaccio');
    setIsEditOpen(true);
  };

  const handleDeleteRequest = (item: VademecumItem) => {
    setDeletingItem(item);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    try {
      await deleteVademecumItem(deletingItem.id);
      await loadData();
      setIsDeleteOpen(false);
      setDeletingItem(null);
    } catch (err) {
      console.error('Errore eliminazione canovaccio:', err);
    }
  };

  const handleRitiraProposta = async (id: string) => {
    try {
      await ritiraPropostaLocale(id);
      await loadData();
    } catch (err) {
      console.error('Errore ritiro proposta canovaccio:', err);
    }
  };

  const handleOpenPdf = (item: VademecumItem) => {
    if (!item.pdfDataUrl) return;
    openPdfDocument(item.pdfDataUrl, item.pdfNome || item.titolo);
  };

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
          <TheTrail className="scout-trail-home" />
        </header>

        {/* 4. GUIDA DI INSTALLAZIONE PWA AL PRIMO UTILIZZO (DISMISSIBILE) */}
        <PwaInstallGuide />

        {/* 4b. AVVISO PROPOSTE DA APPROVARE PER L'ADMIN */}
        {isAdmin && pendingProposteMap.size > 0 && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '14px',
              backgroundColor: 'var(--color-bans-tenue, #FFF8E1)',
              border: '1px solid var(--color-bans, #FF9800)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: 'var(--space-4, 16px)',
              boxShadow: 'var(--shadow-rest)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icon name="admin" size={24} style={{ color: 'var(--color-bans-badge-text, #E65100)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-ink)' }}>
                  {pendingProposteMap.size === 1 ? '1 proposta in attesa di approvazione' : `${pendingProposteMap.size} proposte in attesa di approvazione`}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Controlla e approva i nuovi contenuti inviati dai membri.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="ios-btn ios-btn-primary ios-btn-sm"
              onClick={() => navigate('admin')}
              style={{ flexShrink: 0 }}
            >
              Revisiona
            </button>
          </div>
        )}

        {/* 5. CARD PROSSIMO EVENTO (CALENDARIO DA PARETE) CON STATO VUOTO CURATO */}
        {nextEventData ? (
          (() => {
            const dateInfo = getWallCalendarDate(nextEventData.evento.inizio, false, nextEventData.evento.tipo);
            const countdown = getEventCountdownText(nextEventData.evento);
            const typeInfo = getEventTypeInfo(nextEventData.evento.tipo);
            const openOdg = nextEventData.openOdgCount ?? 0;
            const isDateOnly = isEventoOrariDaDefinire(nextEventData.evento) || nextEventData.evento.tutto_il_giorno;
            const timeStr = isDateOnly
              ? formatEventDateTimeRange(nextEventData.evento)
              : `Ore ${new Date(nextEventData.evento.inizio).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
            const hasLuogo = Boolean(nextEventData.evento.luogo && nextEventData.evento.luogo.trim());

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
                  className={`calendar-date-block calendar-date-block-${nextEventData.evento.tipo || 'altro'} ${dateInfo.isToday ? 'calendar-date-block-today' : ''}`}
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
                      style={dateInfo.isToday ? { color: typeInfo.colorVar, fontWeight: 700 } : undefined}
                    >
                      {countdown}
                    </span>
                  </div>
                  <div className="home-event-title">{nextEventData.evento.titolo}</div>
                  <div className="home-event-meta">
                    <span style={dateInfo.isToday ? { color: typeInfo.colorVar, fontWeight: 600 } : undefined}>
                      {timeStr}
                      {hasLuogo ? ` • ${nextEventData.evento.luogo}` : ''}
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
              <div className="calendar-date-month">-</div>
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

          {/* TESSERA QUADERNO DI CLAN */}
          <div
            className="home-tile"
            role="button"
            tabIndex={0}
            onClick={() => navigate('quaderno')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('quaderno');
              }
            }}
            style={{ gridColumn: 'span 2' }}
          >
            <div className="home-tile-header">
              <SectionIcon section="quaderno" size="md" />
              <span className="home-tile-count tabular-nums">
                {isLoading ? '…' : counts.quaderno}
              </span>
            </div>
            <div>
              <h2 className="home-tile-title">{I18N.quaderno.title}</h2>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {I18N.quaderno.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* 7. CARTA DI CLAN (FOTO HERO CARD CON LETTURA AMPIA) */}
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <span className="section-title-sm">CARTA DI CLAN</span>
        </div>

        <div
          className="carta-hero-card"
          role="button"
          tabIndex={0}
          onClick={() => handleOpenWideDoc(cartaDoc)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenWideDoc(cartaDoc);
            }
          }}
          aria-label={`Apri Carta di Clan: ${cartaDoc?.titolo || 'Carta di Clan'}`}
        >
          <img
            src={cartaDoc?.fotoCopertinaUrl || HEADER_PHOTOS.home.src}
            srcSet={cartaDoc?.fotoCopertinaUrl ? undefined : HEADER_PHOTOS.home.srcset}
            sizes="(max-width: 600px) 400px, 800px"
            alt={cartaDoc?.fotoCopertinaUrl ? `Foto di copertina per ${cartaDoc.titolo}` : HEADER_PHOTOS.home.alt}
            className="carta-hero-img"
            loading="lazy"
            width={800}
            height={400}
          />
          <div className="carta-hero-scrim" />
          <div className="carta-hero-content">
            <div className="carta-hero-badge-wrap">
              <Badge variant="azzurro" size="sm">Documento Fondamentale</Badge>
              {cartaDoc?.pdfNome && <Badge variant="nuovo" size="sm">PDF Disponibile</Badge>}
              {isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="carta-hero-admin-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(cartaDoc, 'carta_clan');
                    }}
                    title="Modifica Carta di Clan"
                    aria-label="Modifica Carta di Clan"
                  >
                    <Icon name="edit" size={13} />
                    <span>Modifica</span>
                  </button>
                  <button
                    type="button"
                    className="carta-hero-admin-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCartaPhotoOpen(true);
                    }}
                    title="Modifica foto della Carta di Clan"
                    aria-label="Modifica foto della Carta di Clan"
                  >
                    <Icon name="camera" size={13} />
                    <span>Foto</span>
                  </button>
                </div>
              )}
            </div>
            <h3 className="carta-hero-title">{cartaDoc?.titolo || 'Carta di Clan'}</h3>
            <p className="carta-hero-desc">
              {cartaDoc?.descrizioneBreve || 'I valori, la legge della strada e gli impegni comunitari del Clan'}
            </p>
            <div className="carta-hero-cta">
              <span>Leggi la Carta a grande schermo</span>
              <Icon name="chevron-right" size={15} />
            </div>
          </div>
        </div>

        {/* 10. REGOLE DEL CLAN (CARD SENZA FOTO CON PREVIEW E LETTURA AMPIA) */}
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <span className="section-title-sm">REGOLE DEL CLAN</span>
        </div>

        <div
          className="regole-hero-card"
          role="button"
          tabIndex={0}
          onClick={() => handleOpenWideDoc(regoleDoc)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenWideDoc(regoleDoc);
            }
          }}
          aria-label={`Apri Regole del Clan: ${regoleDoc?.titolo || 'Regole del Clan'}`}
        >
          <div className="regole-hero-content">
            <div className="regole-hero-badge-wrap">
              <Badge variant="giallo" size="sm">Patto di Convivenza</Badge>
              {regoleDoc?.pdfNome && <Badge variant="nuovo" size="sm">PDF Disponibile</Badge>}
              {isAdmin && (
                <button
                  type="button"
                  className="regole-hero-admin-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(regoleDoc, 'regole_clan');
                  }}
                  title="Modifica Regole del Clan"
                  aria-label="Modifica Regole del Clan"
                >
                  <Icon name="edit" size={13} />
                  <span>Modifica</span>
                </button>
              )}
            </div>

            <h3 className="regole-hero-title">{regoleDoc?.titolo || 'Regole del Clan'}</h3>
            <p className="regole-hero-desc">
              {regoleDoc?.descrizioneBreve || 'Patto di convivenza, orari, sede, telefoni e cassa'}
            </p>

            {regoleSnippet && (
              <p className="regole-hero-preview">
                {regoleSnippet}
              </p>
            )}

            <div className="regole-hero-cta">
              <span>Leggi le Regole a grande schermo</span>
              <Icon name="chevron-right" size={15} />
            </div>
          </div>
        </div>

        {/* 11. CANOVACCI PER PATTUGLIE (GRIGLIA IN EVIDENZA) */}
        <div className="canovacci-section">
          <div className="canovacci-section-header">
            <div className="canovacci-section-title-wrap">
              <div className="section-sq-icon section-sq-giochi section-sq-md" aria-hidden="true">
                <Icon name="file" size={18} />
              </div>
              <div>
                <h3 className="canovacci-section-title">Canovacci per Pattuglie</h3>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Tracce operative e presentazioni per uscite, veglie e attività
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateNewCanovaccio}
            >
              <Icon name="plus" size={14} />
              <span>{isAdmin ? 'Nuovo Canovaccio' : 'Proponi Canovaccio'}</span>
            </Button>
          </div>

          <div className="canovacci-grid">
            {canovacciList.map((item) => {
              const isPending = pendingCanovacciIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`canovaccio-home-card ${isPending ? 'proposta-pending-card' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenWideDoc(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenWideDoc(item);
                    }
                  }}
                  aria-label={`Apri Canovaccio: ${item.titolo}`}
                >
                  {isPending && (
                    <div className="proposta-pending-badge-row">
                      <Badge variant="giallo" size="sm">In attesa di approvazione</Badge>
                    </div>
                  )}
                  <div className="canovaccio-home-header">
                    <div className="canovaccio-home-info">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <h4 className="canovaccio-home-title">{item.titolo}</h4>
                        {item.pdfNome && <Badge variant="azzurro" size="sm">PDF</Badge>}
                      </div>
                      {item.descrizioneBreve && (
                        <p className="canovaccio-home-desc">{item.descrizioneBreve}</p>
                      )}
                      {isPending && (
                        <div className="proposta-pending-caption">
                          {isAdmin && pendingProposteMap.get(item.id)?.proponente_nome
                            ? `Proposto da: ${pendingProposteMap.get(item.id)?.proponente_nome} • In attesa di approvazione`
                            : isAdmin
                            ? 'In attesa di approvazione dell\'Admin'
                            : 'Visibile solo su questo dispositivo fino all\'approvazione dell\'Admin'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="canovaccio-home-actions">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {item.pdfDataUrl && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPdf(item);
                          }}
                        >
                          <Icon name="file" size={14} />
                          <span>Apri PDF</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenWideDoc(item);
                        }}
                      >
                        <Icon name="book-open" size={14} />
                        <span>Leggi traccia</span>
                      </Button>
                    </div>

                    {isAdmin && isPending ? (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const prop = pendingProposteMap.get(item.id);
                            if (prop) setRejectingProposta(prop);
                          }}
                        >
                          <Icon name="close" size={14} />
                          <span>Rifiuta</span>
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const prop = pendingProposteMap.get(item.id);
                            if (prop) {
                              await approvaPropostaAdmin(prop);
                              await loadData();
                            }
                          }}
                        >
                          <Icon name="check" size={14} />
                          <span>Approva</span>
                        </Button>
                      </div>
                    ) : isPending ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRitiraProposta(item.id);
                        }}
                        style={{ color: 'var(--color-bans)' }}
                      >
                        <Icon name="trash" size={14} />
                        <span>Ritira</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 12. STRUMENTI */}
        <GroupedList header="STRUMENTI">
          <GroupedRow
            leading={<SectionIcon section="stampa" size="sm" />}
            title={I18N.stampa.title}
            subtitle="Componi fascicoli cartacei A4 per uscite e campi"
            chevron
            onClick={() => navigate('stampa')}
          />
        </GroupedList>

        {/* 14. MODALI E FOGLI LAZY */}
        <Suspense fallback={null}>
          {isWideOpen && (
            <VademecumWideReadingMode
              item={selectedWideDoc}
              isOpen={isWideOpen}
              onClose={() => {
                setIsWideOpen(false);
                setSelectedWideDoc(null);
              }}
              onItemUpdated={(updated) => {
                setSelectedWideDoc(updated);
                loadData();
              }}
              onDelete={(itemToDelete) => {
                handleDeleteRequest(itemToDelete);
              }}
            />
          )}

          {isEditOpen && (
            (editingSection === 'carta_clan' || editingSection === 'regole_clan') ? (
              <QuadernoDocEditor
                vademecumItem={editingItem}
                isOpen={isEditOpen}
                onClose={() => {
                  setIsEditOpen(false);
                  loadData();
                }}
              />
            ) : (
              <VademecumEditSheet
                item={editingItem}
                section={editingSection}
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                onSaved={() => {
                  loadData();
                  setIsEditOpen(false);
                }}
              />
            )
          )}

          {isDeleteOpen && (
            <DeleteConfirmModal
              isOpen={isDeleteOpen}
              onClose={() => setIsDeleteOpen(false)}
              onConfirm={handleDeleteConfirm}
              itemName={deletingItem?.titolo || ''}
              itemTypeLabel="canovaccio"
            />
          )}

          {isCartaPhotoOpen && (
            <CartaFotoEditModal
              isOpen={isCartaPhotoOpen}
              cartaDoc={cartaDoc || null}
              onClose={() => setIsCartaPhotoOpen(false)}
              onSaved={(_updated: VademecumItem) => {
                loadData();
                setIsCartaPhotoOpen(false);
                setToastMessage('Foto della Carta di Clan aggiornata');
              }}
            />
          )}

          {/* Modal In-App Rifiuta Proposta e Blocco Utente (Admin) */}
          <RifiutaPropostaModal
            proposta={rejectingProposta}
            isOpen={Boolean(rejectingProposta)}
            onClose={() => setRejectingProposta(null)}
            onSuccess={async () => {
              await loadData();
            }}
          />
        </Suspense>

        {/* Notifica Toast Feedback */}
        {toastMessage && (
          <Toast
            message={toastMessage}
            type="success"
            onClose={() => setToastMessage(null)}
          />
        )}
      </div>
    </div>
  );
}
