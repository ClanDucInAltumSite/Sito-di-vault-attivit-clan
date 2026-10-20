/**
 * src/features/canti/CantoReviewModal.tsx
 *
 * Schermata di Revisione Grande per il Canzoniere (Fase 11D).
 * Fullscreen, 2 pannelli su desktop (editor + anteprima A4), schede su telefono.
 * Casella di testo a spaziatura fissa senza scroll orizzontale, dimensione 12-18px.
 * Barra fissa con accordi rapidi, direttive, annulla/ripeti.
 * Riquadro avvisi con salto riga e ripristino righe rumore.
 * Bozza automatica IndexedDB ogni 2 secondi (max 10).
 */

import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Canto, CategoriaCanto } from '../../lib/db';
import { saveCanto } from '../../lib/admin_actions';
import { layoutCanzoniereSong } from './canzoniere_layout';
import { CanzonierePageRenderer } from './CanzonierePageRenderer';
import {
  saveCantoDraft,
  loadLatestCantoDraft,
  clearCantoDraft,
  deleteCantoDraft,
  formatDraftTime,
  CantoDraft,
} from './canto_draft';
import { PdfImportWarning, RemovedNoiseItem } from './pdf_importer';

export interface CantoReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (canto: Canto) => void;
  initialCanto?: Canto | null;
  existingTitles: string[];
  importedData?: {
    titolo?: string;
    autore?: string | null;
    categoria?: CategoriaCanto | null;
    tonalita?: string | null;
    misura?: string | null;
    tempo_bpm?: number | null;
    bpm_testo?: string | null;
    ritmo?: string | null;
    capotasto?: number | null;
    origine?: string | null;
    nota_fonte?: string | null;
    testo_chordpro: string;
    warnings?: PdfImportWarning[];
    removedNoise?: RemovedNoiseItem[];
    pdfBytes?: Uint8Array | null;
  } | null;
}

