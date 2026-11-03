// src/features/stampa/StampaOdg.tsx
// Flusso indipendente di Stampa per l'Ordine del Giorno (ODG), Appunti/Verbali ed Eventi/Uscite in formato A4 verticale.
// - Tripla suddivisione chiara, isolata e senza rumore:
//   1. Ordine del Giorno (ODG e Riunioni): lista pulita dei punti ODG con date e stato decisionale
//   2. Appunti e Verbali: testo completo dei verbali di riunione e pagine del Quaderno di Clan
//   3. Eventi e Uscite: uscite, attività di calendario, equipaggiamento/cosa portare e programma completo
// - Selezione 100% indipendente per ciascuna scheda (nessuna contaminazione tra ODG e Appunti)
// - Eliminazione automatica dalla stampa di eventi e ODG passati da più di 30 giorni
// - Nessuno switch superfluo: stampa diretta di tutte le informazioni utili
// - Unico pulsante di stampa chiarissimo e stabile in alto a destra (nessuna barra inferiore duplicata)

import { useState, useEffect, useMemo } from 'preact/hooks';
import {
  Evento,
  QuadernoPagina,
  getEventi,
  getOdgPunti,
  getQuadernoPagine,
} from '../../lib/db';
import {
  StampaOdgConfig,
  loadStampaOdgConfig,
  saveStampaOdgConfig,
  loadPrintableODGData,
  PrintableODGDataset,
  OdgPuntoStato,
  isEventOlderThan30Days,
} from '../../lib/stampa_odg';
import { moveItemInArray, triggerPrint, formatPrintDate } from '../../lib/stampa_shared';
import { parseDateOnly, isEventoDataDaDefinire } from '../../lib/calendario';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { SectionIcon } from '../../ui/SectionIcon';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { matchesQuery } from '../../lib/search';

export type OdgSubTab = 'odg' | 'quaderno' | 'eventi';

const STATO_BADGES: Record<
  OdgPuntoStato,
  { label: string; printClass: string; screenVariant: 'neutral' | 'success' | 'warning' | 'error' }
> = {
  proposto: { label: 'PROPOSTO', printClass: 'odg-status-proposto', screenVariant: 'neutral' },
  discusso: { label: 'DISCUSSO', printClass: 'odg-status-discusso', screenVariant: 'warning' },
  approvato: { label: 'APPROVATO', printClass: 'odg-status-approvato', screenVariant: 'success' },
  rimandato: { label: 'RIMANDATO', printClass: 'odg-status-rimandato', screenVariant: 'error' },
};

