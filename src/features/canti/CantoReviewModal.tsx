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
import { Icon } from '../../ui/Icon';
import { Canto, CategoriaCanto } from '../../lib/db';
import { saveCanto } from '../../lib/admin_actions';
import { layoutCanzoniereSong } from './canzoniere_layout';
import { CanzonierePageRenderer } from './CanzonierePageRenderer';
import { ChordProRenderer } from '../../lib/chordpro';
import {
  saveCantoDraft,
  loadLatestCantoDraft,
  clearCantoDraft,
  deleteCantoDraft,
  formatDraftTime,
  CantoDraft,
} from './canto_draft';
import { PdfImportWarning, RemovedNoiseItem, isChordToken } from './pdf_importer';

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
    imageUrl?: string | null;
    imageFileName?: string | null;
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
  const [testoChordpro, setTestoChordpro] = useState(
    importedData?.testo_chordpro || initialCanto?.testo_chordpro || ''
  );

  // Sezione richiudibile "Altre informazioni"
  const [showExtraInfo, setShowExtraInfo] = useState(false);

  // Tab per dispositivi mobili: 'testo' | 'anteprima'
  const [mobileTab, setMobileTab] = useState<'testo' | 'anteprima'>('testo');

  // Modalità Anteprima: 'reading' (stile sito) | 'print' (impaginazione A4)
  const [previewMode, setPreviewMode] = useState<'reading' | 'print'>('reading');
  const [showPreviewChords, setShowPreviewChords] = useState<boolean>(true);
  const [previewFontSize, setPreviewFontSize] = useState<number>(16);

  // Dimensione carattere editor (12-18 px)
  const [editorFontSize, setEditorFontSize] = useState<number>(14);

  // Visualizzazione pagina PDF originale (solo desktop)
  const [showOriginalPdf, setShowOriginalPdf] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);

  // Visualizzazione immagine originale (solo desktop, se importata da immagine)
  const [showOriginalImage, setShowOriginalImage] = useState(
    Boolean(importedData?.imageUrl)
  );

  // Avvisi e righe tolte
  const [warnings, setWarnings] = useState<PdfImportWarning[]>(
    importedData?.warnings || []
  );
  const [removedNoise, setRemovedNoise] = useState<RemovedNoiseItem[]>(
    importedData?.removedNoise || []
  );
  const [showWarningsDrawer, setShowWarningsDrawer] = useState(true);
  const [showNoiseDetails, setShowNoiseDetails] = useState(false);

  // Filtra avvisi per l'utente: esclude rumori rimossi e falsi positivi accordi su progressioni
  const userFacingWarnings = useMemo(() => {
    return warnings.filter((w) => {
      // Le eliminazioni di rumore non vanno mostrate come avvisi all'utente
      if (w.tipo === 'riga_rumore_tolta') return false;
      // Accordi ambigui: se sono accordi validi maiuscoli o progressione (es. "FA DO SOL", "DO SOL"), non segnalare
      if (w.tipo === 'accordo_ambiguo') {
        const clean = w.testo.replace(/[.,]/g, '').trim();
        const parts = clean.split(/\s+/).filter(Boolean);
        const allUpper = parts.every((p) => p === p.toUpperCase());
        const hasChords = parts.length >= 2 && parts.every((p) => isChordToken(p));
        if (allUpper || hasChords) return false;
      }
      return true;
    });
  }, [warnings]);

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

  // Inserisci o unisci modificatore (es. #, b, 7, sus4) all'accordo selezionato o precedente
  const insertChordModifier = (mod: string) => {
    const el = textareaRef.current;
    if (!el) {
      insertAtCursor(mod);
      return;
    }
    const start = el.selectionStart;
    const before = testoChordpro.substring(0, start);
    // Se il cursore è subito dopo la parentesi quadra chiusa di un accordo es. "...[DO]|"
    if (before.endsWith(']')) {
      const openIdx = before.lastIndexOf('[');
      if (openIdx !== -1 && openIdx > before.lastIndexOf(']', before.length - 2)) {
        const updated = before.slice(0, -1) + mod + ']' + testoChordpro.substring(start);
        updateText(updated);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + mod.length, start + mod.length);
        }, 10);
        return;
      }
    }
    insertAtCursor(mod);
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
        tonalita: null,
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
  }, [titolo, autore, categoria, misura, bpmTesto, ritmo, capotasto, testoChordpro, initialCanto]);

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
        tonalita: null,
        misura: misura.trim() || null,
        tempo_bpm: bpmNum,
        bpm_testo: bpmTesto.trim() || null,
        ritmo: ritmo.trim() || null,
        capotasto: isNaN(capoNum as number) ? null : capoNum,
        origine: (initialCanto?.origine as 'import_pdf' | 'import_docx' | 'manuale') || 'manuale',
        nota_fonte: null,
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Icon name="x" size={16} />
              <span>Annulla</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !titolo.trim() || !categoria}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Icon name="check" size={16} />
              <span className="canto-btn-label-desktop">{isSaving ? 'Salvataggio...' : 'Salva nel canzoniere'}</span>
              <span className="canto-btn-label-mobile">{isSaving ? 'Salvo...' : 'Salva'}</span>
            </Button>
          </div>
        </div>

        {/* Riga Titolo Canto */}
        <div style={{ width: '100%' }}>
          <input
            type="text"
            className="ios-form-input"
            placeholder="Titolo del canto (obbligatorio)*"
            value={titolo}
            onInput={(e) => {
              setTitolo((e.target as HTMLInputElement).value);
              setIsDirty(true);
            }}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              fontSize: '1rem',
              fontWeight: 600,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              boxSizing: 'border-box',
            }}
            required
          />
        </div>

        {/* Riga Categoria in Evidenza (3 Pillole Grandi) + Toggle Dettagli */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '1 1 auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.25rem' }}>
              Categoria*:
            </span>
            {/* Scout */}
            <button
              type="button"
              onClick={() => { setCategoria('scout'); setIsDirty(true); }}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
                background: categoria === 'scout' ? 'var(--color-interactive-tenue)' : 'var(--color-surface)',
                color: categoria === 'scout' ? 'var(--color-interactive)' : 'var(--color-text-secondary)',
                border: categoria === 'scout' ? '2px solid var(--color-interactive)' : '1px solid var(--color-border)',
                boxShadow: categoria === 'scout' ? 'var(--shadow-subtle)' : 'none',
              }}
            >
              <span>Scout</span>
            </button>
            {/* Chiesa */}
            <button
              type="button"
              onClick={() => { setCategoria('chiesa'); setIsDirty(true); }}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
                background: categoria === 'chiesa' ? 'var(--color-giochi-tenue)' : 'var(--color-surface)',
                color: categoria === 'chiesa' ? 'var(--color-giochi-badge-text)' : 'var(--color-text-secondary)',
                border: categoria === 'chiesa' ? '2px solid var(--color-giochi)' : '1px solid var(--color-border)',
                boxShadow: categoria === 'chiesa' ? 'var(--shadow-subtle)' : 'none',
              }}
            >
              <span>Chiesa</span>
            </button>
            {/* Esterni */}
            <button
              type="button"
              onClick={() => { setCategoria('esterni'); setIsDirty(true); }}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
                background: categoria === 'esterni' ? 'var(--color-bans-tenue)' : 'var(--color-surface)',
                color: categoria === 'esterni' ? 'var(--color-bans)' : 'var(--color-text-secondary)',
                border: categoria === 'esterni' ? '2px solid var(--color-bans)' : '1px solid var(--color-border)',
                boxShadow: categoria === 'esterni' ? 'var(--shadow-subtle)' : 'none',
              }}
            >
              <span>Canti esterni</span>
            </button>

            {!categoria && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-bans)', fontWeight: 600, marginLeft: '0.25rem' }}>
                (Scegli categoria per salvare)
              </span>
            )}
          </div>

          {/* Toggle Dettagli Opzionali */}
          <button
            type="button"
            onClick={() => setShowExtraInfo(!showExtraInfo)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: showExtraInfo ? 'var(--color-surface-hover)' : 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{showExtraInfo ? 'Chiudi dettagli ▲' : 'Dettagli musicali ▾'}</span>
          </button>
        </div>

        {/* Sezione Richiudibile "Dettagli musicali" (Stile Apple, solo campi utili) */}
        {showExtraInfo && (
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            {/* Griglia parametri brano */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.6rem',
              }}
            >
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                  Autore / Artista
                </label>
                <input
                  type="text"
                  value={autore}
                  placeholder="es. B.-P., Clan, Nomadi..."
                  onInput={(e) => {
                    setAutore((e.target as HTMLInputElement).value);
                    setIsDirty(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.85rem',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                  Misura (Tempo)
                </label>
                <input
                  type="text"
                  value={misura}
                  placeholder="es. 4/4, 3/4, 6/8"
                  onInput={(e) => {
                    setMisura((e.target as HTMLInputElement).value);
                    setIsDirty(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.85rem',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                  BPM (Velocità)
                </label>
                <input
                  type="text"
                  value={bpmTesto}
                  placeholder="es. 92, circa 90"
                  onInput={(e) => {
                    setBpmTesto((e.target as HTMLInputElement).value);
                    setIsDirty(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.85rem',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                  Capotasto
                </label>
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
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.85rem',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Pennata / Ritmo con bottoni simboli rapidi */}
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                Ritmo / Pennata Chitarra
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={ritmo}
                  placeholder="es. ↓ ↑ ↓↑ oppure usa i pulsanti sotto"
                  onInput={(e) => {
                    setRitmo((e.target as HTMLInputElement).value);
                    setIsDirty(true);
                  }}
                  style={{
                    flex: '1 1 200px',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.85rem',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="pennata-sym-btn"
                    onClick={() => { setRitmo((r) => `${r}↓ `); setIsDirty(true); }}
                    title="Aggiungi pennata in giù (↓)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="pennata-sym-btn"
                    onClick={() => { setRitmo((r) => `${r}↑ `); setIsDirty(true); }}
                    title="Aggiungi pennata in su (↑)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="pennata-sym-btn"
                    onClick={() => { setRitmo((r) => `${r}(↓) `); setIsDirty(true); }}
                    title="Pennata debole / accento ((↓))"
                  >
                    (↓)
                  </button>
                  <button
                    type="button"
                    className="pennata-sym-btn"
                    onClick={() => { setRitmo((r) => `${r}x `); setIsDirty(true); }}
                    title="Stoppato percussivo (x)"
                  >
                    x
                  </button>
                  <button
                    type="button"
                    className="pennata-preset-btn"
                    onClick={() => { setRitmo('↓  ↓↑  ↑↓↑'); setIsDirty(true); }}
                    title="Pattern universale pop/folk"
                  >
                    Preset: ↓ ↓↑ ↑↓↑
                  </button>
                  <button
                    type="button"
                    className="pennata-preset-btn"
                    onClick={() => { setRitmo('↓  ↓↑  ↑↓'); setIsDirty(true); }}
                    title="Pattern ballad lento"
                  >
                    Ballad: ↓ ↓↑ ↑↓
                  </button>
                  {ritmo && (
                    <button
                      type="button"
                      className="pennata-sym-btn"
                      onClick={() => { setRitmo(''); setIsDirty(true); }}
                      title="Cancella pennata"
                      style={{ color: 'var(--color-bans)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Suggerimento IA */}
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--color-text-secondary)',
                background: 'var(--color-bg)',
                padding: '0.4rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Icon name="info" size={13} />
              <span>
                <strong>Suggerimento rapido:</strong> puoi chiedere all'IA (Gemini o ChatGPT) <em>«Qual è l'autore, il tempo (es. 4/4) e i BPM del canto {titolo || '<titolo>'}?»</em> per compilare questi campi al volo.
              </span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: '0.4rem 0.75rem',
              background: 'var(--color-bans-tenue)',
              color: 'var(--color-bans)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 600,
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

      {/* BANNER PROMEMORIA: I RISULTATI VANNO RICONTROLLATI E MODIFICATI */}
      {importedData && (
        <div
          style={{
            background: 'var(--color-surface-hover)',
            borderBottom: '1px solid var(--color-border)',
            padding: '0.45rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.8rem',
            lineHeight: 1.35,
            color: 'var(--color-text-secondary)',
          }}
        >
          <Icon name="info" size={15} style={{ color: 'var(--color-interactive)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--color-text)' }}>Ricontrolla e rifinisci il canto:</strong>{' '}
            La traduzione automatica non è perfetta al 100%. Verifica l'allineamento degli accordi, il testo e il ritornello nell'editor prima di salvare nel canzoniere.
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
          Anteprima Canto
        </button>
      </div>

      {/* 2. AREA CENTRALE SPLIT O TABS */}
      <div
        className="canto-review-content-area"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns:
            (showOriginalPdf && importedData?.pdfBytes) ||
            (showOriginalImage && importedData?.imageUrl)
              ? '1fr 1fr 1fr'
              : '1.1fr 0.9fr',
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
              padding: '0.45rem 0.75rem',
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              flexShrink: 0,
            }}
          >
            {/* Riga 1: Accordi Diretti Più Usati (Maggiori, Minori, Settima) */}
            <div className="chord-toolbar-row" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {/* Maggiori */}
              <div className="chord-group" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span className="chord-group-label" style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginRight: '2px' }}>
                  Maggiori:
                </span>
                {['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="canto-review-toolbar-btn chord-btn-major"
                    onClick={() => insertAtCursor(`[${c}]`)}
                    style={{
                      padding: '0.25rem 0.45rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                    title={`Inserisci accordo [${c}]`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <span style={{ color: 'var(--color-border)' }}>|</span>

              {/* Minori */}
              <div className="chord-group" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span className="chord-group-label" style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-canti)', marginRight: '2px' }}>
                  Minori:
                </span>
                {['DOm', 'REm', 'MIm', 'FAm', 'SOLm', 'LAm', 'SIm'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="canto-review-toolbar-btn chord-btn-minor"
                    onClick={() => insertAtCursor(`[${c}]`)}
                    style={{
                      padding: '0.25rem 0.45rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                    title={`Inserisci accordo [${c}]`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Riga 2: Modificatori, Sezioni Ritornello, Font & Storia */}
            <div className="chord-toolbar-row" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {/* Modificatori */}
              <div className="chord-group" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span className="chord-group-label" style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginRight: '2px' }}>
                  Mod.:
                </span>
                {['#', 'b', '4', 'sus4', '7'].map((mod) => (
                  <button
                    key={mod}
                    type="button"
                    className="canto-review-toolbar-btn"
                    onClick={() => insertChordModifier(mod)}
                    style={{
                      padding: '0.25rem 0.35rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                    title={`Aggiungi modificatore ${mod}`}
                  >
                    {mod}
                  </button>
                ))}
              </div>

              <span style={{ color: 'var(--color-border)' }}>|</span>

              {/* Sezioni Ritornello */}
              <div className="chord-group" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <button
                  type="button"
                  className="canto-review-toolbar-btn chord-btn-rit"
                  onClick={() => insertAtCursor('\n{soc}\nRIT.\n')}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                  title="Inizia ritornello (barra laterale colorata)"
                >
                  + RIT.
                </button>
                <button
                  type="button"
                  className="canto-review-toolbar-btn"
                  onClick={() => insertAtCursor('\n{eoc}\n')}
                  style={{
                    padding: '0.25rem 0.45rem',
                    fontSize: '0.75rem',
                  }}
                  title="Fine blocco ritornello"
                >
                  Fine Rit.
                </button>
              </div>

              <span style={{ color: 'var(--color-border)' }}>|</span>

              {/* Regolazione Font Size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  type="button"
                  className="canto-review-toolbar-btn"
                  onClick={() => setEditorFontSize((s) => Math.max(12, s - 1))}
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
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
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
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
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                title="Annulla ultima modifica (Ctrl+Z)"
              >
                <span>↶</span>
                <span style={{ fontSize: '0.7rem' }}>Annulla</span>
              </button>
              <button
                type="button"
                className="canto-review-toolbar-btn"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                title="Ripeti modifica (Ctrl+Y)"
              >
                <span>↷</span>
                <span style={{ fontSize: '0.7rem' }}>Ripeti</span>
              </button>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {/* Pulsante discreto per visualizzare righe filtrate */}
                {removedNoise.length > 0 && (
                  <button
                    type="button"
                    className="canto-review-toolbar-btn"
                    onClick={() => setShowNoiseDetails(!showNoiseDetails)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.45rem',
                      color: showNoiseDetails ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Mostra/nascondi le righe escluse automaticamente (watermark, piè di pagina, ecc.)"
                  >
                    <Icon name="trash" size={12} />
                    <span>Escluse ({removedNoise.length})</span>
                  </button>
                )}

                {/* Interruttore mostra pagina PDF originale se disponibile */}
                {importedData?.pdfBytes && (
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
                    PDF orig.
                  </label>
                )}
                {importedData?.imageUrl && (
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
                      checked={showOriginalImage}
                      onChange={(e) => setShowOriginalImage((e.target as HTMLInputElement).checked)}
                    />
                    Immagine orig.
                  </label>
                )}
              </div>
            </div>
          </div>

          {importedData?.imageUrl && (
            <div
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.75rem',
                background: 'var(--color-interactive-tenue)',
                color: 'var(--color-interactive)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Icon name="info" size={14} />
              <span>Testo estratto da immagine senza accordi. Consulta la foto a lato e aggiungi gli accordi usando i pulsanti in alto o digitando [DO], [LAm], ecc.</span>
            </div>
          )}

          {/* TEXTAREA AMPIA: Spaziatura fissa, a capo automatico (0 scroll orizzontale) */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0 }}>
            <textarea
              ref={textareaRef}
              value={testoChordpro}
              onInput={(e) => updateText((e.target as HTMLTextAreaElement).value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                  if (e.key === 'z' || e.key === 'Z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                      handleRedo();
                    } else {
                      handleUndo();
                    }
                  } else if (e.key === 'y' || e.key === 'Y') {
                    e.preventDefault();
                    handleRedo();
                  }
                }
              }}
              placeholder="Inserisci o modifica qui il testo del canto con gli accordi tra parentesi quadre [DO]..."
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

          {/* RIQUADRO AVVISI (SOLO FORMATTAZIONE REALE) */}
          {userFacingWarnings.length > 0 && (
            <div
              className="canto-review-warnings-drawer"
              style={{
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                maxHeight: showWarningsDrawer ? '160px' : '36px',
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
                  <Icon name="warning" size={14} />
                  <span>Avvisi di formattazione</span>
                  <Badge variant="giallo">{userFacingWarnings.length} {userFacingWarnings.length === 1 ? 'avviso' : 'avvisi'}</Badge>
                </div>
                <span>{showWarningsDrawer ? '▼ Riduci' : '▲ Mostra'}</span>
              </div>

              {showWarningsDrawer && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {userFacingWarnings.map((w, idx) => (
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
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-interactive)', fontWeight: 600 }}>Salta ↗</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CASSETTO RIGHE ESCLUSE (OPZIONALE, NON INTRUSIVO) */}
          {showNoiseDetails && removedNoise.length > 0 && (
            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                maxHeight: '140px',
                overflowY: 'auto',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Righe escluse dal testo ({removedNoise.length}):</strong>
                <button
                  type="button"
                  onClick={() => setShowNoiseDetails(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <Icon name="x" size={12} />
                  <span>Chiudi</span>
                </button>
              </div>
              {removedNoise.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '0.25rem 0.4rem',
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    [Pag. {item.numeroPagina}] "{item.rigaOriginale}"
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => restoreNoiseLine(item)}
                    style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', flexShrink: 0 }}
                  >
                    Ripristina
                  </Button>
                </div>
              ))}
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

        {/* PANNELLO 2B (OPZIONALE): IMMAGINE ORIGINALE (se attivo su desktop) */}
        {showOriginalImage && importedData?.imageUrl && (
          <div
            className="canto-review-panel-image"
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
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>Immagine Originale ({importedData.imageFileName || 'Scansione'})</span>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                background: 'var(--color-surface-hover)',
              }}
            >
              <img
                src={importedData.imageUrl}
                alt="Spartito originale"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              />
            </div>
          </div>
        )}

        {/* PANNELLO 3: ANTEPRIMA IN TEMPO REALE (VISTA CANZONE SITO O STAMPA A4) */}
        <div
          className={`canto-review-panel-preview ${mobileTab === 'anteprima' ? 'active-mobile' : 'hidden-mobile'}`}
          style={{
            background: 'var(--color-bg)',
            overflowY: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {/* BARRA CONTROLLI ANTEPRIMA */}
          <div
            className="canto-preview-toolbar"
            style={{
              padding: '0.4rem 0.75rem',
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            {/* Modalità Anteprima: Vista Canzone (default) vs Stampa A4 */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--color-surface-hover, oklch(0.5 0 0 / 0.08))',
                borderRadius: 'var(--radius-md)',
                padding: '2px',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setPreviewMode('reading')}
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: previewMode === 'reading' ? 'var(--color-bg)' : 'transparent',
                  color: previewMode === 'reading' ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                  boxShadow: previewMode === 'reading' ? 'var(--shadow-subtle)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Icon name="eye" size={14} />
                <span>Vista Canzone</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('print')}
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: previewMode === 'print' ? 'var(--color-bg)' : 'transparent',
                  color: previewMode === 'print' ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                  boxShadow: previewMode === 'print' ? 'var(--shadow-subtle)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Icon name="stampa" size={14} />
                <span>Stampa A4 ({previewPages.length})</span>
              </button>
            </div>

            {/* Controlli Vista Canzone */}
            {previewMode === 'reading' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {/* Toggle Accordi */}
                <button
                  type="button"
                  className="canto-review-toolbar-btn"
                  onClick={() => setShowPreviewChords(!showPreviewChords)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: showPreviewChords ? 'var(--color-canti)' : 'var(--color-text-secondary)',
                  }}
                  title={showPreviewChords ? 'Nascondi accordi' : 'Mostra accordi'}
                >
                  <Icon name="canti" size={14} />
                  <span>{showPreviewChords ? 'Accordi ON' : 'Accordi OFF'}</span>
                </button>

                {/* Font Size Anteprima */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <button
                    type="button"
                    className="canto-review-toolbar-btn"
                    onClick={() => setPreviewFontSize((s) => Math.max(12, s - 1))}
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                    title="Riduci carattere anteprima"
                  >
                    A-
                  </button>
                  <span style={{ fontSize: '0.72rem', minWidth: '2.2rem', textAlign: 'center', color: 'var(--color-text)' }}>
                    {previewFontSize}px
                  </span>
                  <button
                    type="button"
                    className="canto-review-toolbar-btn"
                    onClick={() => setPreviewFontSize((s) => Math.min(24, s + 1))}
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                    title="Aumenta carattere anteprima"
                  >
                    A+
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AREA SCORREVOLE ANTEPRIMA */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: previewMode === 'reading' ? '1.5rem 1rem' : '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
              minHeight: 0,
              background: previewMode === 'reading' ? 'var(--color-bg)' : 'var(--color-surface-raised, #e5e7eb)',
            }}
          >
            {previewMode === 'reading' ? (
              /* CARD ELEGANTE STILE APERTURA CANZONE NEL SITO */
              <div
                className="canto-review-reading-card"
                style={{
                  width: '100%',
                  maxWidth: '750px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                  boxSizing: 'border-box',
                }}
              >
                {/* Testata Canto */}
                <h1
                  className="song-title-display"
                  style={{
                    margin: '0 0 0.35rem',
                    fontSize: '1.65rem',
                    fontWeight: 700,
                    color: 'var(--color-ink)',
                    lineHeight: 1.25,
                  }}
                >
                  {titolo.trim() || 'Titolo del Canto'}
                </h1>

                {autore.trim() && (
                  <div
                    style={{
                      fontSize: '0.92rem',
                      color: 'var(--color-text-secondary)',
                      fontWeight: 500,
                      marginBottom: '0.75rem',
                    }}
                  >
                    {autore.trim()}
                  </div>
                )}

                {/* Chips Metadati */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                  {categoria === 'scout' && <Badge variant="azzurro" size="sm">Canti scout</Badge>}
                  {categoria === 'chiesa' && <Badge variant="giallo" size="sm">Canti di chiesa</Badge>}
                  {categoria === 'esterni' && <Badge variant="rosso" size="sm">Canti esterni</Badge>}

                  {bpmTesto.trim() && (
                    <Badge variant="neutral" size="sm">
                      {bpmTesto.trim().toLowerCase().includes('bpm') ? bpmTesto.trim() : `${bpmTesto.trim()} BPM`}
                    </Badge>
                  )}

                  {misura.trim() && (
                    <Badge variant="neutral" size="sm">
                      Misura: {misura.trim()}
                    </Badge>
                  )}

                  {ritmo.trim() && (
                    <Badge variant="neutral" size="sm">
                      Ritmo: {ritmo.trim()}
                    </Badge>
                  )}

                  {capotasto.trim() && (
                    <Badge variant="giallo" size="sm">
                      Capotasto: {capotasto.trim()}°
                    </Badge>
                  )}
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0 0 1.25rem' }} />

                {/* Corpo del canto renderizzato esattamente come nel sito */}
                {testoChordpro.trim() ? (
                  <ChordProRenderer
                    chordproText={testoChordpro}
                    showChords={showPreviewChords}
                    fontSizeRem={previewFontSize / 16}
                  />
                ) : (
                  <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2.5rem 0', fontSize: '0.9rem' }}>
                    Inserisci o modifica il testo ChordPro a sinistra per visualizzare qui l'anteprima.
                  </div>
                )}
              </div>
            ) : (
              /* ANTEPRIMA STAMPA A4 */
              previewPages.length > 0 ? (
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
                    color: 'oklch(0.20 0.02 260)',
                    textAlign: 'center',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    padding: '2rem 2.5rem',
                    background: 'white',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid oklch(0.82 0.01 260)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    maxWidth: '460px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <Icon name="print" size={28} />
                  <span>Inserisci o scrivi il testo del canto a sinistra per visualizzare l'anteprima impaginata A4.</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <style>{`
        .canto-btn-label-mobile {
          display: none;
        }
        .canto-btn-label-desktop {
          display: inline;
        }

        .canto-review-toolbar button,
        .canto-review-toolbar-btn {
          color: var(--color-text);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .canto-review-toolbar button:hover:not(:disabled),
        .canto-review-toolbar-btn:hover:not(:disabled) {
          background: var(--color-surface-hover, oklch(0.5 0 0 / 0.15));
          border-color: var(--color-interactive);
        }
        .canto-review-toolbar button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .chord-btn-major {
          color: var(--color-ink) !important;
          background: var(--color-surface-card) !important;
          border-color: var(--color-border) !important;
          font-weight: 700 !important;
        }

        .chord-btn-minor {
          color: var(--color-canti, oklch(0.53 0.18 245)) !important;
          background: var(--color-canti-tenue, oklch(0.95 0.035 245)) !important;
          border-color: oklch(0.53 0.18 245 / 0.3) !important;
          font-weight: 600 !important;
        }

        .chord-btn-rit {
          color: var(--color-giochi-badge-text) !important;
          background: var(--color-giochi-tenue) !important;
          border-color: oklch(0.80 0.18 78 / 0.35) !important;
          font-weight: 700 !important;
        }

        .pennata-sym-btn {
          padding: 0.2rem 0.5rem;
          font-size: 0.85rem;
          font-weight: 700;
          background: var(--color-surface);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .pennata-sym-btn:hover {
          background: var(--color-surface-hover);
          border-color: var(--color-interactive);
        }

        .pennata-preset-btn {
          padding: 0.2rem 0.5rem;
          font-size: 0.72rem;
          font-weight: 600;
          background: var(--color-interactive-tenue);
          color: var(--color-interactive);
          border: 1px solid oklch(0.53 0.18 245 / 0.35);
          border-radius: var(--radius-sm);
          cursor: pointer;
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
          .canto-btn-label-desktop {
            display: none !important;
          }
          .canto-btn-label-mobile {
            display: inline !important;
          }
          .canto-review-header {
            padding: 0.5rem 0.65rem !important;
            gap: 0.35rem !important;
          }
          .canto-review-toolbar {
            overflow-x: hidden !important;
            flex-wrap: wrap !important;
            padding: 0.35rem 0.5rem !important;
            gap: 0.35rem !important;
          }
          .chord-toolbar-row {
            flex-wrap: wrap !important;
            gap: 0.3rem !important;
          }
          .chord-group {
            flex-wrap: wrap !important;
            gap: 2px !important;
          }
          .chord-group-label {
            font-size: 0.66rem !important;
          }
          .canto-review-toolbar button,
          .canto-review-toolbar-btn {
            padding: 0.2rem 0.38rem !important;
            font-size: 0.74rem !important;
          }
          .chord-btn-major,
          .chord-btn-minor {
            padding: 0.22rem 0.38rem !important;
            font-size: 0.76rem !important;
          }
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
