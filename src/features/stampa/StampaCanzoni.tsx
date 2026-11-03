// src/features/stampa/StampaCanzoni.tsx
// Flusso indipendente di Stampa per il Canzoniere Scout in formato A4:
// - Due varianti: "Chi suona" (con accordi) e "Chi canta" (solo testo)
// - Regola RIT.: ritornello intero la prima volta; dalla seconda in poi solo etichetta RIT. in grassetto
// - Layout adattivo ad alto rendimento (1 colonna full-width o 2 colonne, massimizzazione font 9-28pt)
// - Selezione canti a colonna singola raggruppata per settore con page-level scrolling (nessun scrollbox interno)
// - Ordinamento deterministico per settore e poi alfabetico
// - Fisarmonica Opzioni compatta (chiusa di default)
// - Sticky bottom bar su desktop e mobile con riepilogo conteggio pagine, pulsante Anteprima e Stampa/Salva PDF
// - Anteprima A4 fedele in proporzione 1 : 1.414 con ombra ed effetto carta reale

import { useState, useEffect, useMemo } from 'preact/hooks';
import { Canto, getCanti } from '../../lib/db';
import { DANZA_LA_VITA_PARSED, DEFAULT_PARSED_SONGS } from '../../data/parsed_songs';
import {
  StampaCanzoniConfig,
  loadStampaCanzoniConfig,
  saveStampaCanzoniConfig,
  loadPrintableCanzoniData,
  PrintableCanzoniDataset,
  CanzoniereSectorKey,
  getSectorKey,
  normalizeTitleForSort,
} from '../../lib/stampa_canzoni';
import { layoutCanzoniereSong } from '../canti/canzoniere_layout';
import { triggerPrint } from '../../lib/stampa_shared';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { SectionIcon } from '../../ui/SectionIcon';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { SearchField } from '../../ui/SearchField';
import { matchesQuery } from '../../lib/search';
import { CanzonierePageRenderer } from '../canti/CanzonierePageRenderer';
import { ensureCanzoniereFontsLoaded } from '../canti/canzoniere_fonts';

const SECTORS_LIST: Array<{ key: CanzoniereSectorKey; label: string }> = [
  { key: 'scout', label: 'Canti Scout' },
  { key: 'esterni', label: 'Canti Esterni' },
  { key: 'chiesa', label: 'Canti di Chiesa' },
  { key: 'altre', label: 'Altre Canzoni' },
];