export function StampaOdg() {
  const [config, setConfig] = useState<StampaOdgConfig>(() => loadStampaOdgConfig());
  const [activeSubTab, setActiveSubTab] = useState<OdgSubTab>(() => {
    const tab = config.activeSubTab;
    return tab === 'quaderno' || tab === 'appunti' ? 'quaderno' : tab === 'eventi' ? 'eventi' : 'odg';
  });
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [odgPointsCountMap, setOdgPointsCountMap] = useState<Map<string, { total: number; open: number }>>(
    new Map()
  );
  const [quadernoPagine, setQuadernoPagine] = useState<QuadernoPagina[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataset, setDataset] = useState<PrintableODGDataset>({
    eventi: [],
    odgItems: [],
    appuntiEventi: [],
    quadernoPagine: [],
    eventiItems: [],
    scadenzeGenerali: [],
    totalSelected: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Inizializzazione dati
  useEffect(() => {
    let mounted = true;
    async function init() {
      setIsLoading(true);
      try {
        const [evList, odgList, qList] = await Promise.all([
          getEventi(false),
          getOdgPunti(undefined, false),
          getQuadernoPagine(false),
        ]);

        if (!mounted) return;

        // Mappa conteggio punti ODG per evento
        const counts = new Map<string, { total: number; open: number }>();
        for (const p of odgList) {
          const cur = counts.get(p.evento_id) || { total: 0, open: 0 };
          cur.total += 1;
          if (!p.completato) cur.open += 1;
          counts.set(p.evento_id, cur);
        }
        setOdgPointsCountMap(counts);

        // Ordina cronologicamente
        const sortedEventi = evList
          .filter((e) => e.deleted_at === null)
          .sort((a, b) => parseDateOnly(b.inizio).getTime() - parseDateOnly(a.inizio).getTime());
        setEventi(sortedEventi);

        const sortedQuaderno = qList
          .filter((q) => q.deleted_at === null)
          .sort((a, b) => parseDateOnly(b.data).getTime() - parseDateOnly(a.data).getTime());
        setQuadernoPagine(sortedQuaderno);

        const saved = loadStampaOdgConfig();
        const activeOdgCandidates = sortedEventi.filter((e) => {
          const notOld = isEventoDataDaDefinire(e) || !isEventOlderThan30Days(e.inizio);
          const hasPuntiOrRiunione = e.tipo === 'riunione' || (counts.get(e.id)?.total || 0) > 0;
          return notOld && hasPuntiOrRiunione;
        });

        const initialConfig: StampaOdgConfig = { ...saved };
        const noOdg = !initialConfig.selectedOdgIds || initialConfig.selectedOdgIds.length === 0;
        const noQuad = !initialConfig.selectedQuadernoIds || initialConfig.selectedQuadernoIds.length === 0;
        const noEv = !initialConfig.selectedEventiIds || initialConfig.selectedEventiIds.length === 0;

        if (noOdg && noQuad && noEv && activeOdgCandidates.length > 0) {
          initialConfig.selectedOdgIds = [activeOdgCandidates[0]!.id];
        }

        setConfig(initialConfig);
        saveStampaOdgConfig(initialConfig);

        const data = await loadPrintableODGData(initialConfig);
        if (mounted) setDataset(data);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const updateConfig = async (newConfig: StampaOdgConfig) => {
    setConfig(newConfig);
    saveStampaOdgConfig(newConfig);
    const data = await loadPrintableODGData(newConfig);
    setDataset(data);
  };

  const handleSubTabChange = (tab: OdgSubTab) => {
    setActiveSubTab(tab);
    setSearchQuery('');
    updateConfig({ ...config, activeSubTab: tab });
  };

  // Filtra eventi e ODG escludendo quelli passati da più di 30 giorni
  const activeEventi = useMemo(() => {
    return eventi.filter((e) => {
      if (isEventoDataDaDefinire(e)) return true;
      return !isEventOlderThan30Days(e.inizio);
    });
  }, [eventi]);

  // 1. Raggruppamento Eventi ODG (solo riunioni o con punti ODG entro 30 giorni)
  const odgItems = useMemo(() => {
    return activeEventi.filter(
      (e) => e.tipo === 'riunione' || (odgPointsCountMap.get(e.id)?.total || 0) > 0
    );
  }, [activeEventi, odgPointsCountMap]);

  // 2. Raggruppamento Quaderno di Clan
  const filteredQuaderno = useMemo(() => {
    if (!searchQuery.trim()) return quadernoPagine;
    return quadernoPagine.filter(
      (q) =>
        matchesQuery(q.titolo, searchQuery) ||
        matchesQuery(q.categoria, searchQuery) ||
        (q.contenuto && matchesQuery(q.contenuto, searchQuery))
    );
  }, [quadernoPagine, searchQuery]);

  // 3. Raggruppamento Eventi e Uscite (uscite, attività, scadenze entro 30 giorni)
  const eventiItems = useMemo(() => {
    return activeEventi.filter((e) => e.tipo !== 'riunione');
  }, [activeEventi]);

  // Filtri di ricerca
  const filteredOdg = useMemo(() => {
    if (!searchQuery.trim()) return odgItems;
    return odgItems.filter(
      (e) => matchesQuery(e.titolo, searchQuery) || (e.luogo && matchesQuery(e.luogo, searchQuery))
    );
  }, [odgItems, searchQuery]);

  const filteredEventi = useMemo(() => {
    if (!searchQuery.trim()) return eventiItems;
    return eventiItems.filter(
      (e) =>
        matchesQuery(e.titolo, searchQuery) ||
        (e.luogo && matchesQuery(e.luogo, searchQuery)) ||
        (e.cosa_portare && matchesQuery(e.cosa_portare, searchQuery)) ||
        matchesQuery(e.tipo, searchQuery)
    );
  }, [eventiItems, searchQuery]);

  // Array di ID selezionati 100% indipendenti per ciascuna scheda
  const selectedOdgIds = config.selectedOdgIds || [];
  const selectedQuadernoIds = config.selectedQuadernoIds || [];
  const selectedEventiIds = config.selectedEventiIds || [];

  // Toggle selezione indipendente
  const toggleOdgSelection = (id: string) => {
    const next = selectedOdgIds.includes(id)
      ? selectedOdgIds.filter((x) => x !== id)
      : [...selectedOdgIds, id];
    updateConfig({ ...config, selectedOdgIds: next, activeSubTab: 'odg' });
  };

  const toggleQuadernoSelection = (id: string) => {
    const next = selectedQuadernoIds.includes(id)
      ? selectedQuadernoIds.filter((x) => x !== id)
      : [...selectedQuadernoIds, id];
    updateConfig({ ...config, selectedQuadernoIds: next, activeSubTab: 'quaderno' });
  };

  const toggleEventiSelection = (id: string) => {
    const next = selectedEventiIds.includes(id)
      ? selectedEventiIds.filter((x) => x !== id)
      : [...selectedEventiIds, id];
    updateConfig({ ...config, selectedEventiIds: next, activeSubTab: 'eventi' });
  };

  const handleReorderOdg = (id: string, dir: 'up' | 'down') => {
    const idx = selectedOdgIds.indexOf(id);
    if (idx === -1) return;
    const next = moveItemInArray(selectedOdgIds, idx, dir);
    updateConfig({ ...config, selectedOdgIds: next });
  };

  const handleReorderQuaderno = (id: string, dir: 'up' | 'down') => {
    const idx = selectedQuadernoIds.indexOf(id);
    if (idx === -1) return;
    const next = moveItemInArray(selectedQuadernoIds, idx, dir);
    updateConfig({ ...config, selectedQuadernoIds: next });
  };

  const handleReorderEventi = (id: string, dir: 'up' | 'down') => {
    const idx = selectedEventiIds.indexOf(id);
    if (idx === -1) return;
    const next = moveItemInArray(selectedEventiIds, idx, dir);
    updateConfig({ ...config, selectedEventiIds: next });
  };

  // Seleziona / Deseleziona rapido per la tab corrente
  const selectAllCurrentTab = () => {
    if (activeSubTab === 'odg') {
      updateConfig({ ...config, selectedOdgIds: odgItems.map((e) => e.id) });
    } else if (activeSubTab === 'quaderno') {
      updateConfig({ ...config, selectedQuadernoIds: quadernoPagine.map((q) => q.id) });
    } else {
      updateConfig({ ...config, selectedEventiIds: eventiItems.map((e) => e.id) });
    }
  };

  const deselectAllCurrentTab = () => {
    if (activeSubTab === 'odg') {
      updateConfig({ ...config, selectedOdgIds: [] });
    } else if (activeSubTab === 'quaderno') {
      updateConfig({ ...config, selectedQuadernoIds: [] });
    } else {
      updateConfig({ ...config, selectedEventiIds: [] });
    }
  };

  const handlePrint = () => {
    triggerPrint('odg');
  };

  // Conteggio totale generale per la stampa cumulativa di tutto quanto selezionato
  const totalSelected = selectedOdgIds.length + selectedQuadernoIds.length + selectedEventiIds.length;

  return (
    <div className="stampa-odg-workflow">
      {/* 1. Header Stabile: Bottone Stampa SEMPRE alla destra del titolo, mai sotto */}
      <div className="stampa-screen-panel no-print" style={{ marginBottom: 'var(--space-4)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
            <SectionIcon section="calendario" size="lg" />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>
                Stampa ODG, Quaderno ed Eventi
              </h2>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Documenti A4 puliti ad alto contrasto: ODG con date, pagine del Quaderno di Clan ed eventi.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            disabled={totalSelected === 0 || isLoading}
            onClick={handlePrint}
            title={totalSelected === 0 ? 'Seleziona almeno un elemento da stampare' : 'Stampa o salva PDF'}
            style={{ flexShrink: 0 }}
          >
            <Icon name="stampa" size={18} />
            <span>Stampa ({totalSelected})</span>
          </Button>
        </div>

        {/* Selettore a 3 Categorie (ODG | Quaderno | Eventi) */}
        <div style={{ marginTop: 'var(--space-3)' }}>
          <SegmentedControl
            options={[
              { value: 'odg', label: `ODG delle riunioni (${selectedOdgIds.length})` },
              { value: 'quaderno', label: `Quaderno di Clan (${selectedQuadernoIds.length})` },
              { value: 'eventi', label: `Eventi e Uscite (${selectedEventiIds.length})` },
            ]}
            value={activeSubTab}
            onChange={(val) => handleSubTabChange(val as OdgSubTab)}
            aria-label="Scegli tipologia di contenuto da stampare"
          />
        </div>
      </div>

      {/* 2. Lista di Selezione Contenuti (Schermo) */}
      <div className="stampa-screen-panel no-print" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <SearchField
            value={searchQuery}
            onInput={setSearchQuery}
            placeholder={
              activeSubTab === 'odg'
                ? 'Cerca riunione per titolo o luogo...'
                : activeSubTab === 'quaderno'
                ? 'Cerca pagina del Quaderno per titolo, categoria o testo...'
                : 'Cerca uscita o evento per titolo, destinazione o materiali...'
            }
            aria-label="Cerca elementi da stampare"
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-3)',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {activeSubTab === 'odg' && (
              <span>
                ODG delle riunioni (ultimi 30 gg o future): <strong>{selectedOdgIds.length}</strong> di {odgItems.length} selezionati
              </span>
            )}
            {activeSubTab === 'quaderno' && (
              <span>
                Pagine del Quaderno di Clan: <strong>{selectedQuadernoIds.length}</strong> di {quadernoPagine.length} selezionate
              </span>
            )}
            {activeSubTab === 'eventi' && (
              <span>
                Eventi e uscite (ultimi 30 gg o futuri): <strong>{selectedEventiIds.length}</strong> di {eventiItems.length} selezionati
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="ios-btn ios-btn-secondary"
              style={{ minHeight: '26px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
              onClick={selectAllCurrentTab}
            >
              Seleziona tutti
            </button>
            <button
              type="button"
              className="ios-btn ios-btn-secondary"
              style={{ minHeight: '26px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
              onClick={deselectAllCurrentTab}
            >
              Nessuno
            </button>
          </div>
        </div>

        {/* SCHEDA 1: ORDINE DEL GIORNO */}
        {activeSubTab === 'odg' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredOdg.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                Nessuna riunione recente o futura trovata.
              </div>
            ) : (
              filteredOdg.map((e) => {
                const isSelected = selectedOdgIds.includes(e.id);
                const orderIdx = selectedOdgIds.indexOf(e.id);
                const dateStr = parseDateOnly(e.inizio).toLocaleDateString('it-IT', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                const odgStats = odgPointsCountMap.get(e.id) || { total: 0, open: 0 };

                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        flex: 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOdgSelection(e.id)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <div style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 'var(--font-size-sm)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {e.titolo}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--font-size-2xs)',
                            color: 'var(--color-text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '2px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>{dateStr}</span>
                          {e.luogo && <span>• {e.luogo}</span>}
                          <Badge variant={odgStats.total > 0 ? 'azzurro' : 'neutral'} size="sm">
                            {odgStats.total} {odgStats.total === 1 ? 'punto ODG' : 'punti ODG'}
                            {odgStats.total > 0 && ` (${odgStats.open} da discutere)`}
                          </Badge>
                        </div>
                      </div>
                    </label>

                    {isSelected && (
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="stampa-reorder-btn"
                          disabled={orderIdx <= 0}
                          onClick={() => handleReorderOdg(e.id, 'up')}
                          aria-label={`Sposta su ${e.titolo}`}
                        >
                          <Icon name="chevron-up" size={14} />
                        </button>
                        <button
                          type="button"
                          className="stampa-reorder-btn"
                          disabled={orderIdx >= selectedOdgIds.length - 1}
                          onClick={() => handleReorderOdg(e.id, 'down')}
                          aria-label={`Sposta giù ${e.titolo}`}
                        >
                          <Icon name="chevron-down" size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SCHEDA 2: QUADERNO DI CLAN */}
        {activeSubTab === 'quaderno' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredQuaderno.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                Nessuna pagina del Quaderno di Clan trovata.
              </div>
            ) : (
              filteredQuaderno.map((q) => {
                const isSelected = selectedQuadernoIds.includes(q.id);
                const orderIdx = selectedQuadernoIds.indexOf(q.id);
                const dateStr = parseDateOnly(q.data).toLocaleDateString('it-IT', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                const snippet = q.contenuto
                  ? q.contenuto.replace(/[#*`_~]/g, '').slice(0, 110) + (q.contenuto.length > 110 ? '...' : '')
                  : '(Pagina vuota)';

                return (
                  <div
                    key={q.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        flex: 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleQuadernoSelection(q.id)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: 'var(--font-size-sm)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {q.titolo}
                          </span>
                          <Badge variant="azzurro" size="sm">
                            {q.categoria.toUpperCase()}
                          </Badge>
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--font-size-2xs)',
                            color: 'var(--color-text-secondary)',
                            marginTop: '2px',
                          }}
                        >
                          <span>{dateStr}</span>
                          <span style={{ marginLeft: '6px', fontStyle: 'italic', opacity: 0.85 }}>
                            • "{snippet}"
                          </span>
                        </div>
                      </div>
                    </label>

                    {isSelected && (
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="stampa-reorder-btn"
                          disabled={orderIdx <= 0}
                          onClick={() => handleReorderQuaderno(q.id, 'up')}
                          aria-label={`Sposta su ${q.titolo}`}
                        >
                          <Icon name="chevron-up" size={14} />
                        </button>
                        <button
                          type="button"
                          className="stampa-reorder-btn"
                          disabled={orderIdx >= selectedQuadernoIds.length - 1}
                          onClick={() => handleReorderQuaderno(q.id, 'down')}
                          aria-label={`Sposta giù ${q.titolo}`}
                        >
                          <Icon name="chevron-down" size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SCHEDA 3: EVENTI E USCITE */}
        {activeSubTab === 'eventi' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredEventi.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                Nessun evento o uscita recente o futura trovata.
              </div>
            ) : (
              filteredEventi.map((e) => {
                const isSelected = selectedEventiIds.includes(e.id);
                const orderIdx = selectedEventiIds.indexOf(e.id);
                const dateStr = parseDateOnly(e.inizio).toLocaleDateString('it-IT', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        flex: 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEventiSelection(e.id)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: 'var(--font-size-sm)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {e.titolo}
                          </span>
                          <Badge
                            variant={
                              e.tipo === 'uscita'
                                ? 'giallo'
                                : e.tipo === 'scadenza'
                                ? 'rosso'
                                : 'azzurro'
                            }
                            size="sm"
                          >
                            {e.tipo.toUpperCase()}
                          </Badge>
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--font-size-2xs)',
                            color: 'var(--color-text-secondary)',
                            marginTop: '2px',
                          }}
                        >
                          <span>{dateStr}</span>
                          {e.luogo && <span>• Luogo: {e.luogo}</span>}
                          {e.cosa_portare && (
                            <span style={{ marginLeft: '6px', color: 'var(--color-text-tertiary)' }}>
                              (Cosa portare: {e.cosa_portare})
                            </span>
                          )}
                        </div>
                      </div>
                    </label>

                    {isSelected && (
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="stampa-reorder-btn"
                          disabled={orderIdx <= 0}
                          onClick={() => handleReorderEventi(e.id, 'up')}
                          aria-label={`Sposta su ${e.titolo}`}
                        >
                          <Icon name="chevron-up" size={14} />
                        </button>
                        <button
                          type="button"
                          className="stampa-reorder-btn"
                          disabled={orderIdx >= selectedEventiIds.length - 1}
                          onClick={() => handleReorderEventi(e.id, 'down')}
                          aria-label={`Sposta giù ${e.titolo}`}
                        >
                          <Icon name="chevron-down" size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 3. Contenitore di Stampa A4: invisibile a schermo, attivo solo per la stampa di sistema / PDF */}
      <div id="stampa-odg-root" className="stampa-print-container stampa-print-container-odg">
        {dataset.totalSelected > 0 && (
          <div className="print-odg-wrapper">
            {/* 1. SEZIONE ORDINI DEL GIORNO SELEZIONATI */}
            {dataset.odgItems &&
              dataset.odgItems.map((item) => (
                <article key={`odg-${item.evento.id}`} className="print-odg-event-card stampa-preview-paper">
                  <header className="print-odg-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="print-odg-badge-tipo">ORDINE DEL GIORNO</span>
                        <h1 className="print-odg-title">{item.evento.titolo}</h1>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '10pt', color: 'oklch(0.3 0 0)' }}>
                        <div>Data di stampa: {formatPrintDate()}</div>
                      </div>
                    </div>

                    <div className="print-odg-meta-row">
                      <span><strong>Data:</strong> {item.dataFormattata}</span>
                      {item.orarioFormattato && <span><strong>Orario:</strong> {item.orarioFormattato}</span>}
                      {item.evento.luogo && <span><strong>Luogo:</strong> {item.evento.luogo}</span>}
                      {item.evento.responsabile && <span><strong>Responsabile:</strong> {item.evento.responsabile}</span>}
                    </div>
                    <hr className="print-odg-divider" />
                  </header>

                  <section className="print-odg-section">
                    <h2 className="print-odg-section-title">
                      Punti all'Ordine del Giorno ({item.punti.length})
                    </h2>

                    {item.punti.length === 0 ? (
                      <div style={{ fontStyle: 'italic', color: 'oklch(0.4 0 0)', padding: '6pt 0' }}>
                        Nessun punto OdG inserito per questa riunione.
                      </div>
                    ) : (
                      <div className="print-odg-punti-list">
                        {item.punti.map((p, idx) => {
                          const statusConfig = STATO_BADGES[p.stato];
                          return (
                            <div key={p.id} className="print-odg-punto-item">
                              <div className="print-odg-punto-header">
                                <span className="print-odg-punto-number">{idx + 1}.</span>
                                <span className="print-odg-punto-text">{p.cleanTesto}</span>
                                <span className={`print-odg-status-badge ${statusConfig.printClass}`}>
                                  {statusConfig.label}
                                </span>
                              </div>
                              {p.riportatoDa && (
                                <div className="print-odg-punto-sub">
                                  Riportato dalla riunione precedente
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </article>
              ))}

            {/* 2. SEZIONE PAGINE DEL QUADERNO DI CLAN */}
            {dataset.quadernoPagine &&
              dataset.quadernoPagine.map((qp) => (
                <article key={`quaderno-${qp.id}`} className="print-odg-event-card stampa-preview-paper">
                  <header className="print-odg-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="print-odg-badge-tipo">QUADERNO DI CLAN: {qp.categoria.toUpperCase()}</span>
                        <h1 className="print-odg-title">{qp.titolo}</h1>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '10pt', color: 'oklch(0.3 0 0)' }}>
                        <div>Data di stampa: {formatPrintDate()}</div>
                      </div>
                    </div>

                    <div className="print-odg-meta-row">
                      <span>
                        <strong>Data:</strong>{' '}
                        {parseDateOnly(qp.data).toLocaleDateString('it-IT', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <span><strong>Categoria:</strong> {qp.categoria}</span>
                    </div>
                    <hr className="print-odg-divider" />
                  </header>

                  <section className="print-odg-section">
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontSize: '11pt',
                        lineHeight: 1.6,
                        padding: '4pt 0',
                        color: 'oklch(0.1 0 0)',
                      }}
                    >
                      {qp.contenuto}
                    </div>
                  </section>
                </article>
              ))}

            {/* 3. SEZIONE APPUNTI E VERBALI DI RIUNIONE */}
            {dataset.appuntiEventi &&
              dataset.appuntiEventi.map((item) => (
                <article key={`appunti-${item.evento.id}`} className="print-odg-event-card stampa-preview-paper">
                  <header className="print-odg-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="print-odg-badge-tipo">
                          {item.evento.tipo === 'riunione' ? 'VERBALE RIUNIONE' : `APPUNTI ${item.evento.tipo.toUpperCase()}`}
                        </span>
                        <h1 className="print-odg-title">{item.evento.titolo}</h1>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '10pt', color: 'oklch(0.3 0 0)' }}>
                        <div>Data di stampa: {formatPrintDate()}</div>
                      </div>
                    </div>

                    <div className="print-odg-meta-row">
                      <span><strong>Data:</strong> {item.dataFormattata}</span>
                      {item.orarioFormattato && <span><strong>Orario:</strong> {item.orarioFormattato}</span>}
                      {item.evento.luogo && <span><strong>Luogo:</strong> {item.evento.luogo}</span>}
                      {item.evento.responsabile && <span><strong>Responsabile:</strong> {item.evento.responsabile}</span>}
                    </div>
                    <hr className="print-odg-divider" />
                  </header>

                  <section className="print-odg-section">
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontSize: '11pt',
                        lineHeight: 1.6,
                        padding: '4pt 0',
                        color: 'oklch(0.1 0 0)',
                      }}
                    >
                      {item.evento.appunti || '(Nessun appunto testuale registrato)'}
                    </div>
                  </section>
                </article>
              ))}

            {/* 4. SEZIONE EVENTI E USCITE */}
            {dataset.eventiItems &&
              dataset.eventiItems.map((item) => (
                <article key={`evento-${item.evento.id}`} className="print-odg-event-card stampa-preview-paper">
                  <header className="print-odg-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="print-odg-badge-tipo">{item.evento.tipo.toUpperCase()}</span>
                        <h1 className="print-odg-title">{item.evento.titolo}</h1>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '10pt', color: 'oklch(0.3 0 0)' }}>
                        <div>Data di stampa: {formatPrintDate()}</div>
                      </div>
                    </div>

                    <div className="print-odg-meta-row">
                      <span><strong>Data:</strong> {item.dataFormattata}</span>
                      {item.orarioFormattato && <span><strong>Orario:</strong> {item.orarioFormattato}</span>}
                      {item.evento.luogo && <span><strong>Destinazione / Luogo:</strong> {item.evento.luogo}</span>}
                      {item.evento.responsabile && <span><strong>Responsabile:</strong> {item.evento.responsabile}</span>}
                    </div>
                    <hr className="print-odg-divider" />
                  </header>

                  {/* Equipaggiamento / Cosa Portare se presente */}
                  {item.evento.cosa_portare && item.evento.cosa_portare.trim() && (
                    <section className="print-odg-section" style={{ breakInside: 'avoid' }}>
                      <h2 className="print-odg-section-title">Equipaggiamento e Cosa Portare</h2>
                      <div
                        style={{
                          border: '1.5pt solid oklch(0 0 0)',
                          padding: '8pt 12pt',
                          borderRadius: '3pt',
                          fontSize: '11pt',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          fontWeight: 500,
                        }}
                      >
                        {item.evento.cosa_portare}
                      </div>
                    </section>
                  )}

                  {/* Programma e Indicazioni se presenti */}
                  {item.cleanDescrizione && (
                    <section className="print-odg-section">
                      <h2 className="print-odg-section-title">Programma e Indicazioni</h2>
                      <div
                        style={{
                          fontSize: '10.5pt',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          color: 'oklch(0.15 0 0)',
                        }}
                      >
                        {item.cleanDescrizione}
                      </div>
                    </section>
                  )}
                </article>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default StampaOdg;
