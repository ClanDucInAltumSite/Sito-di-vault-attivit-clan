import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { JSX } from 'preact';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import {
  TouchLine,
  TouchChord,
  parseChordProToTouchLines,
  touchLinesToChordPro,
  generateChordId,
  copyChordsProportional,
  applyProgressionToBlock,
  copyFromPreviousBlock,
  groupLinesIntoBlocks,
} from './touch_chord_utils';
import {
  getDiatonicChords,
  inferKeyFromFirstChord,
} from '../../lib/chord_theory';
import { normalizeChord } from './chord_detection';

export interface TouchChordEditorProps {
  chordproText: string;
  tonalita?: string | null;
  onChange: (newChordPro: string) => void;
  onClose?: () => void;
}

const ROOT_NOTES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const MODIFIERS = ['', 'm', '7', 'maj7', 'sus4', 'add9', 'dim', 'm7'];
const ACCIDENTALS = ['', '#', 'b'];

export function TouchChordEditor({
  chordproText,
  tonalita,
  onChange,
  onClose,
}: TouchChordEditorProps) {
  // 1. Stato righe e cronologia Undo / Redo
  const [lines, setLines] = useState<TouchLine[]>(() => parseChordProToTouchLines(chordproText));
  const [history, setHistory] = useState<TouchLine[][]>([]);
  const [redoStack, setRedoStack] = useState<TouchLine[][]>([]);

  // 2. Selezione corrente: riga e posizione cursore (boundary di carattere)
  const [activeLineIdx, setActiveLineIdx] = useState<number>(0);
  const [cursorCharIdx, setCursorCharIdx] = useState<number | null>(null);

  // 3. Accordo selezionato per modifica / spostamento / eliminazione
  const [selectedChord, setSelectedChord] = useState<{
    lineIdx: number;
    chordId: string;
  } | null>(null);

  // 4. Stato composizione tavolozza accordi
  const [paletteRoot, setPaletteRoot] = useState<string>('Do');
  const [paletteAccidental, setPaletteAccidental] = useState<string>('');
  const [paletteModifier, setPaletteModifier] = useState<string>('');
  const [paletteBass, setPaletteBass] = useState<string>('');
  const [showBassSelector, setShowBassSelector] = useState<boolean>(false);

  // 5. Storico accordi recenti usati nella sessione
  const [recentChords, setRecentChords] = useState<string[]>(['Do', 'Sol', 'Lam', 'Fa']);
  const [lastUsedChord, setLastUsedChord] = useState<string>('Do');

  // 6. Riferimento per auto-scroll riga attiva
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // 7. Determina la tonalità per ordinare i suggerimenti:
  // Usa il campo Tonalità se compilato, altrimenti deduce dal primo accordo
  // (SOLO per i suggerimenti: non viene mai salvata automaticamente nel database)
  const effectiveKeyForSuggestions = useMemo(() => {
    if (tonalita && tonalita.trim()) {
      return tonalita.trim();
    }
    // Cerca il primo accordo inserito nel testo
    for (const l of lines) {
      if (l.chords.length > 0 && l.chords[0]) {
        return inferKeyFromFirstChord(l.chords[0].chord) || 'Do';
      }
    }
    return 'Do';
  }, [tonalita, lines]);

  // Accordi della tonalità (I, ii, iii, IV, V, vi, V7)
  const tonalitaSuggestions = useMemo(() => {
    return getDiatonicChords(effectiveKeyForSuggestions);
  }, [effectiveKeyForSuggestions]);

  // Accordo composto corrente nella tavolozza
  const currentComposedChord = useMemo(() => {
    let c = `${paletteRoot}${paletteAccidental}${paletteModifier}`;
    if (paletteBass) {
      c += `/${paletteBass}`;
    }
    return normalizeChord(c);
  }, [paletteRoot, paletteAccidental, paletteModifier, paletteBass]);

  // Notifica le modifiche al genitore garantendo ChordPro come Single Source of Truth
  const commitLines = (newLines: TouchLine[], recordHistory = true) => {
    if (recordHistory) {
      setHistory((prev) => [...prev.slice(-30), lines]);
      setRedoStack([]);
    }
    setLines(newLines);
    const serialized = touchLinesToChordPro(newLines);
    onChange(serialized);
  };

  // Funzioni Undo e Redo
  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    if (!previous) return;
    setRedoStack((prev) => [...prev, lines]);
    setHistory((prev) => prev.slice(0, -1));
    setLines(previous);
    onChange(touchLinesToChordPro(previous));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setHistory((prev) => [...prev, lines]);
    setRedoStack((prev) => prev.slice(0, -1));
    setLines(next);
    onChange(touchLinesToChordPro(next));
  };

  // Inserimento o sostituzione accordo alla posizione del cursore
  const insertChordAtCursor = (chordToInsert: string) => {
    if (activeLineIdx < 0 || activeLineIdx >= lines.length) return;
    const curLine = lines[activeLineIdx];
    if (!curLine || curLine.isDirective) return;

    const norm = normalizeChord(chordToInsert);
    const targetCharIdx = cursorCharIdx !== null ? cursorCharIdx : 0;

    // Aggiungi ai recenti
    setLastUsedChord(norm);
    setRecentChords((prev) => [norm, ...prev.filter((c) => c !== norm)].slice(0, 8));

    // Se stiamo spostando un accordo selezionato
    if (selectedChord && selectedChord.lineIdx === activeLineIdx) {
      const updatedChords = curLine.chords.map((c) =>
        c.id === selectedChord.chordId ? { ...c, chord: norm, charIndex: targetCharIdx } : c
      );
      const newLines = lines.map((l, idx) =>
        idx === activeLineIdx ? { ...l, chords: updatedChords } : l
      );
      commitLines(newLines);
      setSelectedChord(null);
      return;
    }

    // Inserimento nuovo accordo
    const newChordObj: TouchChord = {
      id: generateChordId(),
      chord: norm,
      charIndex: targetCharIdx,
    };

    // Rimuovi eventuale accordo duplicato esattamente allo stesso indice carattere
    const filteredChords = curLine.chords.filter((c) => c.charIndex !== targetCharIdx);
    const updatedChords = [...filteredChords, newChordObj].sort(
      (a, b) => a.charIndex - b.charIndex
    );

    const newLines = lines.map((l, idx) =>
      idx === activeLineIdx ? { ...l, chords: updatedChords } : l
    );
    commitLines(newLines);

    // Sposta il cursore leggermente avanti se c'è testo
    if (cursorCharIdx !== null && cursorCharIdx < curLine.lyrics.length) {
      // Cerca lo spazio successivo o avanza di qualche carattere
      const nextSpace = curLine.lyrics.indexOf(' ', cursorCharIdx + 1);
      if (nextSpace !== -1 && nextSpace < curLine.lyrics.length) {
        setCursorCharIdx(nextSpace + 1);
      }
    }
  };

  // Eliminazione dell'accordo selezionato o di quello sotto al cursore
  const handleDeleteChord = (lineIdx: number, chordId: string) => {
    const targetLine = lines[lineIdx];
    if (!targetLine) return;
    const updatedChords = targetLine.chords.filter((c) => c.id !== chordId);
    const newLines = lines.map((l, idx) =>
      idx === lineIdx ? { ...l, chords: updatedChords } : l
    );
    commitLines(newLines);
    setSelectedChord(null);
  };

  // Click su un punto della riga per calcolare il confine di carattere più vicino
  const handleLineTap = (lineIdx: number, e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    const line = lines[lineIdx];
    if (!line || line.isDirective || line.isEmpty) return;

    setActiveLineIdx(lineIdx);
    setSelectedChord(null);

    // Controlla se il tocco è avvenuto su uno span carattere
    const target = e.target as HTMLElement;
    const charSpan = target.closest('[data-char-idx]');

    if (charSpan) {
      const idxAttr = charSpan.getAttribute('data-char-idx');
      if (idxAttr !== null) {
        const baseIdx = parseInt(idxAttr, 10);
        const rect = charSpan.getBoundingClientRect();
        const clickOffset = e.clientX - rect.left;
        // Se il tocco è nella seconda metà del carattere, posiziona il cursore subito dopo
        const finalIdx = clickOffset > rect.width / 2 ? baseIdx + 1 : baseIdx;
        setCursorCharIdx(Math.min(finalIdx, line.lyrics.length));
        return;
      }
    }

    // Fallback: se cliccato fuori dal testo (fine riga), posiziona a inizio o fine riga
    const container = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - container.left;
    if (relativeX < 40) {
      setCursorCharIdx(0);
    } else {
      setCursorCharIdx(line.lyrics.length);
    }
  };

  // Scorciatoia: "Copia gli accordi dalla riga precedente"
  const handleCopyFromPreviousLine = () => {
    if (activeLineIdx <= 0) return;
    // Cerca la prima riga di testo precedente con accordi
    let sourceLine: TouchLine | null = null;
    for (let i = activeLineIdx - 1; i >= 0; i--) {
      const candidate = lines[i];
      if (candidate && candidate.chords.length > 0 && !candidate.isDirective) {
        sourceLine = candidate;
        break;
      }
    }
    if (!sourceLine) return;

    const targetLine = lines[activeLineIdx];
    if (!targetLine) return;

    const updated = copyChordsProportional(sourceLine, targetLine);
    const newLines = lines.map((l, idx) => (idx === activeLineIdx ? updated : l));
    commitLines(newLines);
  };

  // Scorciatoia: "Applica la stessa progressione a tutte le righe del blocco"
  const handleApplyProgressionToBlock = () => {
    const activeLine = lines[activeLineIdx];
    if (!activeLine || activeLine.chords.length === 0) return;

    const blocks = groupLinesIntoBlocks(lines);
    let flatIdx = 0;
    let targetBlockIdx = -1;

    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b];
      if (!block) continue;
      if (activeLineIdx >= flatIdx && activeLineIdx < flatIdx + block.length) {
        targetBlockIdx = b;
        break;
      }
      flatIdx += block.length;
    }

    if (targetBlockIdx === -1) return;
    const targetBlock = blocks[targetBlockIdx];
    if (!targetBlock) return;

    const updatedBlock = applyProgressionToBlock(targetBlock, activeLine);
    blocks[targetBlockIdx] = updatedBlock;
    commitLines(blocks.flat());
  };

  // Scorciatoia: "Copia dalla strofa sopra"
  const handleCopyFromPreviousBlock = () => {
    const updatedAll = copyFromPreviousBlock(lines, activeLineIdx);
    commitLines(updatedAll);
  };

  // Supporto tastiera (frecce sinistra/destra per muovere cursore, frecce su/giù per cambio riga)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se l'utente sta scrivendo in un input testuale
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursorCharIdx((prev) => (prev !== null ? Math.max(0, prev - 1) : 0));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const curLine = lines[activeLineIdx];
        const maxLen = curLine ? curLine.lyrics.length : 0;
        setCursorCharIdx((prev) => (prev !== null ? Math.min(maxLen, prev + 1) : maxLen));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeLineIdx > 0) {
          setActiveLineIdx((prev) => prev - 1);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeLineIdx < lines.length - 1) {
          setActiveLineIdx((prev) => prev + 1);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedChord) {
          e.preventDefault();
          handleDeleteChord(selectedChord.lineIdx, selectedChord.chordId);
        }
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLineIdx, cursorCharIdx, lines, selectedChord, history, redoStack]);

  return (
    <div
      className="touch-chord-editor-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        padding: 'var(--space-3)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* 1. Header con Annulla/Ripeti e info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h4
            style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              color: 'var(--color-ink)',
            }}
          >
            Editor Accordi a Tocco
          </h4>
          <Badge variant="azzurro" size="sm">
            Tonalità: {effectiveKeyForSuggestions}
          </Badge>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={history.length === 0}
            aria-label="Annulla ultima modifica"
            title="Annulla (Ctrl+Z)"
          >
            <Icon name="refresh" size={14} style={{ transform: 'scaleX(-1)' }} />
            <span style={{ marginLeft: '4px' }}>Annulla</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label="Ripeti modifica"
            title="Ripeti (Ctrl+Y)"
          >
            <Icon name="refresh" size={14} />
            <span style={{ marginLeft: '4px' }}>Ripeti</span>
          </Button>

          {onClose && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              <Icon name="check" size={14} />
              <span style={{ marginLeft: '4px' }}>Fatto</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Area Testo Interattiva (Righe con sillabe e accordi sopra) */}
      <div
        className="touch-editor-lines-area"
        style={{
          maxHeight: '380px',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border-subtle)',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          userSelect: 'none',
        }}
      >
        {lines.map((line, lIdx) => {
          const isActiveLine = lIdx === activeLineIdx;

          // Se è una direttiva
          if (line.isDirective) {
            return (
              <div
                key={line.id}
                style={{
                  fontSize: '12px',
                  fontStyle: 'italic',
                  color: 'var(--color-text-secondary)',
                  padding: '2px 8px',
                }}
              >
                {line.directiveText}
              </div>
            );
          }

          // Se è riga vuota
          if (line.isEmpty) {
            return (
              <div
                key={line.id}
                style={{
                  height: '14px',
                  borderBottom: '1px dashed var(--color-border-subtle)',
                }}
              />
            );
          }

          // Mappa accordi per indice carattere
          const chordsByChar = new Map<number, TouchChord[]>();
          for (const c of line.chords) {
            const list = chordsByChar.get(c.charIndex) || [];
            list.push(c);
            chordsByChar.set(c.charIndex, list);
          }

          return (
            <div
              key={line.id}
              ref={isActiveLine ? activeLineRef : null}
              onClick={(e) => handleLineTap(lIdx, e)}
              className={`touch-song-line ${isActiveLine ? 'touch-line-active' : ''}`}
              style={{
                position: 'relative',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActiveLine
                  ? 'var(--color-canti-tenue)'
                  : 'transparent',
                borderLeft: line.isRitLabel
                  ? '4px solid var(--color-giochi)'
                  : isActiveLine
                  ? '4px solid var(--color-canti)'
                  : '4px solid transparent',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              {/* Riga superiore degli accordi allineati */}
              <div
                className="touch-chords-row"
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: '24px',
                  position: 'relative',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--color-ink)',
                }}
              >
                {line.chords.map((chord) => {
                  const isSelected =
                    selectedChord?.lineIdx === lIdx && selectedChord.chordId === chord.id;

                  // Posizione orizzontale stimata per la badge dell'accordo
                  return (
                    <span
                      key={chord.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLineIdx(lIdx);
                        setCursorCharIdx(chord.charIndex);
                        setSelectedChord(
                          isSelected ? null : { lineIdx: lIdx, chordId: chord.id }
                        );
                      }}
                      className="touch-chord-pill"
                      style={{
                        marginRight: '6px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: isSelected
                          ? 'var(--color-canti)'
                          : 'var(--color-surface)',
                        color: isSelected ? '#ffffff' : 'var(--color-ink)',
                        border: isSelected
                          ? '1px solid var(--color-canti)'
                          : '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-xs)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Tocca per opzioni o eliminazione"
                    >
                      <span>{chord.chord}</span>
                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChord(lIdx, chord.id);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          aria-label={`Elimina accordo ${chord.chord}`}
                        >
                          <Icon name="close" size={12} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>

              {/* Riga del testo con span per ogni carattere */}
              <div
                className="touch-lyrics-row"
                style={{
                  fontSize: '17px',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--color-text)',
                  lineHeight: 1.4,
                  position: 'relative',
                  letterSpacing: '0.01em',
                }}
              >
                {line.lyrics.split('').map((char, charIdx) => {
                  const isCursorHere =
                    isActiveLine && cursorCharIdx === charIdx;

                  return (
                    <span
                      key={charIdx}
                      data-char-idx={charIdx}
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                      }}
                    >
                      {/* Cursore visivo ad ancora */}
                      {isCursorHere && (
                        <span
                          className="touch-cursor-anchor"
                          style={{
                            position: 'absolute',
                            top: '-8px',
                            left: '0px',
                            width: '2px',
                            height: '24px',
                            backgroundColor: 'var(--color-canti)',
                            zIndex: 10,
                            pointerEvents: 'none',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              left: '-4px',
                              fontSize: '10px',
                              color: 'var(--color-canti)',
                              lineHeight: 1,
                            }}
                          >
                            ▼
                          </span>
                        </span>
                      )}
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  );
                })}

                {/* Cursore a fine riga */}
                {isActiveLine && cursorCharIdx === line.lyrics.length && (
                  <span
                    className="touch-cursor-anchor"
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '2px',
                      height: '20px',
                      backgroundColor: 'var(--color-canti)',
                      marginLeft: '2px',
                      verticalAlign: 'middle',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        left: '-4px',
                        fontSize: '10px',
                        color: 'var(--color-canti)',
                        lineHeight: 1,
                      }}
                    >
                      ▼
                    </span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Barra Suggerimenti Tonalità e Ultimo Accordo Usato */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          padding: '8px 12px',
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Riga 1: Ripeti Ultimo & Recenti */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => insertChordAtCursor(lastUsedChord)}
            style={{ fontWeight: 700 }}
          >
            <span>Ripeti l'ultimo: [{lastUsedChord}]</span>
          </Button>

          <span
            style={{
              fontSize: 'var(--font-size-2xs)',
              color: 'var(--color-text-secondary)',
              fontWeight: 600,
            }}
          >
            Recenti:
          </span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {recentChords.map((rc) => (
              <button
                key={rc}
                type="button"
                className="ios-badge ios-badge-neutral ios-badge-sm"
                style={{ cursor: 'pointer', border: '1px solid var(--color-border)', padding: '2px 8px' }}
                onClick={() => insertChordAtCursor(rc)}
              >
                {rc}
              </button>
            ))}
          </div>
        </div>

        {/* Riga 2: Accordi tipici della Tonalità */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 'var(--font-size-2xs)',
              color: 'var(--color-text-secondary)',
              fontWeight: 600,
            }}
          >
            Accordi tonalità ({effectiveKeyForSuggestions}):
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {tonalitaSuggestions.map((chord) => (
              <button
                key={chord}
                type="button"
                className="ios-badge ios-badge-azzurro ios-badge-sm"
                style={{
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: '3px 9px',
                  boxShadow: 'var(--shadow-xs)',
                }}
                onClick={() => insertChordAtCursor(chord)}
              >
                {chord}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Tavolozza Accordi Completa */}
      <div
        className="touch-palette-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px 12px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-ink)' }}>
            Tavolozza Rapida:
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-canti)' }}>
            [{currentComposedChord}]
          </span>
        </div>

        {/* Selezione Radice (Do, Re, Mi, Fa, Sol, La, Si) */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {ROOT_NOTES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setPaletteRoot(r)}
              className={`ios-btn ios-btn-sm ${paletteRoot === r ? 'ios-btn-primary' : 'ios-btn-secondary'}`}
              style={{ flex: 1, minWidth: '40px', padding: '6px 4px', fontWeight: 700 }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Selezione Alterazione (#, b) e Modificatori (m, 7, maj7, sus4, add9, dim) */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Alterazione */}
          {ACCIDENTALS.map((acc) => (
            <button
              key={acc || 'nat'}
              type="button"
              onClick={() => setPaletteAccidental(paletteAccidental === acc ? '' : acc)}
              className={`ios-btn ios-btn-sm ${paletteAccidental === acc && acc !== '' ? 'ios-btn-primary' : 'ios-btn-secondary'}`}
              style={{ minWidth: '32px', padding: '4px 6px', fontWeight: 700 }}
            >
              {acc || '–'}
            </button>
          ))}

          <span style={{ width: '1px', height: '18px', backgroundColor: 'var(--color-border)', margin: '0 4px' }} />

          {/* Modificatore */}
          {MODIFIERS.map((mod) => (
            <button
              key={mod || 'maj'}
              type="button"
              onClick={() => setPaletteModifier(paletteModifier === mod ? '' : mod)}
              className={`ios-btn ios-btn-sm ${paletteModifier === mod ? 'ios-btn-primary' : 'ios-btn-secondary'}`}
              style={{ minWidth: '34px', padding: '4px 6px', fontSize: '12px' }}
            >
              {mod || 'M'}
            </button>
          ))}

          {/* Basso / Slash */}
          <button
            type="button"
            onClick={() => setShowBassSelector(!showBassSelector)}
            className={`ios-btn ios-btn-sm ${paletteBass ? 'ios-btn-primary' : 'ios-btn-secondary'}`}
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            {paletteBass ? `/${paletteBass}` : '/ Basso'}
          </button>

          {/* Pulsante Inserisci accordo composto */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => insertChordAtCursor(currentComposedChord)}
            style={{ marginLeft: 'auto', fontWeight: 700 }}
          >
            <Icon name="plus" size={14} />
            <span style={{ marginLeft: '4px' }}>Inserisci [{currentComposedChord}]</span>
          </Button>
        </div>

        {/* Selettore rapido del basso se aperto */}
        {showBassSelector && (
          <div
            style={{
              display: 'flex',
              gap: '4px',
              flexWrap: 'wrap',
              padding: '6px',
              backgroundColor: 'var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', alignSelf: 'center', marginRight: '4px' }}>
              Basso (slash):
            </span>
            <button
              type="button"
              onClick={() => {
                setPaletteBass('');
                setShowBassSelector(false);
              }}
              className="ios-badge ios-badge-neutral ios-badge-sm"
              style={{ cursor: 'pointer' }}
            >
              Nessuno
            </button>
            {['Do', 'Re', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si'].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setPaletteBass(b);
                  setShowBassSelector(false);
                }}
                className={`ios-badge ${paletteBass === b ? 'ios-badge-azzurro' : 'ios-badge-neutral'} ios-badge-sm`}
                style={{ cursor: 'pointer' }}
              >
                /{b}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 5. Scorciatoie per canti ripetitivi (mai automatiche) */}
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
          Scorciatoie di duplicazione:
        </span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyFromPreviousLine}
            disabled={activeLineIdx === 0}
            title="Copia gli accordi della riga precedente posizionandoli proporzionalmente"
          >
            Copia da riga precedente
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleApplyProgressionToBlock}
            disabled={lines[activeLineIdx]?.chords.length === 0}
            title="Applica questa progressione a tutte le altre righe di questa strofa"
          >
            Applica al blocco
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyFromPreviousBlock}
            title="Copia la progressione dalla strofa precedente"
          >
            Copia da strofa sopra
          </Button>
        </div>
      </div>
    </div>
  );
}