export function StampaCanzoni() {
  const [config, setConfig] = useState<StampaCanzoniConfig>(() => loadStampaCanzoniConfig());
  const [canti, setCanti] = useState<Canto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataset, setDataset] = useState<PrintableCanzoniDataset>({
    items: [],
    pages: [],
    indexResult: {
      hasCover: false,
      coverPage: null,
      indexPageStart: 1,
      indexPageCount: 0,
      sectors: [],
      indexPages: [],
      totalPages: 0,
    },
    hasAnyOverflow: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRecomputing, setIsRecomputing] = useState(false);

  // Inizializzazione canti e caricamento font
  useEffect(() => {
    let mounted = true;
    async function init() {
      setIsLoading(true);
      try {
        await ensureCanzoniereFontsLoaded().catch(() => {});
        const cList = await getCanti(false);
        const enriched = cList.map((c) => {
          if (
            c.id === DANZA_LA_VITA_PARSED.id &&
            (!c.testo_chordpro.includes('Cammina sulle [Fa]orme') ||
              c.testo_chordpro.includes('cuor. Danza assieme a no----------------oi!'))
          ) {
            return { ...c, ...DANZA_LA_VITA_PARSED };
          }
          return c;
        });
        for (const defSong of DEFAULT_PARSED_SONGS) {
          const idx = enriched.findIndex(
            (c) => c.id === defSong.id || c.titolo.toLowerCase() === defSong.titolo.toLowerCase()
          );
          if (idx === -1) {
            enriched.push(defSong as Canto);
          } else {
            const existing = enriched[idx];
            if (existing && !existing.testo_chordpro && defSong.testo_chordpro) {
              enriched[idx] = { ...existing, ...defSong };
            }
          }
        }
        if (!mounted) return;
        setCanti(enriched);
        const data = await loadPrintableCanzoniData(config, enriched);
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

  const updateConfig = async (newConfig: StampaCanzoniConfig) => {
    setConfig(newConfig);
    saveStampaCanzoniConfig(newConfig);
    setIsRecomputing(true);
    try {
      const data = await loadPrintableCanzoniData(newConfig, canti);
      setDataset(data);
    } finally {
      setIsRecomputing(false);
    }
  };

  const toggleCantoSelection = (id: string) => {
    const next = config.selectedCantiIds.includes(id)
      ? config.selectedCantiIds.filter((x) => x !== id)
      : [...config.selectedCantiIds, id];
    updateConfig({ ...config, selectedCantiIds: next });
  };

  const selectAll = () => {
    const allIds = canti.map((c) => c.id);
    updateConfig({ ...config, selectedCantiIds: allIds });
  };

  const deselectAll = () => {
    updateConfig({ ...config, selectedCantiIds: [] });
  };

  const toggleSectorSelection = (_sectorKey: CanzoniereSectorKey, sectorSongIds: string[]) => {
    const allSelected = sectorSongIds.every((id) => config.selectedCantiIds.includes(id));
    if (allSelected) {
      // Deseleziona tutte le canzoni del settore
      const next = config.selectedCantiIds.filter((id) => !sectorSongIds.includes(id));
      updateConfig({ ...config, selectedCantiIds: next });
    } else {
      // Seleziona tutte le canzoni del settore
      const next = Array.from(new Set([...config.selectedCantiIds, ...sectorSongIds]));
      updateConfig({ ...config, selectedCantiIds: next });
    }
  };

  // Calcolo memoizzato del numero di pagine di ciascun canto
  const songPageCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of dataset.items) {
      map.set(item.canto.id, item.layoutResult.pages.length);
    }
    for (const c of canti) {
      if (!map.has(c.id)) {
        if (!c.testo_chordpro) {
          map.set(c.id, 1);
        } else {
          const layoutRes = layoutCanzoniereSong(c, {
            mode: config.mode,
            layoutMode: config.layoutMode,
          });
          map.set(c.id, layoutRes.pages.length);
        }
      }
    }
    return map;
  }, [canti, dataset.items, config.mode, config.layoutMode]);

  // Canti raggruppati per settore e ordinati alfabeticamente
  const sectorGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return SECTORS_LIST.map(({ key, label }) => {
      const sectorSongs = canti.filter((c) => getSectorKey(c.categoria) === key);
      const filtered = sectorSongs.filter((c) => {
        if (!query) return true;
        return (
          matchesQuery(c.titolo, query) ||
          (c.autore ? matchesQuery(c.autore, query) : false) ||
          (c.categoria ? matchesQuery(c.categoria, query) : false)
        );
      });

      // Ordina alfabeticamente per titolo normalizzato
      filtered.sort((a, b) => {
        const normA = normalizeTitleForSort(a.titolo);
        const normB = normalizeTitleForSort(b.titolo);
        return normA.localeCompare(normB, 'it');
      });

      return {
        key,
        label,
        songs: filtered,
        totalInSector: sectorSongs.length,
      };
    });
  }, [canti, searchQuery]);

  const selectedCount = config.selectedCantiIds.length;

  return (
    <div className="stampa-canzoni-workflow stampa-workflow-shell">
      {/* 1. HEADER CHIARO E PROMINENTE: Bottone SEMPRE alla destra del titolo */}
      <div className="stampa-hero-card no-print">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
            <SectionIcon section="canti" size="lg" />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>
                Canzoniere A4
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Fascicolo A4 stampabile per reparto e clan con impaginazione continua ad alto rendimento e indice per settori.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={() => triggerPrint('canzoni')}
            disabled={selectedCount === 0 || isLoading || isRecomputing}
            title={selectedCount === 0 ? 'Seleziona almeno un canto' : 'Stampa o salva in PDF il Canzoniere'}
            style={{ flexShrink: 0 }}
          >
            <Icon name="stampa" size={18} />
            <span>Stampa ({selectedCount})</span>
          </Button>
        </div>

        {/* 2. BIVIO PRINCIPALE: "Per chi stampi?", slider indice e stima pagine */}
        <div
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--color-text)' }}>
                Per chi stampi?
              </label>
              <SegmentedControl
                options={[
                  { value: 'suona', label: 'Chi suona (con accordi)' },
                  { value: 'canta', label: 'Chi canta (solo testo)' },
                ]}
                value={config.mode}
                onChange={(val) => updateConfig({ ...config, mode: val as 'suona' | 'canta' })}
                aria-label="Per chi stampi il canzoniere"
              />
            </div>

            <div>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--color-text)' }}>
                Indice canti
              </span>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  minHeight: '36px',
                }}
              >
                <ToggleSwitch
                  id="toggle-include-index"
                  checked={config.includeIndex}
                  onChange={(checked) => updateConfig({ ...config, includeIndex: checked })}
                  aria-label="Includi indice dei canti"
                />
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
                  {config.includeIndex ? 'Includi indice' : 'Senza indice'}
                </span>
              </label>
            </div>
          </div>

          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
            <strong>{selectedCount}</strong> {selectedCount === 1 ? 'canto selezionato' : 'canti selezionati'}
            <span style={{ margin: '0 8px', color: 'var(--color-text-tertiary)' }}>·</span>
            <span>circa <strong>{dataset.indexResult.totalPages}</strong> {dataset.indexResult.totalPages === 1 ? 'pagina' : 'pagine'}</span>
            {isRecomputing && (
              <span style={{ marginLeft: '12px', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                (ricalcolo in corso...)
              </span>
            )}
          </div>
        </div>
      </div>

      {dataset.hasAnyOverflow && (
        <div className="stampa-overflow-alert no-print">
          <Icon name="info" size={18} />
          <span>
            Questa pagina non entra: alcuni canti selezionati superano l'altezza A4 e richiedono più pagine o riduzione margini.
          </span>
        </div>
      )}

      {/* 4. SELEZIONE CANTI A COLONNA SINGOLA RAGGRUPPATA PER SETTORE */}
      <div className="no-print" style={{ width: '100%' }}>
        {/* Barra di ricerca e comandi globali */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <SearchField
            value={searchQuery}
            onInput={setSearchQuery}
            placeholder="Cerca per titolo, autore o settore..."
            aria-label="Cerca canti per la stampa"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="info" size={14} />
            <span>Ordine di stampa: per settore, poi alfabetico (come l'indice).</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Seleziona tutti ({canti.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Nessuno
            </Button>
          </div>
        </div>

        {/* Lista dei settori a sviluppo verticale naturale (page-level scroll) */}
        {sectorGroups.map((group) => {
          if (group.songs.length === 0 && searchQuery.trim()) return null;

          const sectorSongIds = group.songs.map((s) => s.id);
          const selectedInSector = sectorSongIds.filter((id) => config.selectedCantiIds.includes(id)).length;
          const allInSectorSelected = sectorSongIds.length > 0 && selectedInSector === sectorSongIds.length;

          return (
            <div key={group.key} className="stampa-sector-section">
              <div className="stampa-sector-header">
                <h3 className="stampa-sector-title">
                  <span>{group.label}</span>
                  <Badge variant={selectedInSector > 0 ? 'azzurro' : 'neutral'} size="sm">
                    {selectedInSector} di {group.songs.length}
                  </Badge>
                </h3>
                {group.songs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSectorSelection(group.key, sectorSongIds)}
                    style={{ fontSize: 'var(--font-size-xs)', height: '28px', padding: '0 8px' }}
                  >
                    {allInSectorSelected ? 'Nessuno' : 'Seleziona tutti'}
                  </Button>
                )}
              </div>

              {group.songs.length === 0 ? (
                <div style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                  Nessun canto presente in questo settore.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {group.songs.map((c) => {
                    const isSelected = config.selectedCantiIds.includes(c.id);
                    const pages = songPageCounts.get(c.id) || 1;

                    return (
                      <div
                        key={c.id}
                        className={`stampa-song-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleCantoSelection(c.id)}
                      >
                        <label
                          className="stampa-song-checkbox-label"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="stampa-song-checkbox"
                            checked={isSelected}
                            onChange={() => toggleCantoSelection(c.id)}
                            aria-label={`Seleziona ${c.titolo}`}
                          />
                          <div className="stampa-song-info">
                            <div className="stampa-song-title">{c.titolo}</div>
                            <div className="stampa-song-meta">
                              {c.autore || 'Autore sconosciuto'}
                            </div>
                          </div>
                        </label>

                        <Badge
                          variant={pages > 1 ? 'giallo' : 'neutral'}
                          size="sm"
                          style={{ flexShrink: 0, marginLeft: '8px' }}
                        >
                          {pages} {pages === 1 ? 'pag.' : 'pag.'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contenitore di Stampa A4: invisibile a schermo, attivo solo per la stampa di sistema / PDF */}
      <div id="stampa-canzoni-root" className="stampa-print-container stampa-print-container-canzoni">
        {selectedCount > 0 && (
          <div className="canzoniere-book-container">
            {/* INDICE PER SETTORI A INIZIO CANZONIERE */}
            {config.includeIndex && dataset.indexResult.sectors.length > 0 && (
              (dataset.indexResult.indexPages && dataset.indexResult.indexPages.length > 0
                ? dataset.indexResult.indexPages
                : [{
                    pageNumber: dataset.indexResult.indexPageStart,
                    isFirstIndexPage: true,
                    sectors: dataset.indexResult.sectors,
                  }]
              ).map((idxPage) => (
                <div key={`index-sheet-${idxPage.pageNumber}`} className="stampa-a4-sheet-card">
                  <div className="canzoniere-index-page print-index-page">
                    <h1 className="print-index-title">
                      INDICE DEI CANTI{' '}
                      <span className="print-index-subtitle">
                        ({config.mode === 'suona' ? 'con accordi' : 'senza accordi'})
                        {!idxPage.isFirstIndexPage && ' — continua'}
                      </span>
                    </h1>

                    {idxPage.sectors.map((sector) => (
                      <div key={`${sector.key}-${idxPage.pageNumber}`} className="print-index-sector">
                        <div className="print-index-sector-title">
                          {sector.label}
                        </div>
                        <div className="print-index-entries-list">
                          {sector.entries.map((entry) => (
                            <div key={entry.id} className="print-index-row">
                              <span className="print-index-row-title">
                                {entry.titolo}
                                {entry.autore && (
                                  <span className="print-index-row-author">
                                    ({entry.autore})
                                  </span>
                                )}
                              </span>
                              <span className="print-index-dots" />
                              <div className="print-index-pages-badge">
                                {entry.otherModePage && (
                                  <span className="print-index-cross-page">
                                    [{config.mode === 'suona' ? 'canta' : 'suona'}: p. {entry.otherModePage}]
                                  </span>
                                )}
                                <span className="print-index-main-page">
                                  p. {entry.startPage}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <footer className="canzoniere-index-footer">
                      <span className="canzoniere-page-number">— {idxPage.pageNumber} —</span>
                    </footer>
                  </div>
                </div>
              ))
            )}

            {/* PAGINE DEL CANZONIERE (FLUSSO CONTINUO) */}
            {dataset.pages && dataset.pages.length > 0 ? (
              <div className="canzoniere-book-container">
                {dataset.pages.map((page, pIdx) => (
                  <div key={`canzoniere-page-${pIdx}`} className="stampa-a4-sheet-card canzoniere-page">
                    <CanzonierePageRenderer
                      page={page}
                      isScreenPreview={false}
                    />
                  </div>
                ))}
              </div>
            ) : (
              dataset.items.map((item) => (
                <div key={item.canto.id} className="print-song-book-item">
                  {item.layoutResult.pages.map((page, pIdx) => (
                    <div key={`${item.canto.id}-p${pIdx}`} className="stampa-a4-sheet-card">
                      <CanzonierePageRenderer
                        page={page}
                        isScreenPreview={false}
                      />
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
