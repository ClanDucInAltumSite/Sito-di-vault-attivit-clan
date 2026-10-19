import { useState, useMemo } from 'preact/hooks';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ChordProRenderer } from '../../lib/chordpro';
import {
  cleanPastedText,
  reconstructWithActiveChanges,
  CleanerChange,
} from './canzoniere_cleaner';
import { parsePastedText, ParsedCantoResult } from './canzoniere_parser';

export interface CantoPasteReviewViewProps {
  rawText: string;
  isMonospace: boolean;
  onConfirm: (result: ParsedCantoResult) => void;
  onBackToEdit: () => void;
}

export function CantoPasteReviewView({
  rawText,
  isMonospace,
  onConfirm,
  onBackToEdit,
}: CantoPasteReviewViewProps) {
  // 1. Pulizia iniziale del testo e tracciamento modifiche
  const initialClean = useMemo(() => cleanPastedText(rawText), [rawText]);
  const [changes, setChanges] = useState<CleanerChange[]>(initialClean.changes);
  const [mobileTab, setMobileTab] = useState<'result' | 'original'>('result');

  // 2. Linee modificate manualmente (unioni o divisioni aggiuntive)
  const [manualLines, setManualLines] = useState<string[] | null>(null);
  const [selectedLineForMerge, setSelectedLineForMerge] = useState<number | null>(null);

  // 3. Calcolo del risultato corrente basato sulle modifiche abilitate
  const currentLines = useMemo(() => {
    if (manualLines !== null) return manualLines;
    return reconstructWithActiveChanges(initialClean.originalLines, changes);
  }, [manualLines, initialClean.originalLines, changes]);

  // 4. Parsing del testo corrente in ChordPro
  const parsedResult = useMemo(() => {
    const textToParse = currentLines.join('\n');
    return parsePastedText(textToParse, { isMonospace });
  }, [currentLines, isMonospace]);

  // Toggle singola modifica (annulla / ripristina)
  const toggleChange = (id: string) => {
    setManualLines(null); // reset manual edits se si cambiano le regole automatiche
    setChanges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  // Unione manuale di due righe consecutive
  const handleMergeNextLine = (idx: number) => {
    if (idx < 0 || idx >= currentLines.length - 1) return;
    const nextLines = [...currentLines];
    const lineA = nextLines[idx] || '';
    const lineB = nextLines[idx + 1] || '';
    nextLines.splice(idx, 2, `${lineA.trim()} ${lineB.trim()}`);
    setManualLines(nextLines);
    setSelectedLineForMerge(null);
  };

  // Divisione manuale di una riga a metà
  const handleSplitLine = (idx: number) => {
    const line = currentLines[idx];
    if (!line) return;
    const words = line.trim().split(/\s+/);
    if (words.length < 2) return;
    const mid = Math.ceil(words.length / 2);
    const lineA = words.slice(0, mid).join(' ');
    const lineB = words.slice(mid).join(' ');
    const nextLines = [...currentLines];
    nextLines.splice(idx, 1, lineA, lineB);
    setManualLines(nextLines);
  };

  return (
    <div className="canto-review-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Intestazione revisione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-ink)' }}>
            Revisione Intelligente del Canto
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Controlla le modifiche automatiche, gli accordi rilevati e gli avvisi prima di confermare.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBackToEdit}>
          <Icon name="chevron-left" size={14} />
          <span style={{ marginLeft: '4px' }}>Modifica testo grezzo</span>
        </Button>
      </div>

      {/* Avvisi e Diagnostica */}
      {parsedResult.warnings.length > 0 && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-giochi-subtle)',
            borderLeft: '4px solid var(--color-giochi)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-ink)',
          }}
          role="status"
        >
          <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="info" size={14} style={{ color: 'var(--color-giochi-text)' }} />
            <span>Avvisi e verifiche ({parsedResult.warnings.length}):</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {parsedResult.warnings.map((w, idx) => (
              <li key={idx} style={{ marginTop: '2px' }}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Switcher vista mobile */}
      <div className="canto-review-mobile-switcher" style={{ display: 'none' }}>
        <SegmentedControl
          options={[
            { value: 'result', label: 'Risultato con Accordi' },
            { value: 'original', label: 'Testo Originale' },
          ]}
          value={mobileTab}
          onChange={(val) => setMobileTab(val as 'result' | 'original')}
        />
      </div>

      {/* Griglia a 2 Colonne: Originale vs Risultato */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-4)',
          alignItems: 'start',
        }}
        className="canto-review-grid"
      >
        {/* Colonna Sinistra: Testo Originale Incollato */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
          className={mobileTab === 'original' ? 'canto-review-pane-active' : 'canto-review-pane-desktop'}
        >
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--color-border-subtle)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>Testo Originale ({initialClean.originalLines.length} righe)</span>
            <Badge variant="neutral">Input grezzo</Badge>
          </div>
          <div
            style={{
              padding: '12px',
              maxHeight: '340px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--color-text)',
            }}
          >
            {initialClean.originalLines.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--color-text-tertiary)', userSelect: 'none', width: '28px', textAlign: 'right', flexShrink: 0 }}>
                  {idx + 1}
                </span>
                <span style={{ flex: 1 }}>{line || ' '}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Colonna Destra: Risultato con Accordi Rilevati */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
          className={mobileTab === 'result' ? 'canto-review-pane-active' : 'canto-review-pane-desktop'}
        >
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--color-canti-tenue)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-canti)',
            }}
          >
            <span>Risultato Elaborato ({parsedResult.stats.chordsCount} accordi)</span>
            <Badge variant="azzurro">ChordPro</Badge>
          </div>
          <div
            style={{
              padding: '16px 12px',
              maxHeight: '340px',
              overflowY: 'auto',
            }}
          >
            <ChordProRenderer
              chordproText={parsedResult.testo_chordpro}
              showChords={true}
            />
          </div>
        </div>
      </div>

      {/* Riquadro Modifiche Applicate (Ciascuna Annullabile) */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-ink)' }}>
            Modifiche automatiche ({changes.length})
          </h4>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
            Tocca "Annulla" per ripristinare il testo originale di una singola modifica
          </span>
        </div>

        {changes.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Nessun rumore web o anomalia rilevata: il testo era già pulito.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {changes.map((ch) => {
              const badgeVariant: 'rosso' | 'azzurro' | 'giallo' | 'neutral' =
                ch.type === 'noise'
                  ? 'rosso'
                  : ch.type === 'label'
                  ? 'azzurro'
                  : ch.type === 'join'
                  ? 'giallo'
                  : 'neutral';

              const badgeLabel =
                ch.type === 'noise'
                  ? 'Rumore'
                  : ch.type === 'label'
                  ? 'Etichetta'
                  : ch.type === 'join'
                  ? 'Riga unita'
                  : 'Sillabazione';

              return (
                <div
                  key={ch.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: ch.enabled ? 'var(--color-surface-hover)' : 'var(--color-border-subtle)',
                    opacity: ch.enabled ? 1 : 0.6,
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text)',
                        textDecoration: ch.enabled ? 'none' : 'line-through',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ch.description}
                    </span>
                  </div>

                  <Button
                    variant={ch.enabled ? 'ghost' : 'secondary'}
                    size="sm"
                    onClick={() => toggleChange(ch.id)}
                    style={{ fontSize: '11px', height: '24px', padding: '0 8px', flexShrink: 0 }}
                  >
                    {ch.enabled ? 'Annulla' : 'Ripristina'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Strumenti Manuali Righe (Unisci / Dividi) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          Strumenti di rifinitura rapida:
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            className="ios-form-input"
            style={{ fontSize: '12px', height: '32px', padding: '0 8px', minHeight: '32px', width: 'auto' }}
            value={selectedLineForMerge !== null ? selectedLineForMerge : ''}
            onChange={(e) => {
              const val = (e.target as HTMLSelectElement).value;
              setSelectedLineForMerge(val ? parseInt(val, 10) : null);
            }}
          >
            <option value="">Seleziona riga...</option>
            {currentLines.map((line, idx) => (
              <option key={idx} value={idx}>
                Riga {idx + 1}: {line.slice(0, 25)}...
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={selectedLineForMerge === null || selectedLineForMerge >= currentLines.length - 1}
            onClick={() => {
              if (selectedLineForMerge !== null) {
                handleMergeNextLine(selectedLineForMerge);
              }
            }}
          >
            <Icon name="plus" size={12} />
            <span>Unisci con successiva</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={selectedLineForMerge === null}
            onClick={() => {
              if (selectedLineForMerge !== null) {
                handleSplitLine(selectedLineForMerge);
              }
            }}
          >
            <Icon name="edit" size={12} />
            <span>Dividi riga a metà</span>
          </Button>
        </div>
      </div>

      {/* Azione di Conferma Finale */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: 'var(--space-2)' }}>
        <Button variant="ghost" onClick={onBackToEdit}>
          Torna indietro
        </Button>
        <Button variant="primary" onClick={() => onConfirm(parsedResult)}>
          <Icon name="check" size={16} />
          <span style={{ marginLeft: '6px' }}>Conferma e compila scheda</span>
        </Button>
      </div>
    </div>
  );
}
