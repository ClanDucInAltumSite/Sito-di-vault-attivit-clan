import { useState, useEffect, useMemo } from 'preact/hooks';
import '../../styles/print.css';
import { I18N } from '../../lib/i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { SectionIcon } from '../../ui/SectionIcon';
import { BrandLogo } from '../../ui/BrandLogo';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { SegmentedControl } from '../../ui/SegmentedControl';
import {
  Gioco,
  Ban,
  Canto,
  getGiochi,
  getBans,
  getCanti,
  getEventi,
  getOdgPunti,
  Evento,
  OdgPunto,
} from '../../lib/db';
import {
  StampaConfig,
  loadStampaConfig,
  saveStampaConfig,
  loadPrintableData,
  PrintableData,
  moveItemInArray,
  PrintableODG,
  computePrintIndex,
} from '../../lib/stampa';
import { ChordProRenderer, stripChords } from '../../lib/chordpro';
import { SearchField } from '../../ui/SearchField';
import { matchesQuery } from '../../lib/search';
import { CanzonierePageRenderer } from '../canti/CanzonierePageRenderer';

type SectionTab = 'tutti' | 'giochi' | 'bans' | 'canti' | 'odg';

export function StampaView() {
  const [config, setConfig] = useState<StampaConfig>(() => loadStampaConfig());
  const [giochi, setGiochi] = useState<Gioco[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [canti, setCanti] = useState<Canto[]>([]);
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [odgPuntiMap, setOdgPuntiMap] = useState<Record<string, OdgPunto[]>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    giochi: true,
    bans: true,
    canti: true,
    odg: true,
  });

  const toggleSection = (sec: string) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const [activeTab, setActiveTab] = useState<SectionTab>('tutti');
  const [printableData, setPrintableData] = useState<PrintableData>({
    giochi: [],
    bans: [],
    canti: [],
    totalSelected: 0,
    hasAnyOverflow: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Caricamento dati iniziali da IndexedDB
  useEffect(() => {
    let mounted = true;
    async function init() {
      setIsLoading(true);
      try {
        const [gList, bList, cList, eList] = await Promise.all([
          getGiochi(false),
          getBans(false),
          getCanti(false),
          getEventi(false),
        ]);

        if (!mounted) return;
        setGiochi(gList);
        setBans(bList);
        setCanti(cList);
        setEventi(eList);

        // Carica ODG per gli eventi
        const pMap: Record<string, OdgPunto[]> = {};
        for (const ev of eList) {
          const pts = await getOdgPunti(ev.id, false);
          if (pts.length > 0) {
            pMap[ev.id] = pts;
          }
        }
        if (mounted) {
          setOdgPuntiMap(pMap);
        }

        // Se la configurazione memorizzata è vuota e ci sono elementi,
        // potremmo mantenere lo stato memorizzato o lasciare la scelta all'utente
        const currentConf = loadStampaConfig();
        const pData = await loadPrintableData(currentConf);
        if (mounted) {
          setPrintableData(pData);
        }
      } catch (err) {
        console.error('[StampaView] Errore caricamento dati IndexedDB:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Aggiornamento dati stampabili quando cambia la configurazione
  const updateConfig = async (newConfig: StampaConfig) => {
    setConfig(newConfig);
    saveStampaConfig(newConfig);
    const pData = await loadPrintableData(newConfig);
    setPrintableData(pData);
  };

  // Toggle selezione singolo elemento
  const toggleSelection = (section: 'giochi' | 'bans' | 'canti', id: string) => {
    let nextIds: string[];
    if (section === 'giochi') {
      nextIds = config.selectedGiochiIds.includes(id)
        ? config.selectedGiochiIds.filter((x) => x !== id)
        : [...config.selectedGiochiIds, id];
      updateConfig({ ...config, selectedGiochiIds: nextIds });
    } else if (section === 'bans') {
      nextIds = config.selectedBansIds.includes(id)
        ? config.selectedBansIds.filter((x) => x !== id)
        : [...config.selectedBansIds, id];
      updateConfig({ ...config, selectedBansIds: nextIds });
    } else {
      nextIds = config.selectedCantiIds.includes(id)
        ? config.selectedCantiIds.filter((x) => x !== id)
        : [...config.selectedCantiIds, id];
      updateConfig({ ...config, selectedCantiIds: nextIds });
    }
  };

  // Seleziona tutto / Deseleziona tutto per sezione
  const selectAllSection = (section: 'giochi' | 'bans' | 'canti') => {
    if (section === 'giochi') {
      updateConfig({ ...config, selectedGiochiIds: giochi.map((g) => g.id) });
    } else if (section === 'bans') {
      updateConfig({ ...config, selectedBansIds: bans.map((b) => b.id) });
    } else {
      updateConfig({ ...config, selectedCantiIds: canti.map((c) => c.id) });
    }
  };

  const deselectAllSection = (section: 'giochi' | 'bans' | 'canti') => {
    if (section === 'giochi') {
      updateConfig({ ...config, selectedGiochiIds: [] });
    } else if (section === 'bans') {
      updateConfig({ ...config, selectedBansIds: [] });
    } else {
      updateConfig({ ...config, selectedCantiIds: [] });
    }
  };

  // Riordino su / giù
  const handleReorder = (
    section: 'giochi' | 'bans' | 'canti',
    id: string,
    direction: 'up' | 'down'
  ) => {
    if (section === 'giochi') {
      const idx = config.selectedGiochiIds.indexOf(id);
      if (idx === -1) return;
      const reordered = moveItemInArray(config.selectedGiochiIds, idx, direction);
      updateConfig({ ...config, selectedGiochiIds: reordered });
    } else if (section === 'bans') {
      const idx = config.selectedBansIds.indexOf(id);
      if (idx === -1) return;
      const reordered = moveItemInArray(config.selectedBansIds, idx, direction);
      updateConfig({ ...config, selectedBansIds: reordered });
    } else {
      const idx = config.selectedCantiIds.indexOf(id);
      if (idx === -1) return;
      const reordered = moveItemInArray(config.selectedCantiIds, idx, direction);
      updateConfig({ ...config, selectedCantiIds: reordered });
    }
  };

  // Evento ODG selezionato (se presente)
  const printableODG: PrintableODG | null = useMemo(() => {
    if (!selectedEventId) return null;
    const ev = eventi.find((e) => e.id === selectedEventId);
    if (!ev) return null;
    const pts = odgPuntiMap[ev.id] || [];
    return {
      titoloEvento: ev.titolo,
      dataEvento: new Date(ev.inizio).toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      luogoEvento: ev.luogo || 'Sede di Gruppo',
      punti: pts.map((p) => ({
        id: p.id,
        testo: p.testo,
        completato: p.completato,
      })),
    };
  }, [selectedEventId, eventi, odgPuntiMap]);

  // Calcolo della numerazione reale per l'indice
  const printIndex = useMemo(
    () => computePrintIndex(printableData, config, printableODG),
    [printableData, config, printableODG]
  );

  const totalItemsCount = printableData.totalSelected + (printableODG ? 1 : 0);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Filtraggio elementi tramite la barra di ricerca
  const filteredGiochi = useMemo(() => {
    if (!searchQuery.trim()) return giochi;
    return giochi.filter((g) =>
      matchesQuery(searchQuery, g.nome, g.materiali || '', g.regole || '')
    );
  }, [giochi, searchQuery]);

  const filteredBans = useMemo(() => {
    if (!searchQuery.trim()) return bans;
    return bans.filter((b) =>
      matchesQuery(searchQuery, b.nome, b.testo || '', b.note_gesti || '')
    );
  }, [bans, searchQuery]);

  const filteredCanti = useMemo(() => {
    if (!searchQuery.trim()) return canti;
    return canti.filter((c) => {
      const clean = stripChords(c.testo_chordpro);
      return matchesQuery(searchQuery, c.titolo, c.autore || '', clean);
    });
  }, [canti, searchQuery]);

  const filteredEventi = useMemo(() => {
    if (!searchQuery.trim()) return eventi;
    return eventi.filter((ev) => {
      const pts = odgPuntiMap[ev.id] || [];
      const ptsText = pts.map((p) => p.testo).join(' ');
      return matchesQuery(searchQuery, ev.titolo, ev.luogo || '', ptsText);
    });
  }, [eventi, odgPuntiMap, searchQuery]);

  const isGiochiOpen = searchQuery.trim() ? filteredGiochi.length > 0 : !!expandedSections.giochi;
  const isBansOpen = searchQuery.trim() ? filteredBans.length > 0 : !!expandedSections.bans;
  const isCantiOpen = searchQuery.trim() ? filteredCanti.length > 0 : !!expandedSections.canti;
  const isOdgOpen = searchQuery.trim() ? filteredEventi.length > 0 : !!expandedSections.odg;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-8)' }}>
      {/* =========================================================================
          PANNELLO DI CONTROLLO A SCHERMO (Nascosto in @media print)
          ========================================================================= */}
      <div className="stampa-screen-controls no-print">
        {/* Intestazione Centro Stampa con Logo Completo */}
        <div
          className="ios-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-6)',
          }}
        >
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <BrandLogo variant="completo" withTarga={true} size={160} />
          </div>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 800,
              color: 'var(--color-ink)',
              letterSpacing: '-0.02em',
              margin: 'var(--space-1) 0',
            }}
          >
            {I18N.stampa.title}
          </h1>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              maxWidth: '480px',
              margin: '0 auto var(--space-4)',
              lineHeight: 1.45,
            }}
          >
            {I18N.stampa.subtitle}
          </p>

          <Button
            variant="primary"
            onClick={() => window.print()}
            disabled={totalItemsCount === 0 || isLoading}
            style={{
              minWidth: '220px',
              fontSize: 'var(--font-size-base)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Icon name="stampa" size={18} />
            <span>{I18N.stampa.stampaOra}</span>
          </Button>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Badge variant={totalItemsCount > 0 ? 'azzurro' : 'neutral'} size="sm">
              {I18N.stampa.elementiSelezionati(totalItemsCount)}
            </Badge>
          </div>
        </div>

        {/* Avviso globale di Overflow per i Canti se presente */}
        {printableData.hasAnyOverflow && (
          <div
            className="stampa-overflow-alert"
            role="alert"
            aria-live="polite"
            style={{ marginBottom: 'var(--space-4)' }}
          >
            <Icon name="info" size={20} />
            <div>
              <strong>{I18N.stampa.paginaNonEntra}:</strong>{' '}
              <span>
                Uno o più canti superano l'altezza A4 anche con font 9.5 pt. Aggiungi la
                direttiva <code>&#123;nuova_pagina&#125;</code> per distribuirli su più pagine.
              </span>
            </div>
          </div>
        )}

        {/* Opzioni di Impaginazione (Switch iOS) */}
        <div
          className="ios-card"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div className="stampa-switch-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>
                {I18N.stampa.includiImmagini}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  marginTop: '2px',
                  maxWidth: '380px',
                }}
              >
                {I18N.stampa.includiImmaginiNota}
              </div>
            </div>
            <ToggleSwitch
              checked={config.includeImages}
              onChange={(checked) => updateConfig({ ...config, includeImages: checked })}
              aria-label={I18N.stampa.includiImmagini}
            />
          </div>

          <div className="stampa-switch-row" style={{ borderBottom: 'none' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>
                {I18N.stampa.aggiungiCopertinaEIndice}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  marginTop: '2px',
                  maxWidth: '380px',
                }}
              >
                {I18N.stampa.aggiungiCopertinaEIndiceNota}
              </div>
            </div>
            <ToggleSwitch
              checked={config.includeCoverAndIndex}
              onChange={(checked) =>
                updateConfig({ ...config, includeCoverAndIndex: checked })
              }
              aria-label={I18N.stampa.aggiungiCopertinaEIndice}
            />
          </div>
        </div>

        {/* Barra di Ricerca Elementi Stampa */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <SearchField
            value={searchQuery}
            onInput={setSearchQuery}
            placeholder="Cerca per titolo o contenuto tra giochi, bans, canti e ODG..."
            aria-label="Cerca elementi da stampare"
          />
        </div>

        {/* Filtro per Sezioni */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <SegmentedControl
            options={[
              { value: 'tutti', label: 'Tutti' },
              { value: 'giochi', label: `Giochi (${config.selectedGiochiIds.length}/${giochi.length})` },
              { value: 'bans', label: `Bans (${config.selectedBansIds.length}/${bans.length})` },
              { value: 'canti', label: `Canti (${config.selectedCantiIds.length}/${canti.length})` },
              { value: 'odg', label: 'ODG' },
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val as SectionTab)}
          />
        </div>

        {/* LISTA GIOCHI (Menu a tendina / Accordion) */}
        {(activeTab === 'tutti' || activeTab === 'giochi') && (
          <div className="ios-card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: isGiochiOpen ? 'var(--space-2)' : 0,
                borderBottom: isGiochiOpen ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('giochi')}
                aria-expanded={isGiochiOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <SectionIcon section="giochi" size="sm" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>
                  {I18N.stampa.giochi} ({config.selectedGiochiIds.length}/{giochi.length})
                </h2>
                {searchQuery.trim() && (
                  <Badge variant="neutral" size="sm">
                    {filteredGiochi.length} trovati
                  </Badge>
                )}
                <div style={{ marginLeft: 'var(--space-1)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                  <Icon name={isGiochiOpen ? 'chevron-up' : 'chevron-down'} size={18} />
                </div>
              </button>

              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ios-btn ios-btn-secondary"
                  style={{ minHeight: '30px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
                  onClick={() => selectAllSection('giochi')}
                >
                  {I18N.stampa.selezionaTutto}
                </button>
                <button
                  type="button"
                  className="ios-btn ios-btn-secondary"
                  style={{ minHeight: '30px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
                  onClick={() => deselectAllSection('giochi')}
                >
                  {I18N.stampa.deselezionaTutto}
                </button>
              </div>
            </div>

            {isGiochiOpen && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                {filteredGiochi.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-3) 0', fontSize: 'var(--font-size-sm)' }}>
                    {searchQuery.trim() ? 'Nessun gioco corrispondente alla ricerca.' : 'Nessun gioco presente nel vault.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {filteredGiochi.map((g) => {
                      const isSelected = config.selectedGiochiIds.includes(g.id);
                      const orderIndex = config.selectedGiochiIds.indexOf(g.id);
                      return (
                        <div
                          key={g.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            background: isSelected ? 'var(--color-fill-quaternary)' : 'transparent',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--color-giochi-border)' : 'var(--color-border)',
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              cursor: 'pointer',
                              flex: 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection('giochi', g.id)}
                              style={{ width: '18px', height: '18px' }}
                              aria-label={`Seleziona ${g.nome}`}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                {g.nome}
                              </div>
                              {g.materiali && (
                                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                                  Materiali: {g.materiali}
                                </div>
                              )}
                            </div>
                          </label>

                          {isSelected && (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="stampa-reorder-btn"
                                disabled={orderIndex <= 0}
                                onClick={() => handleReorder('giochi', g.id, 'up')}
                                aria-label={`${I18N.stampa.spostaSu} ${g.nome}`}
                              >
                                <Icon name="chevron-up" size={14} />
                              </button>
                              <button
                                type="button"
                                className="stampa-reorder-btn"
                                disabled={orderIndex === -1 || orderIndex >= config.selectedGiochiIds.length - 1}
                                onClick={() => handleReorder('giochi', g.id, 'down')}
                                aria-label={`${I18N.stampa.spostaGiu} ${g.nome}`}
                              >
                                <Icon name="chevron-down" size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LISTA BANS (Menu a tendina / Accordion) */}
        {(activeTab === 'tutti' || activeTab === 'bans') && (
          <div className="ios-card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: isBansOpen ? 'var(--space-2)' : 0,
                borderBottom: isBansOpen ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('bans')}
                aria-expanded={isBansOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <SectionIcon section="bans" size="sm" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>
                  {I18N.stampa.bans} ({config.selectedBansIds.length}/{bans.length})
                </h2>
                {searchQuery.trim() && (
                  <Badge variant="neutral" size="sm">
                    {filteredBans.length} trovati
                  </Badge>
                )}
                <div style={{ marginLeft: 'var(--space-1)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                  <Icon name={isBansOpen ? 'chevron-up' : 'chevron-down'} size={18} />
                </div>
              </button>

              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ios-btn ios-btn-secondary"
                  style={{ minHeight: '30px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
                  onClick={() => selectAllSection('bans')}
                >
                  {I18N.stampa.selezionaTutto}
                </button>
                <button
                  type="button"
                  className="ios-btn ios-btn-secondary"
                  style={{ minHeight: '30px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
                  onClick={() => deselectAllSection('bans')}
                >
                  {I18N.stampa.deselezionaTutto}
                </button>
              </div>
            </div>

            {isBansOpen && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                {filteredBans.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-3) 0', fontSize: 'var(--font-size-sm)' }}>
                    {searchQuery.trim() ? 'Nessun ban corrispondente alla ricerca.' : 'Nessun ban presente nel vault.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {filteredBans.map((b) => {
                      const isSelected = config.selectedBansIds.includes(b.id);
                      const orderIndex = config.selectedBansIds.indexOf(b.id);
                      return (
                        <div
                          key={b.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            background: isSelected ? 'var(--color-fill-quaternary)' : 'transparent',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--color-bans-border)' : 'var(--color-border)',
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              cursor: 'pointer',
                              flex: 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection('bans', b.id)}
                              style={{ width: '18px', height: '18px' }}
                              aria-label={`Seleziona ${b.nome}`}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                {b.nome}
                              </div>
                              {b.note_gesti && (
                                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                                  Gesti: {b.note_gesti}
                                </div>
                              )}
                            </div>
                          </label>

                          {isSelected && (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="stampa-reorder-btn"
                                disabled={orderIndex <= 0}
                                onClick={() => handleReorder('bans', b.id, 'up')}
                                aria-label={`${I18N.stampa.spostaSu} ${b.nome}`}
                              >
                                <Icon name="chevron-up" size={14} />
                              </button>
                              <button
                                type="button"
                                className="stampa-reorder-btn"
                                disabled={orderIndex === -1 || orderIndex >= config.selectedBansIds.length - 1}
                                onClick={() => handleReorder('bans', b.id, 'down')}
                                aria-label={`${I18N.stampa.spostaGiu} ${b.nome}`}
                              >
                                <Icon name="chevron-down" size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LISTA CANTI (Menu a tendina / Accordion) */}
        {(activeTab === 'tutti' || activeTab === 'canti') && (
          <div className="ios-card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: isCantiOpen ? 'var(--space-2)' : 0,
                borderBottom: isCantiOpen ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('canti')}
                aria-expanded={isCantiOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <SectionIcon section="canti" size="sm" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>
                  {I18N.stampa.canti} ({config.selectedCantiIds.length}/{canti.length})
                </h2>
                {searchQuery.trim() && (
                  <Badge variant="neutral" size="sm">
                    {filteredCanti.length} trovati
                  </Badge>
                )}
                <div style={{ marginLeft: 'var(--space-1)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                  <Icon name={isCantiOpen ? 'chevron-up' : 'chevron-down'} size={18} />
                </div>
              </button>

              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ios-btn ios-btn-secondary"
                  style={{ minHeight: '30px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
                  onClick={() => selectAllSection('canti')}
                >
                  {I18N.stampa.selezionaTutto}
                </button>
                <button
                  type="button"
                  className="ios-btn ios-btn-secondary"
                  style={{ minHeight: '30px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
                  onClick={() => deselectAllSection('canti')}
                >
                  {I18N.stampa.deselezionaTutto}
                </button>
              </div>
            </div>

            {isCantiOpen && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                {filteredCanti.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-3) 0', fontSize: 'var(--font-size-sm)' }}>
                    {searchQuery.trim() ? 'Nessun canto corrispondente alla ricerca.' : 'Nessun canto presente nel vault.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {filteredCanti.map((c) => {
                      const isSelected = config.selectedCantiIds.includes(c.id);
                      const orderIndex = config.selectedCantiIds.indexOf(c.id);
                      const printableSong = printableData.canti.find((sc) => sc.canto.id === c.id);

                      return (
                        <div
                          key={c.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            background: isSelected ? 'var(--color-fill-quaternary)' : 'transparent',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--color-canti-border)' : 'var(--color-border)',
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              cursor: 'pointer',
                              flex: 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection('canti', c.id)}
                              style={{ width: '18px', height: '18px' }}
                              aria-label={`Seleziona ${c.titolo}`}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                {c.titolo}
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-2)',
                                  fontSize: 'var(--font-size-2xs)',
                                  color: 'var(--color-text-secondary)',
                                }}
                              >
                                {c.autore && <span>{c.autore}</span>}
                                {c.tonalita && <span>• Tonalità: {c.tonalita}</span>}
                                {printableSong && (
                                  <span style={{ fontWeight: 600 }}>
                                    • {printableSong.pageCount} {printableSong.pageCount === 1 ? 'pagina A4' : 'pagine A4'}
                                  </span>
                                )}
                                {printableSong?.hasAnyOverflow && (
                                  <Badge variant="rosso" size="sm">
                                    Overflow
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </label>

                          {isSelected && (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="stampa-reorder-btn"
                                disabled={orderIndex <= 0}
                                onClick={() => handleReorder('canti', c.id, 'up')}
                                aria-label={`${I18N.stampa.spostaSu} ${c.titolo}`}
                              >
                                <Icon name="chevron-up" size={14} />
                              </button>
                              <button
                                type="button"
                                className="stampa-reorder-btn"
                                disabled={orderIndex === -1 || orderIndex >= config.selectedCantiIds.length - 1}
                                onClick={() => handleReorder('canti', c.id, 'down')}
                                aria-label={`${I18N.stampa.spostaGiu} ${c.titolo}`}
                              >
                                <Icon name="chevron-down" size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODELLO ODG (Menu a tendina / Accordion) */}
        {(activeTab === 'tutti' || activeTab === 'odg') && (
          <div className="ios-card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: isOdgOpen ? 'var(--space-2)' : 0,
                borderBottom: isOdgOpen ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSection('odg')}
                aria-expanded={isOdgOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <SectionIcon section="calendario" size="sm" />
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>
                  {I18N.stampa.schedaOdg} {selectedEventId ? '(1 selezionato)' : '(0 selezionati)'}
                </h2>
                {searchQuery.trim() && (
                  <Badge variant="neutral" size="sm">
                    {filteredEventi.length} trovati
                  </Badge>
                )}
                <div style={{ marginLeft: 'var(--space-1)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                  <Icon name={isOdgOpen ? 'chevron-up' : 'chevron-down'} size={18} />
                </div>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {selectedEventId && (
                  <button
                    type="button"
                    className="ios-btn ios-btn-secondary"
                    style={{ minHeight: '30px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
                    onClick={() => setSelectedEventId(null)}
                  >
                    Deseleziona
                  </button>
                )}
              </div>
            </div>

            {isOdgOpen && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                  Seleziona un evento del calendario con Ordine del Giorno per stampare una scheda A4 compatta con caselle quadrate stampabili.
                </p>

                {filteredEventi.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    {searchQuery.trim() ? 'Nessuna riunione o ODG corrispondente alla ricerca.' : 'Nessun evento disponibile.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {filteredEventi.map((ev) => {
                      const pts = odgPuntiMap[ev.id] || [];
                      const isSelected = selectedEventId === ev.id;
                      return (
                        <div
                          key={ev.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            background: isSelected ? 'var(--color-fill-quaternary)' : 'transparent',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--color-calendario)' : 'var(--color-border)',
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              cursor: 'pointer',
                              flex: 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => setSelectedEventId(isSelected ? null : ev.id)}
                              style={{ width: '18px', height: '18px' }}
                              aria-label={`Seleziona ODG ${ev.titolo}`}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                {ev.titolo}
                              </div>
                              <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                                {new Date(ev.inizio).toLocaleDateString('it-IT')} • {pts.length} punti ODG
                              </div>
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          CONTENITORE DI STAMPA A4 (Renderizzato a schermo come anteprima e in @media print)
          ========================================================================= */}
      <div className="stampa-print-container" id="stampa-print-root">
        {totalItemsCount === 0 ? (
          <div
            className="ios-card no-print"
            style={{
              padding: 'var(--space-6)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            <Icon name="file-text" size={32} style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }} />
            <div>{I18N.stampa.nessunElementoSelezionato}</div>
          </div>
        ) : (
          <>
            {/* 1. COPERTINA UFFICIALE (Opzionale) */}
            {config.includeCoverAndIndex && (
              <div className="print-cover-page stampa-preview-paper">
                <div style={{ marginBottom: '24pt' }}>
                  <BrandLogo variant="completo" withTarga={true} size={180} />
                </div>
                <h1 className="print-cover-title">{I18N.stampa.copertinaTitolo}</h1>
                <p className="print-cover-subtitle">{I18N.stampa.copertinaSottotitolo}</p>
                <div className="print-cover-meta">
                  Gruppo AGESCI Ponte San Giovanni 1 • Generato il {formattedDate}
                </div>
              </div>
            )}

            {/* 2. INDICE DEI CONTENUTI (Opzionale) */}
            {config.includeCoverAndIndex && (
              <div className="print-index-page stampa-preview-paper">
                <h2 className="print-index-title">{I18N.stampa.indice}</h2>

                {printIndex.giochi.length > 0 && (
                  <div className="print-index-section">
                    <div className="print-index-section-header">{I18N.stampa.giochi}</div>
                    {printIndex.giochi.map((entry) => (
                      <div key={entry.id} className="print-index-row">
                        <span>{entry.title}</span>
                        <span className="print-index-row-num">
                          {entry.startPage !== null ? entry.startPage : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {printIndex.bans.length > 0 && (
                  <div className="print-index-section">
                    <div className="print-index-section-header">{I18N.stampa.bans}</div>
                    {printIndex.bans.map((entry) => (
                      <div key={entry.id} className="print-index-row">
                        <span>{entry.title}</span>
                        <span className="print-index-row-num">
                          {entry.startPage !== null ? entry.startPage : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {printIndex.canti.length > 0 && (
                  <div className="print-index-section">
                    <div className="print-index-section-header">{I18N.stampa.canti}</div>
                    {printIndex.canti.map((entry) => (
                      <div key={entry.id} className="print-index-row">
                        <span>{entry.title}</span>
                        <span className="print-index-row-num">
                          {entry.startPage !== null ? entry.startPage : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {printIndex.odg && (
                  <div className="print-index-section">
                    <div className="print-index-section-header">{I18N.stampa.schedaOdg}</div>
                    <div className="print-index-row">
                      <span>{printIndex.odg.title}</span>
                      <span className="print-index-row-num">
                        {printIndex.odg.startPage !== null ? printIndex.odg.startPage : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. SEZIONE GIOCHI (Flusso continuo, separatore sottile, orfani/vedove gestiti) */}
            {printableData.giochi.length > 0 && (
              <div className="print-continuous stampa-preview-paper">
                <div className="print-section-header">{I18N.stampa.giochi}</div>
                {printableData.giochi.map((pg) => (
                  <article
                    key={pg.gioco.id}
                    className={pg.isShort ? 'print-item-short' : 'print-item-long'}
                  >
                    <h3 className="print-title">{pg.gioco.nome}</h3>
                    {pg.gioco.materiali && (
                      <div style={{ marginBottom: '4pt' }}>
                        <span className="print-subtitle-label">{I18N.stampa.materiali}: </span>
                        <span className="print-body-text">{pg.gioco.materiali}</span>
                      </div>
                    )}
                    <div style={{ marginTop: '4pt' }}>
                      <span className="print-subtitle-label">{I18N.stampa.regole}: </span>
                      <div className="print-body-text">{pg.gioco.regole}</div>
                    </div>

                    {/* Immagini allegate (solo se switch attivo) */}
                    {config.includeImages && pg.images.length > 0 && (
                      <div className="print-attachment-container">
                        {pg.images.map((img, iIdx) =>
                          img.src ? (
                            <img
                              key={iIdx}
                              src={img.src}
                              alt={img.name}
                              className="print-attachment-image"
                            />
                          ) : (
                            <div key={iIdx} className="print-img-warning">
                              [{I18N.stampa.immagineNonDisponibileOffline}: {img.name}]
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {/* 4. SEZIONE BANS (Flusso continuo, testo e gesti separati) */}
            {printableData.bans.length > 0 && (
              <div className="print-continuous stampa-preview-paper">
                <div className="print-section-header">{I18N.stampa.bans}</div>
                {printableData.bans.map((pb) => (
                  <article
                    key={pb.ban.id}
                    className={pb.isShort ? 'print-item-short' : 'print-item-long'}
                  >
                    <h3 className="print-title">{pb.ban.nome}</h3>
                    {pb.ban.note_gesti && (
                      <div style={{ marginBottom: '6pt' }}>
                        <span className="print-subtitle-label">{I18N.stampa.note}: </span>
                        <span className="print-body-text">{pb.ban.note_gesti}</span>
                      </div>
                    )}
                    <div className="print-body-text">{pb.ban.testo}</div>

                    {/* Immagini allegate */}
                    {config.includeImages && pb.images.length > 0 && (
                      <div className="print-attachment-container">
                        {pb.images.map((img, iIdx) =>
                          img.src ? (
                            <img
                              key={iIdx}
                              src={img.src}
                              alt={img.name}
                              className="print-attachment-image"
                            />
                          ) : (
                            <div key={iIdx} className="print-img-warning">
                              [{I18N.stampa.immagineNonDisponibileOffline}: {img.name}]
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {/* 5. SEZIONE CANTI (Stile Canzoniere A4 a due colonne - Fase 9) */}
            {printableData.canti.map((ps) => (
              <div key={ps.canto.id} className="print-song-wrapper">
                {ps.canzoniereResult ? (
                  ps.canzoniereResult.pages.map((page) => (
                    <div key={`${ps.canto.id}-p${page.pageNumber}`} className="print-song-page">
                      {/* Avviso di Overflow (Visibile solo a schermo prima della stampa) */}
                      {ps.hasAnyOverflow && page.isFirstPage && (
                        <div className="stampa-overflow-alert no-print">
                          <Icon name="info" size={16} />
                          <span>
                            {I18N.stampa.paginaNonEntra} ({ps.canto.titolo})
                          </span>
                        </div>
                      )}
                      <CanzonierePageRenderer page={page} isScreenPreview={true} />
                    </div>
                  ))
                ) : (
                  ps.pages.map((page) => (
                    <div
                      key={`${ps.canto.id}-p${page.pageIndex}`}
                      className={`print-song-page stampa-preview-paper print-font-${page.fontSizePt
                        .toString()
                        .replace('.', '-')}`}
                    >
                      {/* Avviso di Overflow (Visibile solo a schermo prima della stampa) */}
                      {page.hasOverflow && (
                        <div className="stampa-overflow-alert no-print">
                          <Icon name="info" size={16} />
                          <span>
                            {I18N.stampa.paginaNonEntra} (Pagina {page.pageIndex}/{ps.pageCount})
                          </span>
                        </div>
                      )}

                      {/* Intestazione: Completa a pagina 1, Ridotta a pagine >= 2 */}
                      {page.isFirstPage ? (
                        <div className="print-song-header">
                          <h2 className="print-song-title">{ps.canto.titolo}</h2>
                          <div className="print-song-meta">
                            {ps.canto.autore && <span>Autore: {ps.canto.autore}</span>}
                            {ps.canto.tonalita && <span> • Tonalità: {ps.canto.tonalita}</span>}
                            {ps.pageCount > 1 && (
                              <span>
                                {' '}
                                • {I18N.stampa.paginaDi(page.pageIndex, ps.pageCount)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="print-song-reduced-header">
                          <span>{ps.canto.titolo}</span>
                          <span>
                            {page.pageIndex}/{ps.pageCount}
                          </span>
                        </div>
                      )}

                      {/* Rendering ChordPro con accordi in nero pieno sopra le sillabe */}
                      <div style={{ flex: 1 }}>
                        <ChordProRenderer
                          chordproText={page.rawChordpro}
                          showChords={true}
                          transposeDelta={0}
                          fontSizeRem={page.fontSizePt / 12}
                        />
                      </div>
                    </div>
                  ))
                )}

                {/* Immagini allegate all'ultima pagina del canto */}
                {config.includeImages && ps.images.length > 0 && (
                  <div className="print-attachment-container">
                    {ps.images.map((img, iIdx) =>
                      img.src ? (
                        <img
                          key={iIdx}
                          src={img.src}
                          alt={img.name}
                          className="print-attachment-image"
                        />
                      ) : (
                        <div key={iIdx} className="print-img-warning">
                          [{I18N.stampa.immagineNonDisponibileOffline}: {img.name}]
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* 6. MODELLO SCHEDA ODG STAMPABILE */}
            {printableODG && (
              <div className="print-odg-sheet stampa-preview-paper">
                <div className="print-odg-header">
                  <div style={{ fontSize: '11pt', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Clan Duc In Altum • Ordine del Giorno
                  </div>
                  <h2 style={{ fontSize: '18pt', fontWeight: 800, margin: '4pt 0' }}>
                    {printableODG.titoloEvento}
                  </h2>
                  <div style={{ fontSize: '10pt', color: 'oklch(0.25 0 0)' }}>
                    Data: {printableODG.dataEvento} • Luogo: {printableODG.luogoEvento}
                  </div>
                </div>

                <div style={{ marginTop: '12pt' }}>
                  <div style={{ fontWeight: 700, fontSize: '12pt', marginBottom: '8pt' }}>
                    Punti da trattare e decisioni:
                  </div>
                  {printableODG.punti.map((punto) => (
                    <div key={punto.id} className="print-odg-item">
                      <span className="print-odg-checkbox" />
                      <span style={{ flex: 1 }}>{punto.testo}</span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: '24pt',
                    paddingTop: '12pt',
                    borderTop: '0.5pt solid oklch(0.5 0 0)',
                    fontSize: '9pt',
                    fontStyle: 'italic',
                  }}
                >
                  Note del Capo Clan / Verbale:
                  <div style={{ height: '80pt', borderBottom: '0.5pt dotted oklch(0.7 0 0)', marginTop: '8pt' }} />
                  <div style={{ height: '80pt', borderBottom: '0.5pt dotted oklch(0.7 0 0)', marginTop: '8pt' }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
