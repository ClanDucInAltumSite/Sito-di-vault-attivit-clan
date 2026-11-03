// src/features/stampa/StampaGiochiBans.tsx
// Flusso indipendente di Stampa per Giochi e Bans in formato A4 continuo.
// Include selezione personalizzata, riordino, immagini allegate, anteprima e stampa isolata.

import { useState, useEffect, useMemo } from 'preact/hooks';
import { Gioco, Ban, getGiochi, getBans } from '../../lib/db';
import {
  StampaGiochiBansConfig,
  loadStampaGiochiBansConfig,
  saveStampaGiochiBansConfig,
  loadPrintableGiochiBansData,
  PrintableGiochiBansData,
} from '../../lib/stampa_giochibans';
import { moveItemInArray, triggerPrint } from '../../lib/stampa_shared';
import { I18N } from '../../lib/i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { SectionIcon } from '../../ui/SectionIcon';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SearchField } from '../../ui/SearchField';
import { matchesQuery } from '../../lib/search';

export function StampaGiochiBans() {
  const [config, setConfig] = useState<StampaGiochiBansConfig>(() => loadStampaGiochiBansConfig());
  const [giochi, setGiochi] = useState<Gioco[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'tutti' | 'giochi' | 'bans'>('tutti');
  const [printableData, setPrintableData] = useState<PrintableGiochiBansData>({
    giochi: [],
    bans: [],
    totalSelected: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setIsLoading(true);
      try {
        const [gList, bList] = await Promise.all([getGiochi(false), getBans(false)]);
        if (!mounted) return;
        setGiochi(gList);
        setBans(bList);
        const pData = await loadPrintableGiochiBansData(config);
        if (mounted) setPrintableData(pData);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const updateConfig = async (newConfig: StampaGiochiBansConfig) => {
    setConfig(newConfig);
    saveStampaGiochiBansConfig(newConfig);
    const pData = await loadPrintableGiochiBansData(newConfig);
    setPrintableData(pData);
  };

  const toggleSelection = (section: 'giochi' | 'bans', id: string) => {
    if (section === 'giochi') {
      const next = config.selectedGiochiIds.includes(id)
        ? config.selectedGiochiIds.filter((x) => x !== id)
        : [...config.selectedGiochiIds, id];
      updateConfig({ ...config, selectedGiochiIds: next });
    } else {
      const next = config.selectedBansIds.includes(id)
        ? config.selectedBansIds.filter((x) => x !== id)
        : [...config.selectedBansIds, id];
      updateConfig({ ...config, selectedBansIds: next });
    }
  };

  const handleReorder = (section: 'giochi' | 'bans', id: string, dir: 'up' | 'down') => {
    if (section === 'giochi') {
      const idx = config.selectedGiochiIds.indexOf(id);
      if (idx === -1) return;
      const next = moveItemInArray(config.selectedGiochiIds, idx, dir);
      updateConfig({ ...config, selectedGiochiIds: next });
    } else {
      const idx = config.selectedBansIds.indexOf(id);
      if (idx === -1) return;
      const next = moveItemInArray(config.selectedBansIds, idx, dir);
      updateConfig({ ...config, selectedBansIds: next });
    }
  };

  const selectAll = (section: 'giochi' | 'bans') => {
    if (section === 'giochi') {
      updateConfig({ ...config, selectedGiochiIds: giochi.map((g) => g.id) });
    } else {
      updateConfig({ ...config, selectedBansIds: bans.map((b) => b.id) });
    }
  };

  const deselectAll = (section: 'giochi' | 'bans') => {
    if (section === 'giochi') {
      updateConfig({ ...config, selectedGiochiIds: [] });
    } else {
      updateConfig({ ...config, selectedBansIds: [] });
    }
  };

  const handlePrint = () => {
    triggerPrint('giochibans');
  };

  const filteredGiochi = useMemo(() => {
    if (!searchQuery.trim()) return giochi;
    return giochi.filter((g) => matchesQuery(searchQuery, g.nome, g.materiali || '', g.regole || ''));
  }, [giochi, searchQuery]);

  const filteredBans = useMemo(() => {
    if (!searchQuery.trim()) return bans;
    return bans.filter((b) => matchesQuery(searchQuery, b.nome, b.testo || '', b.note_gesti || ''));
  }, [bans, searchQuery]);

  const totalSelected = config.selectedGiochiIds.length + config.selectedBansIds.length;

  return (
    <div>
      {/* Controlli a Schermo */}
      <div className="no-print">
        {/* Card Azione Stampa */}
        <div
          className="ios-card"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <SectionIcon section="giochi" size="md" />
                <SectionIcon section="bans" size="md" />
                <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>
                  Stampa Giochi e Bans
                </h2>
              </div>
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  margin: '4px 0 0',
                  maxWidth: '520px',
                }}
              >
                Formato A4 continuo a consumo d'inchiostro ridotto per attività di reparto e clan.
              </p>
            </div>

            <Button
              variant="primary"
              onClick={handlePrint}
              disabled={totalSelected === 0 || isLoading}
              style={{ flexShrink: 0 }}
            >
              <Icon name="stampa" size={18} />
              <span>Stampa ({totalSelected})</span>
            </Button>
          </div>

          <div
            style={{
              marginTop: 'var(--space-3)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
              <ToggleSwitch
                checked={config.includeImages}
                onChange={(checked) => updateConfig({ ...config, includeImages: checked })}
                aria-label={I18N.stampa.includiImmagini}
              />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                {I18N.stampa.includiImmagini}
              </span>
            </label>

            <Badge variant={totalSelected > 0 ? 'azzurro' : 'neutral'} size="sm">
              {totalSelected} selezionati ({config.selectedGiochiIds.length} giochi, {config.selectedBansIds.length} bans)
            </Badge>
          </div>
        </div>

        {/* Ricerca e Filtro */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <SearchField
            value={searchQuery}
            onInput={setSearchQuery}
            placeholder="Cerca giochi e bans per nome, regole o gesti..."
            aria-label="Cerca giochi e bans da stampare"
          />
          <SegmentedControl
            options={[
              { value: 'tutti', label: `Tutti (${totalSelected})` },
              { value: 'giochi', label: `Giochi (${config.selectedGiochiIds.length}/${giochi.length})` },
              { value: 'bans', label: `Bans (${config.selectedBansIds.length}/${bans.length})` },
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val as any)}
          />
        </div>

        {/* Lista Giochi */}
        {(activeTab === 'tutti' || activeTab === 'giochi') && (
          <div className="ios-card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <SectionIcon section="giochi" size="sm" />
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>
                  Giochi ({config.selectedGiochiIds.length}/{giochi.length})
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="button" className="ios-btn ios-btn-secondary" style={{ minHeight: '26px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }} onClick={() => selectAll('giochi')}>
                  {I18N.stampa.selezionaTutto}
                </button>
                <button type="button" className="ios-btn ios-btn-secondary" style={{ minHeight: '26px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }} onClick={() => deselectAll('giochi')}>
                  {I18N.stampa.deselezionaTutto}
                </button>
              </div>
            </div>

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
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection('giochi', g.id)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{g.nome}</div>
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
                          aria-label={`Sposta su ${g.nome}`}
                        >
                          <Icon name="chevron-up" size={14} />
                        </button>
                        <button
                          type="button"
                          className="stampa-reorder-btn"
                          disabled={orderIndex >= config.selectedGiochiIds.length - 1}
                          onClick={() => handleReorder('giochi', g.id, 'down')}
                          aria-label={`Sposta giù ${g.nome}`}
                        >
                          <Icon name="chevron-down" size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lista Bans */}
        {(activeTab === 'tutti' || activeTab === 'bans') && (
          <div className="ios-card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <SectionIcon section="bans" size="sm" />
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>
                  Bans ({config.selectedBansIds.length}/{bans.length})
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="button" className="ios-btn ios-btn-secondary" style={{ minHeight: '26px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }} onClick={() => selectAll('bans')}>
                  {I18N.stampa.selezionaTutto}
                </button>
                <button type="button" className="ios-btn ios-btn-secondary" style={{ minHeight: '26px', padding: '0 8px', fontSize: 'var(--font-size-xs)' }} onClick={() => deselectAll('bans')}>
                  {I18N.stampa.deselezionaTutto}
                </button>
              </div>
            </div>

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
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection('bans', b.id)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{b.nome}</div>
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
                          aria-label={`Sposta su ${b.nome}`}
                        >
                          <Icon name="chevron-up" size={14} />
                        </button>
                        <button
                          type="button"
                          className="stampa-reorder-btn"
                          disabled={orderIndex >= config.selectedBansIds.length - 1}
                          onClick={() => handleReorder('bans', b.id, 'down')}
                          aria-label={`Sposta giù ${b.nome}`}
                        >
                          <Icon name="chevron-down" size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Contenitore di Stampa A4: attivo per la stampa di sistema / PDF */}
      <div id="stampa-giochibans-root" className="stampa-print-container-giochibans">
        {totalSelected > 0 && (
          <div className="print-continuous">
            {printableData.giochi.length > 0 && (
              <section>
                <div className="print-section-header">Giochi ({printableData.giochi.length})</div>
                {printableData.giochi.map((pg) => (
                  <article key={pg.gioco.id} className={pg.isShort ? 'print-item-short' : 'print-item-long'}>
                    <h3 className="print-title">{pg.gioco.nome}</h3>
                    {pg.gioco.materiali && (
                      <div style={{ marginBottom: '4pt' }}>
                        <span className="print-subtitle-label">Materiali: </span>
                        <span className="print-body-text">{pg.gioco.materiali}</span>
                      </div>
                    )}
                    <div style={{ marginTop: '4pt' }}>
                      <span className="print-subtitle-label">Regole: </span>
                      <div className="print-body-text">{pg.gioco.regole}</div>
                    </div>
                    {config.includeImages && pg.images.length > 0 && (
                      <div className="print-attachment-container">
                        {pg.images.map((img, idx) =>
                          img.src ? (
                            <img key={idx} src={img.src} alt={img.name} className="print-attachment-image" />
                          ) : (
                            <div key={idx} className="print-img-warning">
                              [Immagine offline non disponibile: {img.name}]
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}

            {printableData.bans.length > 0 && (
              <section style={{ marginTop: printableData.giochi.length > 0 ? '16pt' : 0 }}>
                <div className="print-section-header">Bans ({printableData.bans.length})</div>
                {printableData.bans.map((pb) => (
                  <article key={pb.ban.id} className={pb.isShort ? 'print-item-short' : 'print-item-long'}>
                    <h3 className="print-title">{pb.ban.nome}</h3>
                    {pb.ban.note_gesti && (
                      <div style={{ marginBottom: '4pt' }}>
                        <span className="print-subtitle-label">Note e Gesti: </span>
                        <span className="print-body-text">{pb.ban.note_gesti}</span>
                      </div>
                    )}
                    <div className="print-body-text">{pb.ban.testo}</div>
                    {config.includeImages && pb.images.length > 0 && (
                      <div className="print-attachment-container">
                        {pb.images.map((img, idx) =>
                          img.src ? (
                            <img key={idx} src={img.src} alt={img.name} className="print-attachment-image" />
                          ) : (
                            <div key={idx} className="print-img-warning">
                              [Immagine offline non disponibile: {img.name}]
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