export function CantoReviewModal({
  isOpen,
  onClose,
  onSaved,
  initialCanto,
  existingTitles,
  importedData,
}: CantoReviewModalProps) {
  if (!isOpen) return null;

  // Campi del Canto
  const [titolo, setTitolo] = useState(
    importedData?.titolo || initialCanto?.titolo || ''
  );
  const [categoria, setCategoria] = useState<CategoriaCanto | ''>(
    importedData?.categoria || initialCanto?.categoria || ''
  );
  const [autore, setAutore] = useState(
    importedData?.autore || initialCanto?.autore || ''
  );
  const [tonalita, setTonalita] = useState(
    importedData?.tonalita || initialCanto?.tonalita || ''
  );
  const [misura, setMisura] = useState(
    importedData?.misura || initialCanto?.misura || ''
  );
  const [bpmTesto, setBpmTesto] = useState(
    importedData?.bpm_testo ||
      (initialCanto?.bpm_testo ? String(initialCanto.bpm_testo) : '') ||
      (initialCanto?.tempo_bpm ? String(initialCanto.tempo_bpm) : '')
  );
  const [ritmo, setRitmo] = useState(
    importedData?.ritmo || initialCanto?.ritmo || ''
  );
  const [capotasto, setCapotasto] = useState<string>(
    importedData?.capotasto !== undefined && importedData?.capotasto !== null
      ? String(importedData.capotasto)
      : initialCanto?.capotasto !== undefined && initialCanto?.capotasto !== null
      ? String(initialCanto.capotasto)
      : ''
  );
  const [origine, setOrigine] = useState(
    importedData?.origine || initialCanto?.origine || 'manuale'
  );
  const [notaFonte, setNotaFonte] = useState(
    importedData?.nota_fonte || initialCanto?.nota_fonte || ''
  );
  const [testoChordpro, setTestoChordpro] = useState(
    importedData?.testo_chordpro || initialCanto?.testo_chordpro || ''
  );

  // Sezione richiudibile "Altre informazioni"
  const [showExtraInfo, setShowExtraInfo] = useState(false);

  // Tab per dispositivi mobili: 'testo' | 'anteprima'
  const [mobileTab, setMobileTab] = useState<'testo' | 'anteprima'>('testo');

  // Dimensione carattere editor (12-18 px)
  const [editorFontSize, setEditorFontSize] = useState<number>(14);

  // Visualizzazione pagina PDF originale (solo desktop)
  const [showOriginalPdf, setShowOriginalPdf] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);

  // Avvisi e righe tolte
  const [warnings, setWarnings] = useState<PdfImportWarning[]>(
    importedData?.warnings || []
  );
  const [removedNoise, setRemovedNoise] = useState<RemovedNoiseItem[]>(
    importedData?.removedNoise || []
  );
  const [showWarningsDrawer, setShowWarningsDrawer] = useState(true);

  // Cronologia per Annulla/Ripeti
  const [history, setHistory] = useState<string[]>([testoChordpro]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Bozza automatica IndexedDB (Fase 11D)
  const [activeDraft, setActiveDraft] = useState<CantoDraft | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Stati operativi
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  // Controllo bozze salvate al montaggio
  useEffect(() => {
    let isMounted = true;
    async function checkDraft() {
      const candidate = await loadLatestCantoDraft(initialCanto?.id || null);
      if (isMounted && candidate) {
        // Se la bozza ha contenuto diverso da quello attuale, proponi riprendi/elimina
        const isDifferent =
          candidate.titolo !== titolo ||
          candidate.testo_chordpro !== testoChordpro;
        if (isDifferent) {
          setActiveDraft(candidate);
          setShowDraftPrompt(true);
        }
      }
    }
    checkDraft();
    return () => {
      isMounted = false;
    };
  }, []);

  // Timer di salvataggio automatico ogni 2 secondi se dirty
  useEffect(() => {
    const timer = setInterval(() => {
      if (isDirty && (titolo.trim() || testoChordpro.trim())) {
        saveCantoDraft({
          titolo,
          categoria: (categoria || null) as CategoriaCanto | null,
          autore,
          misura,
          bpm_testo: bpmTesto,
          ritmo,
          capotasto,
          tonalita,
          origine,
          nota_fonte: notaFonte,
          testo_chordpro: testoChordpro,
          initialCantoId: initialCanto?.id || null,
        }).then(() => {
          setDraftNotice(`Bozza salvata alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
          setTimeout(() => setDraftNotice(null), 3000);
        });
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [
    isDirty,
    titolo,
    categoria,
    autore,
    misura,
    bpmTesto,
    ritmo,
    capotasto,
    tonalita,
    origine,
    notaFonte,
    testoChordpro,
    initialCanto,
  ]);

  // Gestione Cronologia Testo
  const updateText = (newText: string) => {
    setTestoChordpro(newText);
    setIsDirty(true);

    // Tronca avanti se eravamo a metà cronologia
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(newText);
    if (nextHistory.length > 50) nextHistory.shift();

    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setTestoChordpro(history[prevIdx]!);
      setIsDirty(true);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setTestoChordpro(history[nextIdx]!);
      setIsDirty(true);
    }
  };

  // Inserisci testo/accordo alla posizione del cursore
  const insertAtCursor = (insertion: string) => {
    const el = textareaRef.current;
    if (!el) {
      updateText(testoChordpro + insertion);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const updated =
      testoChordpro.substring(0, start) +
      insertion +
      testoChordpro.substring(end);
    updateText(updated);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 10);
  };

  // Salta alla riga di un avviso
  const jumpToLine = (lineNumber: number) => {
    setMobileTab('testo');
    const el = textareaRef.current;
    if (!el) return;

    const lines = testoChordpro.split('\n');
    let charOffset = 0;
    for (let i = 0; i < Math.min(lineNumber, lines.length); i++) {
      charOffset += (lines[i]?.length || 0) + 1;
    }

    el.focus();
    el.setSelectionRange(charOffset, charOffset + (lines[lineNumber]?.length || 0));

    // Scroll verso la riga
    const lineHeight = editorFontSize * 1.5;
    el.scrollTop = Math.max(0, lineNumber * lineHeight - 120);
  };

  // Ripristina riga tolta (rumore)
  const restoreNoiseLine = (item: RemovedNoiseItem) => {
    const lines = testoChordpro.split('\n');
    const targetIdx = Math.min(item.indiceOriginale, lines.length);
    lines.splice(targetIdx, 0, item.rigaOriginale);
    const updated = lines.join('\n');
    updateText(updated);

    // Rimuovi dai removedNoise
    setRemovedNoise((prev) => prev.filter((n) => n.id !== item.id));
    setWarnings((prev) => prev.filter((w) => w.testo !== item.rigaOriginale));
  };

  // Rendering PDF originale con pdf.js
  useEffect(() => {
    if (!showOriginalPdf || !importedData?.pdfBytes || !pdfCanvasRef.current) return;

    let isCancelled = false;
    async function renderPdf() {
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const doc = await pdfjsLib.getDocument({ data: importedData!.pdfBytes! }).promise;
        if (isCancelled) return;
        setPdfPageCount(doc.numPages);

        const page = await doc.getPage(Math.min(currentPdfPage, doc.numPages));
        if (isCancelled) return;

        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 1.2 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport, canvas: canvas as any }).promise;
        }
      } catch (err) {
        console.warn('Errore rendering pagina PDF originale:', err);
      }
    }

    renderPdf();
    return () => {
      isCancelled = true;
    };
  }, [showOriginalPdf, currentPdfPage, importedData?.pdfBytes]);

  // Calcolo pagine anteprima Canzoniere A4 in tempo reale
  const previewPages = useMemo(() => {
    if (!testoChordpro.trim()) return [];
    try {
      const capoNum = capotasto ? parseInt(capotasto, 10) : null;
      const bpmNum = bpmTesto.match(/\d+/) ? parseInt(bpmTesto.match(/\d+/)![0]!, 10) : null;
      const res = layoutCanzoniereSong({
        id: initialCanto?.id || 'preview',
        titolo: titolo.trim() || 'TITOLO CANTO',
        autore: autore.trim() || null,
        categoria: (categoria || null) as CategoriaCanto | null,
        tonalita: tonalita.trim() || null,
        ritmo: ritmo.trim() || null,
        tempo_bpm: bpmNum,
        bpm_testo: bpmTesto.trim() || null,
        misura: misura.trim() || null,
        capotasto: isNaN(capoNum as number) ? null : capoNum,
        testo_chordpro: testoChordpro,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      });
      return res.pages;
    } catch (err) {
      console.warn('Errore layout anteprima A4:', err);
      return [];
    }
  }, [titolo, autore, categoria, tonalita, misura, bpmTesto, ritmo, capotasto, testoChordpro, initialCanto]);

  // Azione Salva
  const handleSave = async () => {
    if (!titolo.trim()) {
      setErrorMessage('Il titolo del canto è obbligatorio.');
      return;
    }
    if (!categoria) {
      setErrorMessage('La categoria del canto è obbligatoria.');
      return;
    }

    // Controllo duplicati
    const isDuplicate = existingTitles.some(
      (t) =>
        t.trim().toLowerCase() === titolo.trim().toLowerCase() &&
        t.trim().toLowerCase() !== (initialCanto?.titolo || '').trim().toLowerCase()
    );

    if (isDuplicate) {
      const confirmDup = window.confirm(
        `Esiste già un canto intitolato "${titolo}". Vuoi salvarlo comunque come nuovo canto duplicato?`
      );
      if (!confirmDup) return;
    }

    if (!categoria) {
      setErrorMessage('Seleziona una categoria obbligatoria (Canti scout, Canti di chiesa, Canti esterni).');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const capoNum = capotasto ? parseInt(capotasto, 10) : null;
      const bpmNum = bpmTesto.match(/\d+/) ? parseInt(bpmTesto.match(/\d+/)![0]!, 10) : null;

      const saved = await saveCanto({
        id: initialCanto?.id,
        titolo: titolo.trim(),
        autore: autore.trim() || null,
        categoria: categoria as CategoriaCanto,
        tonalita: tonalita.trim() || null,
        misura: misura.trim() || null,
        tempo_bpm: bpmNum,
        bpm_testo: bpmTesto.trim() || null,
        ritmo: ritmo.trim() || null,
        capotasto: isNaN(capoNum as number) ? null : capoNum,
        origine: (origine as 'import_pdf' | 'import_docx' | 'manuale') || 'manuale',
        nota_fonte: notaFonte.trim() || null,
        testo_chordpro: testoChordpro.trim(),
      });

      // Cancella bozza locale confermata
      await clearCantoDraft(initialCanto?.id || null);

      onSaved(saved);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Errore durante il salvataggio del canto'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Azione Annulla con conferma se modificato
  const handleCancel = () => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        'Ci sono modifiche non salvate in questa schermata. Sei sicuro di voler uscire? La bozza resterà memorizzata su questo dispositivo.'
      );
      if (!confirmLeave) return;
    }
    onClose();
  };

  return (
    <div
      className="canto-review-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      {/* 1. HEADER COMPATTO: Titolo, Categoria e Salva/Annulla */}
      <header
        className="canto-review-header"
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <span
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                whiteSpace: 'nowrap',
              }}
            >
              {initialCanto ? 'Modifica Canto' : 'Revisione Canto'}
            </span>
            {draftNotice && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                • {draftNotice}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button variant="ghost" onClick={handleCancel}>
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving || !titolo.trim() || !categoria}
            >
              {isSaving ? 'Salvataggio...' : 'Salva nel canzoniere'}
            </Button>
          </div>
        </div>

        {/* Campi Essenziali: Titolo (obbligatorio) + Categoria (obbligatoria) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 1fr) auto auto',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          <div>
            <input
              type="text"
              placeholder="Titolo del canto (obbligatorio)*"
              value={titolo}
              onInput={(e) => {
                setTitolo((e.target as HTMLInputElement).value);
                setIsDirty(true);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                fontWeight: 600,
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
              required
            />
          </div>

          <div>
            <select
              aria-label="Categoria del canto"
              value={categoria}
              onChange={(e) => {
                setCategoria((e.target as HTMLSelectElement).value as CategoriaCanto);
                setIsDirty(true);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                border: !categoria ? '1.5px solid var(--color-amber, #f59e0b)' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
              required
            >
              <option value="">-- Seleziona Categoria * --</option>
              <option value="scout">Canti scout</option>
              <option value="chiesa">Canti di chiesa</option>
              <option value="esterni">Canti esterni</option>
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExtraInfo(!showExtraInfo)}
            style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            {showExtraInfo ? 'Nascondi dettagli ▲' : 'Altre informazioni ▾'}
          </Button>
        </div>

        {/* Sezione Richiudibile "Altre informazioni" */}
        {showExtraInfo && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.5rem',
              paddingTop: '0.5rem',
              borderTop: '1px dashed var(--color-border)',
            }}
          >
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Autore / Evento</label>
              <input
                type="text"
                value={autore}
                placeholder="es. B.-P., Clan..."
                onInput={(e) => {
                  setAutore((e.target as HTMLInputElement).value);
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Tonalità</label>
              <input
                type="text"
                value={tonalita}
                placeholder="es. Do, Lam"
                onInput={(e) => {
                  setTonalita((e.target as HTMLInputElement).value);
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Misura (Tempo)</label>
              <input
                type="text"
                value={misura}
                placeholder="es. 4/4, 3/4"
                onInput={(e) => {
                  setMisura((e.target as HTMLInputElement).value);
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>BPM (Testo)</label>
              <input
                type="text"
                value={bpmTesto}
                placeholder="es. 92, circa 90"
                onInput={(e) => {
                  setBpmTesto((e.target as HTMLInputElement).value);
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Ritmo / Pennata</label>
              <input
                type="text"
                value={ritmo}
                placeholder="es. ↓ ↑ ↓↑"
                onInput={(e) => {
                  setRitmo((e.target as HTMLInputElement).value);
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Capotasto</label>
              <input
                type="number"
                min="0"
                max="12"
                value={capotasto}
                placeholder="es. 2"
                onInput={(e) => {
                  setCapotasto((e.target as HTMLInputElement).value);
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Origine</label>
              <input
                type="text"
                value={origine}
                placeholder="import_pdf, import_docx..."
                onInput={(e) => {
                  setOrigine((e.target as HTMLInputElement).value);
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Nota Fonte</label>
              <input
                type="text"
                value={notaFonte}
                placeholder="Note sulla provenienza"
                onInput={(e) => {
                  setNotaFonte((e.target as HTMLInputElement).value);
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: '0.4rem 0.75rem',
              background: 'var(--color-error-bg, #fee2e2)',
              color: 'var(--color-error, #dc2626)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
            }}
          >
            {errorMessage}
          </div>
        )}
      </header>

      {/* BANNER BOZZA AUTOMATICA RIPRENDI / ELIMINA */}
      {showDraftPrompt && activeDraft && (
        <div
          style={{
            background: 'var(--color-amber-bg, #fef3c7)',
            color: 'var(--color-amber-text, #92400e)',
            borderBottom: '1px solid var(--color-border)',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <strong>Bozza locale trovata:</strong> Salvata{' '}
            {formatDraftTime(activeDraft.updatedAt)} per "{activeDraft.titolo || 'Canto senza titolo'}".
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setTitolo(activeDraft.titolo);
                if (activeDraft.categoria) setCategoria(activeDraft.categoria);
                setAutore(activeDraft.autore);
                setTonalita(activeDraft.tonalita);
                setMisura(activeDraft.misura);
                setBpmTesto(activeDraft.bpm_testo);
                setRitmo(activeDraft.ritmo);
                setCapotasto(activeDraft.capotasto);
                setTestoChordpro(activeDraft.testo_chordpro);
                setShowDraftPrompt(false);
                setIsDirty(true);
              }}
            >
              Riprendi bozza
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                if (activeDraft.id) await deleteCantoDraft(activeDraft.id);
                setShowDraftPrompt(false);
              }}
            >
              Elimina bozza
            </Button>
          </div>
        </div>
      )}

      {/* SCHEDE MOBILE (visibili solo sotto 768px) */}
      <div
        className="canto-review-mobile-tabs"
        style={{
          display: 'none',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <button
          type="button"
          onClick={() => setMobileTab('testo')}
          style={{
            flex: 1,
            padding: '0.6rem',
            fontWeight: 600,
            border: 'none',
            background: mobileTab === 'testo' ? 'var(--color-bg)' : 'transparent',
            borderBottom: mobileTab === 'testo' ? '2px solid var(--color-ink)' : 'none',
            color: mobileTab === 'testo' ? 'var(--color-ink)' : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          Testo ChordPro ({testoChordpro.split('\n').length} righe)
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('anteprima')}
          style={{
            flex: 1,
            padding: '0.6rem',
            fontWeight: 600,
            border: 'none',
            background: mobileTab === 'anteprima' ? 'var(--color-bg)' : 'transparent',
            borderBottom: mobileTab === 'anteprima' ? '2px solid var(--color-ink)' : 'none',
            color: mobileTab === 'anteprima' ? 'var(--color-ink)' : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          Anteprima A4 ({previewPages.length} pag.)
        </button>
      </div>

      {/* 2. AREA CENTRALE SPLIT O TABS */}
      <div
        className="canto-review-content-area"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: showOriginalPdf ? '1fr 1fr 1fr' : '1.1fr 0.9fr',
          gap: '1px',
          background: 'var(--color-border)',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* PANNELLO 1: EDITOR TESTO */}
        <div
          className={`canto-review-panel-editor ${mobileTab === 'testo' ? 'active-mobile' : 'hidden-mobile'}`}
          style={{
            background: 'var(--color-bg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* BARRA FISSA TOOLBAR: Inserisci accordo, Direttive, Font Size, Undo/Redo */}
          <div
            className="canto-review-toolbar"
            style={{
              padding: '0.4rem 0.75rem',
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.4rem',
              flexShrink: 0,
            }}
          >
            {/* Accordi Rapidi */}
            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
              {['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'].map((c) => (
                <button
                  key={c}
                  type="button"
                  className="canto-review-toolbar-btn"
                  onClick={() => insertAtCursor(`[${c}]`)}
                  style={{
                    padding: '0.25rem 0.45rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>

            <span style={{ color: 'var(--color-border)' }}>|</span>

            {/* Modificatori */}
            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
              {['m', '7', 'maj7', 'sus4', '#', 'b'].map((mod) => (
                <button
                  key={mod}
                  type="button"
                  className="canto-review-toolbar-btn"
                  onClick={() => insertAtCursor(mod)}
                  style={{
                    padding: '0.25rem 0.35rem',
                    fontSize: '0.75rem',
                  }}
                >
                  {mod}
                </button>
              ))}
            </div>

            <span style={{ color: 'var(--color-border)' }}>|</span>

            {/* Direttive ChordPro */}
            <button
              type="button"
              className="canto-review-toolbar-btn"
              onClick={() => insertAtCursor('\n{soc}\nRIT.\n')}
              style={{
                padding: '0.25rem 0.45rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              + Ritornello
            </button>
            <button
              type="button"
              className="canto-review-toolbar-btn"
              onClick={() => insertAtCursor('\n{eoc}\n')}
              style={{
                padding: '0.25rem 0.45rem',
                fontSize: '0.75rem',
              }}
            >
              Fine Rit.
            </button>

            <span style={{ color: 'var(--color-border)' }}>|</span>

            {/* Regolazione Font Size */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                className="canto-review-toolbar-btn"
                onClick={() => setEditorFontSize((s) => Math.max(12, s - 1))}
                style={{ padding: '0.2rem 0.4rem' }}
                title="Riduci dimensione carattere"
              >
                A-
              </button>
              <span style={{ fontSize: '0.75rem', minWidth: '2.5rem', textAlign: 'center', color: 'var(--color-text)' }}>
                {editorFontSize}px
              </span>
              <button
                type="button"
                className="canto-review-toolbar-btn"
                onClick={() => setEditorFontSize((s) => Math.min(18, s + 1))}
                style={{ padding: '0.2rem 0.4rem' }}
                title="Aumenta dimensione carattere"
              >
                A+
              </button>
            </div>

            <span style={{ color: 'var(--color-border)' }}>|</span>

            {/* Undo / Redo */}
            <button
              type="button"
              className="canto-review-toolbar-btn"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              style={{ padding: '0.25rem 0.4rem' }}
              title="Annulla (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              type="button"
              className="canto-review-toolbar-btn"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              style={{ padding: '0.25rem 0.4rem' }}
              title="Ripeti (Ctrl+Y)"
            >
              ↷
            </button>

            {/* Interruttore mostra pagina PDF originale se disponibile */}
            {importedData?.pdfBytes && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label
                  style={{
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showOriginalPdf}
                    onChange={(e) => setShowOriginalPdf((e.target as HTMLInputElement).checked)}
                  />
                  Mostra PDF originale
                </label>
              </div>
            )}
          </div>

          {/* TEXTAREA AMPIA: Spaziatura fissa, a capo automatico (0 scroll orizzontale) */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0 }}>
            <textarea
              ref={textareaRef}
              value={testoChordpro}
              onInput={(e) => updateText((e.target as HTMLTextAreaElement).value)}
              placeholder="Inserisci o modifica qui il testo del canto con gli accordi tra parentesi quadre [Do]..."
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                padding: '1rem',
                fontSize: `${editorFontSize}px`,
                lineHeight: '1.5',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowX: 'hidden',
                overflowY: 'auto',
                resize: 'none',
                border: 'none',
                outline: 'none',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* RIQUADRO AVVISI E RUMORE (RICHIUDIBILE) */}
          {(warnings.length > 0 || removedNoise.length > 0) && (
            <div
              className="canto-review-warnings-drawer"
              style={{
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                maxHeight: showWarningsDrawer ? '180px' : '36px',
                transition: 'max-height 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
              }}
            >
              <div
                onClick={() => setShowWarningsDrawer(!showWarningsDrawer)}
                style={{
                  padding: '0.35rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: 'var(--color-surface)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderBottom: showWarningsDrawer ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Avvisi di importazione ({warnings.length + removedNoise.length})</span>
                  {warnings.length > 0 && (
                    <Badge variant="giallo">{warnings.length} avvisi</Badge>
                  )}
                  {removedNoise.length > 0 && (
                    <Badge variant="neutral">{removedNoise.length} rumore</Badge>
                  )}
                </div>
                <span>{showWarningsDrawer ? '▼ Riduci' : '▲ Mostra'}</span>
              </div>

              {showWarningsDrawer && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {/* Elenco Avvisi */}
                  {warnings.map((w, idx) => (
                    <div
                      key={`warn-${idx}`}
                      onClick={() => jumpToLine(w.riga)}
                      style={{
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.78rem',
                        background: 'var(--color-bg)',
                        borderLeft: '3px solid var(--color-amber, #f59e0b)',
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      title="Clicca per saltare a questa riga nell'editor"
                    >
                      <div>
                        <strong>Riga {w.riga + 1}:</strong> {w.messaggio}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Salta ↗</span>
                    </div>
                  ))}

                  {/* Elenco Righe di Rumore Eliminate con Bottone Ripristina */}
                  {removedNoise.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.78rem',
                        background: 'var(--color-bg)',
                        borderLeft: '3px solid var(--color-text-muted)',
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>[Pag. {item.numeroPagina}]</span>{' '}
                        "{item.rigaOriginale}" <em>({item.motivo})</em>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => restoreNoiseLine(item)}
                        style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
                      >
                        Ripristina
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PANNELLO 2 (OPZIONALE): PDF ORIGINALE (se attivo su desktop) */}
        {showOriginalPdf && importedData?.pdfBytes && (
          <div
            className="canto-review-panel-pdf"
            style={{
              background: 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '0.4rem 0.75rem',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
              }}
            >
              <span>PDF Originale (Pagina {currentPdfPage} di {pdfPageCount})</span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  disabled={currentPdfPage <= 1}
                  onClick={() => setCurrentPdfPage((p) => Math.max(1, p - 1))}
                  style={{ padding: '0.2rem 0.4rem' }}
                >
                  ◀
                </button>
                <button
                  type="button"
                  disabled={currentPdfPage >= pdfPageCount}
                  onClick={() => setCurrentPdfPage((p) => Math.min(pdfPageCount, p + 1))}
                  style={{ padding: '0.2rem 0.4rem' }}
                >
                  ▶
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem', display: 'flex', justifyContent: 'center' }}>
              <canvas ref={pdfCanvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
            </div>
          </div>
        )}

        {/* PANNELLO 3: ANTEPRIMA A4 IN TEMPO REALE */}
        <div
          className={`canto-review-panel-preview ${mobileTab === 'anteprima' ? 'active-mobile' : 'hidden-mobile'}`}
          style={{
            background: 'var(--color-surface-raised, #e5e7eb)',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            minHeight: 0,
          }}
        >
          {previewPages.length > 0 ? (
            previewPages.map((page, idx) => (
              <div
                key={`page-${idx}`}
                className="canto-review-preview-sheet"
                style={{
                  background: 'white',
                  color: 'black',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  width: '100%',
                  maxWidth: '750px',
                }}
              >
                <CanzonierePageRenderer page={page} isScreenPreview={true} />
              </div>
            ))
          ) : (
            <div
              style={{
                marginTop: '3rem',
                color: 'var(--color-text-muted)',
                textAlign: 'center',
                fontSize: '0.9rem',
              }}
            >
              Inserisci o incolla il testo ChordPro per visualizzare l'anteprima impaginata A4.
            </div>
          )}
        </div>
      </div>

      <style>{`
        .canto-review-toolbar button,
        .canto-review-toolbar-btn {
          color: var(--color-text);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
        }
        .canto-review-toolbar button:hover:not(:disabled),
        .canto-review-toolbar-btn:hover:not(:disabled) {
          background: var(--color-surface-hover, oklch(0.5 0 0 / 0.15));
        }
        .canto-review-toolbar button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .canto-review-preview-sheet .canzoniere-page,
        .canto-review-preview-sheet .canzoniere-line-item {
          color: oklch(0 0 0) !important;
        }
        .canto-review-preview-sheet .canzoniere-header-title {
          color: oklch(0 0 0) !important;
        }
        .canto-review-preview-sheet .canzoniere-header-author,
        .canto-review-preview-sheet .canzoniere-header-params {
          color: oklch(0.35 0 0) !important;
        }
        .canto-review-preview-sheet .song-chord,
        .canto-review-preview-sheet .canzoniere-chord-badge {
          color: oklch(0 0 0) !important;
          font-weight: 700 !important;
        }
        @media (max-width: 767px) {
          .canto-review-mobile-tabs {
            display: flex !important;
          }
          .canto-review-content-area {
            grid-template-columns: 1fr !important;
          }
          .canto-review-panel-editor.hidden-mobile,
          .canto-review-panel-preview.hidden-mobile {
            display: none !important;
          }
          .canto-review-panel-editor.active-mobile,
          .canto-review-panel-preview.active-mobile {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
