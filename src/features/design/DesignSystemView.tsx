import { useState } from 'preact/hooks';
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
import { LogoReveal, TheTrail, CompassSync } from '../../ui/ScoutMotifs';

export function DesignSystemView() {
  const [searchValue, setSearchValue] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<'tutti' | 'giochi' | 'canti'>('tutti');
  const [isSwitchOn, setIsSwitchOn] = useState(false);
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
    <div className="container">
      {/* Intestazione Showcase */}
      <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, letterSpacing: '-0.025em' }}>
          Design System Apple-Grade
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
          Sistema di design sobrio in OKLCH con componenti nativi e tocco scout vettoriale
        </p>
      </div>

      {/* Controllo Tema Live */}
      <GroupedList header="TEMA E SUPERFICI">
        <GroupedRow
          leading={<Icon name={currentTheme === 'dark' ? 'moon' : 'sun'} size={20} />}
          title="Aspetto Interfaccia"
          subtitle={`Tema attuale: ${currentTheme}`}
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

      {/* Motivi Scout Vettoriali */}
      <GroupedList header="TRE MOTIVI SCOUT VETTORIALI">
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          {/* Motivo 1: Logo Reveal */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
              1. Logo Reveal all'avvio con alone di accento
            </span>
            <LogoReveal size={56} />
          </div>

          {/* Motivo 2: The Trail */}
          <div style={{ width: '100%', textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
              2. The Trail (tracciato vettoriale tratteggiato con punto giallo)
            </span>
            <TheTrail />
          </div>

          {/* Motivo 3: Bussola di sincronizzazione */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
              3. Bussola di Sincronizzazione (ago oscillante)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
              <CompassSync isSyncing={isSyncing} size={32} />
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

      {/* Palette OKLCH Campionata dal Logo */}
      <GroupedList header="TOKEN COLORI OKLCH (DAL LOGO)">
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Azzurro Guida</div>
            <div style={{ fontSize: 'var(--font-size-2xs)', opacity: 0.9 }}>Unico accento</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-giallo)', color: 'var(--color-giallo-text)', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Giallo Scout</div>
            <div style={{ fontSize: 'var(--font-size-2xs)' }}>Solo highlight</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-rosso)', color: 'oklch(1 0 0)', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Rosso Distruttivo</div>
            <div style={{ fontSize: 'var(--font-size-2xs)', opacity: 0.9 }}>Elimina / Oggi</div>
          </div>
          <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Superficie</div>
            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>Neutro caldo</div>
          </div>
        </div>
      </GroupedList>

      {/* Componenti di Controllo Apple */}
      <GroupedList header="CONTROLLI NATIVI APPLE">
        <GroupedRow
          leading={<Icon name="search" size={20} />}
          title="Barra di ricerca con pulsante pulisci"
          trailing={null}
        />
        <div style={{ padding: '12px 16px' }}>
          <SearchField
            value={searchValue}
            onInput={setSearchValue}
            placeholder="Scrivi qualcosa per vedere il tasto pulisci..."
          />
        </div>

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
          leading={<Icon name="settings" size={20} />}
          title="Toggle Switch iOS (51x31px)"
          subtitle="Transizione morbida dell'interruttore"
          trailing={
            <ToggleSwitch
              checked={isSwitchOn}
              onChange={setIsSwitchOn}
              aria-label="Esempio interruttore"
            />
          }
        />

        <GroupedRow
          leading={<Icon name="info" size={20} />}
          title="Notifica a Capsula (Toast)"
          subtitle="Bolla flottante con indicatore a punto"
          trailing={
            <Button variant="secondary" size="sm" onClick={() => setShowToast(true)}>
              Mostra
            </Button>
          }
        />

        <GroupedRow
          leading={<Icon name="user" size={20} />}
          title="Bottom Sheet iOS"
          subtitle="Pannello a scorrimento con maniglia"
          trailing={
            <Button variant="primary" size="sm" onClick={() => setIsSheetOpen(true)}>
              Apri Sheet
            </Button>
          }
        />
      </GroupedList>

      {/* Pulsanti & Varianti */}
      <GroupedList header="PULSANTI (TOUCH TARGET >= 44PX)">
        <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <Button variant="primary">Primario Azzurro</Button>
          <Button variant="secondary">Secondario Neutro</Button>
          <Button variant="danger">Distruttivo Rosso</Button>
          <Button variant="ghost">Trasparente Ghost</Button>
          <Button variant="primary" isLoading>In caricamento</Button>
        </div>
      </GroupedList>

      {/* Badge Pill */}
      <GroupedList header="PILL BADGE">
        <div style={{ padding: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Badge variant="azzurro">Azzurro</Badge>
          <Badge variant="giallo">Giallo Scout</Badge>
          <Badge variant="rosso">Rosso</Badge>
          <Badge variant="neutral">Neutro</Badge>
          <Badge variant="azzurro" size="sm">Compatto</Badge>
        </div>
      </GroupedList>

      {/* Bottom Sheet Esempio */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="Pannello Bottom Sheet"
        subtitle="Stile nativo iOS con maniglia superiore e traslucenza"
        footer={
          <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setIsSheetOpen(false)}>
              Chiudi
            </Button>
            <Button variant="primary" onClick={() => setIsSheetOpen(false)}>
              Conferma
            </Button>
          </div>
        }
      >
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', lineHeight: 1.5 }}>
          Questo foglio inferiore si apre con una curva di animazione fluida in stile iOS
          (<code style={{ fontSize: '13px' }}>cubic-bezier(0.32, 0.72, 0, 1)</code>).
          Supporta chiusura tramite tocco sullo sfondo oscurato, tocco sulla maniglia o tasto ESC da tastiera.
        </p>
      </BottomSheet>

      {/* Toast Esempio */}
      {showToast ? (
        <Toast
          message="Modifica salvata con successo nell'archivio locale!"
          type="success"
          actionLabel="OK"
          onAction={() => setShowToast(false)}
          onClose={() => setShowToast(false)}
        />
      ) : null}
    </div>
  );
}
