import { useState } from 'preact/hooks';
import { navigate } from '../../app/router';
import { Button } from '../../ui/Button';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { BottomSheet } from '../../ui/BottomSheet';
import { Badge } from '../../ui/Badge';
import { Toast } from '../../ui/Toast';
import { Icon } from '../../ui/Icon';
import { BrandLogo } from '../../ui/BrandLogo';
import { SectionIcon } from '../../ui/SectionIcon';
import { TheTrail, CompassSync } from '../../ui/ScoutMotifs';
import { PHOTOS } from '../../lib/photos';
import { HighlightText } from '../../lib/search';
import { DeleteConfirmModal } from '../../ui/DeleteConfirmModal';
import { BanReadingMode } from '../bans/BanReadingMode';
import { CantoReadingMode } from '../canti/CantoReadingMode';
import { ChordProRenderer } from '../../lib/chordpro';
import { Ban, Canto } from '../../lib/db';

export function DesignSystemView() {
  const [searchValue, setSearchValue] = useState('avvelenata');
  const [selectedSegment, setSelectedSegment] = useState<'tutti' | 'giochi' | 'canti'>('giochi');
  const [isSwitchOn, setIsSwitchOn] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReadingModeOpen, setIsReadingModeOpen] = useState(false);
  const [isCantoReadingOpen, setIsCantoReadingOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [demoZoomImage, setDemoZoomImage] = useState<string | null>(null);

  const demoCanto: Canto = {
    id: 'demo-canto-1',
    titolo: 'Strade e Pensieri per Domani',
    autore: 'Clan Duc In Altum',
    tonalita: 'Re',
    ritmo: 'Marcia scout',
    tempo_bpm: 112,
    misura: '4/4',
    capotasto: 2,
    testo_chordpro: `[Re]Sai da dove viene, [Sol]sai dove ti porta\n[La]questo camminare, [Re]questa strada aperta...\n\n{ritornello}\n[Sol]Canta con noi, [La]batti le mani\n[Fa#m]Danza sui passi dei [Sim]tuoi domani`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  const demoBan: Ban = {
    id: 'demo-ban-1',
    nome: 'La Macchina del Capo',
    testo: 'La macchina del capo ha un buco nella gomma,\nLa macchina del capo ha un buco nella gomma,\nLa macchina del capo ha un buco nella gomma,\nE noi la ripareremo con il chewing-gum!',
    note_gesti: 'Gesti: Al secondo giro non si dice capo ma si fa il saluto scout; al terzo non si dice macchina ma si mima il volante.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  const toggleTheme = (theme: 'auto' | 'light' | 'dark') => {
    setCurrentTheme(theme);
    const root = document.documentElement;
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
      {/* 0. INTESTAZIONE SHOWCASE */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-ink-display)', letterSpacing: '-0.025em', margin: 0 }}>
          Sistema di Design con Anima
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
          FASE 1B (FINALE) - Qualità Apple, identità del logo AGESCI, 5 fotografie e motivi vettoriali scout
        </p>
      </div>

      {/* 1. SELETTORE TEMA LIVE (CHIARO / SCURO / AUTO) */}
      <GroupedList header="1. TEMA E SUPERFICI ADATTIVE">
        <GroupedRow
          leading={<Icon name={currentTheme === 'dark' ? 'moon' : 'sun'} size={20} />}
          title="Aspetto Interfaccia"
          subtitle={`Modalità attuale: ${currentTheme.toUpperCase()} (sfondo OKLCH caldo)`}
          trailing={
            <SegmentedControl
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'light', label: 'Chiaro' },
                { value: 'dark', label: 'Scuro' },
              ]}
              value={currentTheme}
              onChange={(val) => toggleTheme(val as any)}
            />
          }
        />
      </GroupedList>

      {/* 2. IL LOGO È IL PROTAGONISTA (TARGA BIANCA INDEROGABILE) */}
      <GroupedList
        header="2. IL LOGO SULLA TARGA BIANCA (MAI SU FONDI SCURI/BLU)"
        footer="Il viola del logo e la scritta PONTE SAN GIOVANNI 1 sono leggibili al 100% solo su targa bianca pura con raggio e ombra morbida."
      >
        <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
          {/* Logo Completo con Targa */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>
              Versione Completa (Home e Centro Stampa)
            </span>
            <BrandLogo variant="completo" withTarga={true} size={210} />
          </div>

          {/* Logo Emblema con Targa Compatta */}
          <div style={{ textAlign: 'center', marginTop: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>
              Versione Emblema (Top Bar e miniature 32px)
            </span>
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: 'var(--color-targa-bg)',
                padding: '6px',
                borderRadius: '8px',
                border: '1px solid var(--color-targa-border)',
                boxShadow: 'var(--shadow-rest)',
              }}
            >
              <BrandLogo variant="emblema" size={32} />
            </div>
          </div>
        </div>
      </GroupedList>

      {/* 3. LE CINQUE FOTOGRAFIE D'INTESTAZIONE */}
      <GroupedList
        header="3. LE CINQUE FOTOGRAFIE D'INTESTAZIONE (BUDGET <= 500 KB)"
        footer="Totale 486 KB in WebP responsive (1200w, 800w, 400w), con velo scrim tinto del viola del logo (#462679)."
      >
        <div style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
          {Object.values(PHOTOS).map((photo) => (
            <div
              key={photo.id}
              style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              <div style={{ height: '70px', position: 'relative', overflow: 'hidden' }}>
                <img
                  src={photo.src}
                  alt={photo.alt}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, var(--color-photo-scrim), var(--color-photo-scrim-deep))',
                  }}
                />
              </div>
              <div style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 700, textTransform: 'capitalize', color: 'var(--color-text)' }}>
                  {photo.id}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GroupedList>

      {/* 4. QUADRATINI ARROTONDATI PIENI DI SEZIONE */}
      <GroupedList
        header="4. IDENTITÀ CROMATICA DELLE SEZIONI (STILE IMPOSTAZIONI IOS)"
        footer="Simbolo bianco a forte contrasto. Sul giallo scout, simbolo inchiostro scuro per conformità WCAG AAA."
      >
        <GroupedRow
          leading={<SectionIcon section="giochi" size="md" />}
          title="Giochi - Giallo Scout"
          subtitle="quadratino giallo pieno con glifo scuro (OKLCH L=0.83)"
          trailing={<Badge variant="giallo" size="sm">Giochi</Badge>}
        />
        <GroupedRow
          leading={<SectionIcon section="bans" size="md" />}
          title="Bans - Rosso Scout"
          subtitle="quadratino rosso pieno con glifo bianco (OKLCH L=0.55)"
          trailing={<Badge variant="rosso" size="sm">Bans</Badge>}
        />
        <GroupedRow
          leading={<SectionIcon section="canti" size="md" />}
          title="Canti - Azzurro Canzoniere"
          subtitle="quadratino azzurro pieno con glifo bianco (OKLCH L=0.53)"
          trailing={<Badge variant="azzurro" size="sm">Canti</Badge>}
        />
        <GroupedRow
          leading={<SectionIcon section="calendario" size="md" />}
          title="Calendario - Blu Notte"
          subtitle="quadratino blu notte pieno con glifo bianco (OKLCH L=0.42)"
          trailing={<span className="event-type-chip event-chip-riunione">Calendario</span>}
        />
        <GroupedRow
          leading={<SectionIcon section="stampa" size="md" />}
          title="Stampa e Admin - Grigio Neutro"
          subtitle="quadratino grigio pieno con glifo bianco (OKLCH L=0.48)"
          trailing={<Badge variant="neutral" size="sm">Strumenti</Badge>}
        />
      </GroupedList>

      {/* 5. TESSERE A TINTA UNITA 2X2 */}
      <GroupedList header="5. TESSERE 2X2 DELLA HOME">
        <div style={{ padding: 'var(--space-4)' }}>
          <div className="home-tiles-grid" style={{ marginBottom: 0 }}>
            <div className="home-tile">
              <div className="home-tile-header">
                <SectionIcon section="giochi" size="md" />
                <span className="home-tile-count">24</span>
              </div>
              <div>
                <h3 className="home-tile-title">Giochi</h3>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Regole e materiali</p>
              </div>
            </div>
            <div className="home-tile">
              <div className="home-tile-header">
                <SectionIcon section="bans" size="md" />
                <span className="home-tile-count">18</span>
              </div>
              <div>
                <h3 className="home-tile-title">Bans</h3>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Fuochi serali</p>
              </div>
            </div>
          </div>
        </div>
      </GroupedList>

      {/* 6. CARD PROSSIMO EVENTO E BLOCCO DATA CALENDARIO */}
      <GroupedList header="6. PROSSIMO EVENTO (CALENDARIO DA PARETE)">
        <div style={{ padding: 'var(--space-4)' }}>
          <div className="home-event-card" style={{ marginBottom: 0 }}>
            <div className="calendar-date-block">
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
                <span>3 punti ODG</span>
              </div>
            </div>
          </div>
        </div>
      </GroupedList>

      {/* 7. CHIP DEI TIPI DI EVENTO */}
      <GroupedList header="7. CHIP DEI TIPI DI EVENTO">
        <div style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <span className="event-type-chip event-chip-riunione">Riunione (Viola)</span>
          <span className="event-type-chip event-chip-uscita">Uscita (Verde Bosco)</span>
          <span className="event-type-chip event-chip-scadenza">Scadenza (Rosso)</span>
          <span className="event-type-chip event-chip-evento">Evento (Azzurro)</span>
          <span className="event-type-chip event-chip-altro">Altro (Neutro)</span>
        </div>
      </GroupedList>

      {/* 8. RITORNELLO CANTO E ACCORDI */}
      <GroupedList header="8. CANZONIERE: RITORNELLO E ACCORDI">
        <div style={{ padding: 'var(--space-4)' }}>
          <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8 }}>
            <span className="song-chord">Re</span> Camminiamo sui <span className="song-chord">La</span> passi della strada...
          </div>
          <div className="song-chorus-block">
            <span className="song-chorus-label">Ritornello</span>
            <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.8 }}>
              <div><span className="song-chord">Sol</span> Canta con noi, <span className="song-chord">La</span> batti le mani</div>
              <div><span className="song-chord">Fa#m</span> Danza sui passi dei <span className="song-chord">Sim</span> tuoi domani</div>
            </div>
          </div>
        </div>
      </GroupedList>

      {/* 9. EVIDENZIAZIONE RICERCA E BADGE NUOVO */}
      <GroupedList header="9. EVIDENZIAZIONE RICERCA E BADGE NUOVO">
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
              Testo evidenziato nella ricerca (.search-highlight):
            </span>
            <p style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>
              Palla <mark className="search-highlight">avvelenata</mark> dei Clan (trovato con tolleranza typo)
            </p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
              Badge "Nuovo" (sfondo giallo, testo viola):
            </span>
            <Badge variant="giallo" size="md">Nuovo</Badge>
          </div>
        </div>
      </GroupedList>

      {/* 10. MOTIVI SCOUT VETTORIALI */}
      <GroupedList header="10. MOTIVI SCOUT VETTORIALI">
        <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', alignItems: 'center' }}>
          <div style={{ width: '100%', textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>
              Il Sentiero (The Trail - linea tratteggiata che si disegna + punto giallo)
            </span>
            <TheTrail />
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--space-2)' }}>
              La Bussola di Sincronizzazione (ago bicolore oscillante)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              <CompassSync isSyncing={isSyncing} size={36} />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsSyncing(!isSyncing)}
              >
                {isSyncing ? 'Ferma Sincronizzazione' : 'Simula Sincronizzazione'}
              </Button>
            </div>
          </div>
        </div>
      </GroupedList>

      {/* 11. CONTROLLI INTERATTIVI APPLE */}
      <GroupedList header="11. CONTROLLI INTERATTIVI APPLE">
        <GroupedRow
          leading={<Icon name="search" size={20} />}
          title="Search Field con Pulisci"
          trailing={null}
        />
        <div style={{ padding: 'var(--space-2) var(--space-4) var(--space-4)' }}>
          <SearchField
            value={searchValue}
            onInput={setSearchValue}
            placeholder="Scrivi per testare la pillola di ricerca..."
          />
        </div>

        <GroupedRow
          leading={<Icon name="settings" size={20} />}
          title="Toggle Switch Nativo (51×31 px)"
          subtitle={isSwitchOn ? 'Attivo' : 'Disattivato'}
          trailing={
            <ToggleSwitch
              checked={isSwitchOn}
              onChange={setIsSwitchOn}
              aria-label="Interruttore dimostrativo"
            />
          }
        />

        <GroupedRow
          leading={<Icon name="check" size={20} />}
          title="Segmented Control"
          trailing={
            <SegmentedControl
              options={[
                { value: 'tutti', label: 'Tutti' },
                { value: 'giochi', label: 'Giochi' },
                { value: 'canti', label: 'Canti' },
              ]}
              value={selectedSegment}
              onChange={(val) => setSelectedSegment(val as any)}
            />
          }
        />

        <GroupedRow
          leading={<Icon name="refresh" size={20} />}
          title="Bottom Sheet Apple con maniglia"
          subtitle="Animazione translateY da 300ms a 60fps"
          chevron
          onClick={() => setIsSheetOpen(true)}
        />

        <GroupedRow
          leading={<Icon name="info" size={20} />}
          title="Toast a Capsula Fluttuante"
          subtitle="Compare dal basso sopra la barra di navigazione"
          chevron
          onClick={() => setShowToast(true)}
        />
      </GroupedList>

      {/* 14. SCHERMATE DI SISTEMA & COLLAUDO */}
      <GroupedList header="14. SCHERMATE DI SISTEMA & COLLAUDO">
        <GroupedRow
          leading={<Icon name="refresh" size={20} />}
          title="Schermata Stato Dati (FASE 2)"
          subtitle="Verifica conteggi tabelle, tombstone, cursori e Supabase"
          chevron
          onClick={() => navigate('stato-dati')}
        />
      </GroupedList>

      {/* 15. GIOCHI E BANS (FASE 3) */}
      <GroupedList
        header="15. COMPONENTI GIOCHI E BANS (FASE 3)"
        footer="Evidenziazione XSS-safe in giallo, tolleranza typo, eliminazione in due passaggi e modalità lettura per fuochi serali."
      >
        <GroupedRow
          leading={<SectionIcon section="giochi" size="sm" />}
          title={
            <HighlightText
              text="Palla Avvelenata dei Clan con palloni e corsa"
              query="avvelenata"
            />
          }
          subtitle="Evidenziazione ricerca sicura senza markup non validato in giallo scout"
          trailing={<Badge variant="giallo" size="sm">Nuovo</Badge>}
        />
        <GroupedRow
          leading={<Icon name="trash" size={20} />}
          title="Conferma Eliminazione a Due Passaggi"
          subtitle="Richiede la digitazione del nome esatto dell'elemento"
          chevron
          onClick={() => setIsDeleteModalOpen(true)}
        />
        <GroupedRow
          leading={<Icon name="eye" size={20} />}
          title="Modalità Lettura Bans per Fuochi Serali"
          subtitle="Testo ingrandito, alto contrasto, note gesti e Wake Lock attivo"
          chevron
          onClick={() => setIsReadingModeOpen(true)}
        />
      </GroupedList>

      {/* 11. CANZONIERE, ACCORDI CHORDPRO & MODALITÀ LETTURA */}
      <GroupedList
        header="11. CANZONIERE & ACCORDI CHORDPRO (FASE 4)"
        footer="Accordi posizionati in colonna sopra le sillabe, DOM virtuale sicuro, trasposizione semitonale e ritornello con barra gialla."
      >
        <div style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div>
              <span className="ios-badge ios-badge-sm ios-badge-azzurro">Esempio ChordPro Live</span>
              <h3 className="song-title-display" style={{ fontSize: 'var(--font-size-lg)', marginTop: '4px' }}>
                Strade e Pensieri per Domani
              </h3>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCantoReadingOpen(true)}
            >
              <Icon name="eye" size={16} />
              <span>Modalità Lettura Canti</span>
            </Button>
          </div>

          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <ChordProRenderer
              chordproText={`[Re]Sai da dove viene, [Sol]sai dove ti porta\n[La]questo camminare, [Re]questa strada aperta...\n\n{ritornello}\n[Sol]Canta con noi, [La]batti le mani\n[Fa#m]Danza sui passi dei [Sim]tuoi domani`}
              showChords={true}
              fontSizeRem={0.95}
            />
          </div>
        </div>
      </GroupedList>

      {/* 12. ALLEGATI (Fase 5: Galleria Immagini con Zoom e Documenti PDF) */}
      <GroupedList
        header="12. ALLEGATI (GALLERIA IMMAGINI E DOCUMENTI PDF)"
        footer="Compressione automatica WebP, lightbox zoom ad alta risoluzione, cache offline e schede documenti PDF con dimensioni."
      >
        <div style={{ padding: 'var(--space-4)' }}>
          <div className="attachment-section-header">
            <span className="attachment-section-title">Esempio Immagini (Con Zoom Modale)</span>
          </div>

          <div className="attachment-grid">
            <div
              className="attachment-thumb-card"
              onClick={() => setDemoZoomImage('./photos/giochi-800w.webp')}
              role="button"
              tabIndex={0}
              aria-label="Ingrandisci schema di gioco"
            >
              <img
                src="./photos/giochi-400w.webp"
                alt="Schema campo di gioco"
                className="attachment-thumb-img"
                loading="lazy"
                width={200}
                height={150}
              />
              <div className="attachment-thumb-zoom-badge">
                <Icon name="zoom-in" size={14} />
              </div>
            </div>

            <div
              className="attachment-thumb-card"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-border-subtle)' }}
            >
              <Icon name="wifi-off" size={24} style={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }} />
              <span className="attachment-offline-badge">Non scaricato</span>
            </div>
          </div>

          <div className="attachment-section-header" style={{ marginTop: 'var(--space-4)' }}>
            <span className="attachment-section-title">Esempio Documento PDF</span>
          </div>

          <div className="attachment-pdf-card">
            <div className="attachment-pdf-info">
              <div className="attachment-pdf-icon-wrap">
                <Icon name="file" size={20} />
              </div>
              <div className="attachment-pdf-details">
                <div className="attachment-pdf-title">Regolamento Completo del Gioco.pdf</div>
                <div className="attachment-pdf-meta">PDF • 342 KB • Disponibile offline</div>
              </div>
            </div>
            <button type="button" className="ios-btn ios-btn-secondary" style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)' }}>
              <Icon name="eye" size={14} />
              <span style={{ marginLeft: '4px' }}>Apri</span>
            </button>
          </div>
        </div>
      </GroupedList>

      {/* 18. CENTRO STAMPA A4 E SCHEDE A4 (FASE 6) */}
      <GroupedList
        header="18. CENTRO STAMPA A4 (FASE 6)"
        footer="Regole CSS @media print senza pop-up, nero su bianco inchiostro-safe, overflow canti con font step-down, copertina e indice."
      >
        <GroupedRow
          leading={<SectionIcon section="stampa" size="sm" />}
          title="Vai alla Schermata Stampa A4 (#/stampa)"
          subtitle="Selezione elementi, riordino su/giù e stampa A4"
          chevron
          onClick={() => navigate('stampa')}
        />
        <div style={{ padding: 'var(--space-4)' }}>
          {/* Demo alert overflow */}
          <div className="stampa-overflow-alert" style={{ margin: '0 0 var(--space-3)' }}>
            <Icon name="info" size={16} />
            <span>Questa pagina non entra: aggiungi un'interruzione di pagina</span>
          </div>

          {/* Demo intestazione ridotta pagina >= 2 */}
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <span style={{ fontWeight: 600 }}>Strade e Pensieri per Domani</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>2/2</span>
          </div>

          {/* Demo checkbox ODG stampabile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-xs)' }}>
            <span className="print-checkbox" style={{ display: 'inline-block', width: '14px', height: '14px', border: '1.5px solid var(--color-text)', borderRadius: '2px' }} />
            <span>Punto Ordine del Giorno con casella quadrata stampabile</span>
          </div>
        </div>
      </GroupedList>

      {/* 19. CALENDARIO E ORDINE DEL GIORNO (ODG) - FASE 7 */}
      <GroupedList
        header="19. CALENDARIO E ORDINE DEL GIORNO (ODG - FASE 7)"
        footer="Chip cromatici per i 5 tipi di attività, blocchi data da parete, indicatore 'Oggi' in rosso e spunta ODG animata riservata ad Admin."
      >
        <GroupedRow
          leading={<SectionIcon section="calendario" size="sm" />}
          title="Vai alla Schermata Calendario (#/calendario)"
          subtitle="Vista Mese, Vista Lista, Dettaglio e gestione ODG"
          chevron
          onClick={() => navigate('calendario')}
        />
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Chip Tipi Evento */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <span className="event-type-chip event-chip-riunione">Riunione</span>
            <span className="event-type-chip event-chip-uscita">Uscita</span>
            <span className="event-type-chip event-chip-scadenza">Scadenza</span>
            <span className="event-type-chip event-chip-evento">Evento Clan</span>
            <span className="event-type-chip event-chip-altro">Altro</span>
          </div>

          {/* Blocchi Data Calendario da Parete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div className="calendar-date-block" aria-hidden="true">
              <div className="calendar-date-month">OTT</div>
              <div className="calendar-date-day">19</div>
              <div className="calendar-date-weekday">SAB</div>
            </div>

            <div className="calendar-date-block calendar-date-block-today" aria-hidden="true">
              <div className="calendar-date-month">OTT</div>
              <div className="calendar-date-day">15</div>
              <div className="calendar-date-weekday">OGGI</div>
            </div>

            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              Data standard (testata blu inchiostro) vs Data odierna (testata e numero in rosso accento)
            </div>
          </div>

          {/* Esempio Punti ODG e Spunta Animata */}
          <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-ink)' }}>ORDINE DEL GIORNO</span>
              <span className="odg-open-badge">1 aperto</span>
            </div>

            <div className="odg-item">
              <div className="odg-item-left">
                <button
                  type="button"
                  className="odg-check-btn"
                  aria-checked={false}
                  role="checkbox"
                  aria-label="Verifica adesioni route estiva (In attesa)"
                />
                <span className="odg-text">Verifica adesioni route estiva</span>
              </div>
            </div>

            <div className="odg-item odg-item-completed">
              <div className="odg-item-left">
                <button
                  type="button"
                  className="odg-check-btn odg-check-btn-checked"
                  aria-checked={true}
                  role="checkbox"
                  aria-label="Approvazione cassa di clan (Completato)"
                >
                  <svg className="odg-check-svg" viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                <span className="odg-text odg-text-completed">Approvazione bilancio e cassa di Clan</span>
              </div>
            </div>
          </div>
        </div>
      </GroupedList>

      {/* BOTTOM SHEET DIMOSTRATIVO */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Dettaglio Scheda"
        subtitle="Esempio di foglio di presentazione Apple"
      >
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          Questo foglio compare con una transizione nativa iOS `cubic-bezier(0.32, 0.72, 0, 1)`, maniglia centrata per il trascinamento e rispetta le aree sicure inferiori (`safe-area-inset-bottom`).
        </p>
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="primary" onClick={() => setIsSheetOpen(false)} style={{ flex: 1 }}>
            Conferma
          </Button>
          <Button variant="secondary" onClick={() => setIsSheetOpen(false)} style={{ flex: 1 }}>
            Chiudi
          </Button>
        </div>
      </BottomSheet>

      {/* TOAST DIMOSTRATIVO */}
      {showToast ? (
        <Toast
          message="Modifica salvata in locale (offline)"
          type="success"
          actionLabel="Annulla"
          onAction={() => setShowToast(false)}
          onClose={() => setShowToast(false)}
        />
      ) : null}

      {/* MODAL CONFERMA ELIMINAZIONE A DUE PASSAGGI */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          setIsDeleteModalOpen(false);
          setShowToast(true);
        }}
        itemName="Palla Avvelenata dei Clan"
      />

      {/* MODALITÀ LETTURA BANS */}
      <BanReadingMode
        ban={demoBan}
        isOpen={isReadingModeOpen}
        onClose={() => setIsReadingModeOpen(false)}
      />

      {/* MODALITÀ LETTURA CANTI */}
      <CantoReadingMode
        canto={demoCanto}
        isOpen={isCantoReadingOpen}
        onClose={() => setIsCantoReadingOpen(false)}
      />

      {/* LIGHTBOX ZOOM IMMAGINE DIMOSTRATIVO */}
      {demoZoomImage && (
        <div
          className="attachment-lightbox-backdrop"
          onClick={() => setDemoZoomImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="attachment-lightbox-topbar">
            <span>Schema Campo di Gioco (Dimostrazione Zoom)</span>
            <button
              type="button"
              className="ios-btn ios-btn-ghost"
              style={{ color: 'oklch(1 0 0)', padding: '8px' }}
              onClick={() => setDemoZoomImage(null)}
            >
              <Icon name="close" size={24} />
            </button>
          </div>
          <img src={demoZoomImage} alt="Zoom" className="attachment-lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
