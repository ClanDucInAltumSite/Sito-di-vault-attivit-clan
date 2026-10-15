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

export function DesignSystemView() {
  const [searchValue, setSearchValue] = useState('avvelenata');
  const [selectedSegment, setSelectedSegment] = useState<'tutti' | 'giochi' | 'canti'>('giochi');
  const [isSwitchOn, setIsSwitchOn] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'auto' | 'light' | 'dark'>('auto');

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
          FASE 1B (FINALE) — Qualità Apple, identità del logo AGESCI, 5 fotografie e motivi vettoriali scout
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
          title="Giochi — Giallo Scout"
          subtitle="quadratino giallo pieno con glifo scuro (OKLCH L=0.83)"
          trailing={<Badge variant="giallo" size="sm">Giochi</Badge>}
        />
        <GroupedRow
          leading={<SectionIcon section="bans" size="md" />}
          title="Bans — Rosso Scout"
          subtitle="quadratino rosso pieno con glifo bianco (OKLCH L=0.55)"
          trailing={<Badge variant="rosso" size="sm">Bans</Badge>}
        />
        <GroupedRow
          leading={<SectionIcon section="canti" size="md" />}
          title="Canti — Azzurro Canzoniere"
          subtitle="quadratino azzurro pieno con glifo bianco (OKLCH L=0.53)"
          trailing={<Badge variant="azzurro" size="sm">Canti</Badge>}
        />
        <GroupedRow
          leading={<SectionIcon section="calendario" size="md" />}
          title="Calendario — Blu Notte"
          subtitle="quadratino blu notte pieno con glifo bianco (OKLCH L=0.42)"
          trailing={<span className="event-type-chip event-chip-riunione">Calendario</span>}
        />
        <GroupedRow
          leading={<SectionIcon section="stampa" size="md" />}
          title="Stampa e Admin — Grigio Neutro"
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
              Il Sentiero (The Trail — linea tratteggiata che si disegna + punto giallo)
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
    </div>
  );
}
