import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { I18N } from '../../lib/i18n';
import { Canto } from '../../lib/db';
import { saveCanto } from '../../lib/admin_actions';
import { findSimilarName } from '../../lib/search';
import { validateChordPro, ChordProRenderer } from '../../lib/chordpro';
import { parseDocx, ParsedCantoResult } from './canzoniere_parser';
import { layoutCanzoniereSong } from './canzoniere_layout';
import { CanzonierePageRenderer } from './CanzonierePageRenderer';
import { CantoPasteReviewView } from './CantoPasteReviewView';
import { TouchChordEditor } from './TouchChordEditor';
import {
  saveCantoDraft,
  loadCantoDraft,
  clearCantoDraft,
  formatDraftTime,
  CantoDraft,
} from './canto_draft';

export interface CantoFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (canto: Canto) => void;
  initialCanto?: Canto | null;
  existingTitles: string[];
}

type CreationTab = 'paste' | 'docx';

export function CantoFormSheet({
  isOpen,
  onClose,
  onSaved,
  initialCanto,
  existingTitles,
}: CantoFormSheetProps) {
  // Modalità creazione unificata: 2 ingressi (1. Incolla o scrivi con revisione, 2. Da Word)
  const [activeCreationTab, setActiveCreationTab] = useState<CreationTab>('paste');

  // Campi del Canto
  const [titolo, setTitolo] = useState('');
  const [autore, setAutore] = useState('');
  const [tonalita, setTonalita] = useState('');
  const [ritmo, setRitmo] = useState('');
  const [tempoBpm, setTempoBpm] = useState<string>('');
  const [bpmTesto, setBpmTesto] = useState<string>('');
  const [misura, setMisura] = useState('');
  const [capotasto, setCapotasto] = useState<string>('');
  const [testoChordpro, setTestoChordpro] = useState('');

  // Stato anteprima
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'chordpro' | 'print'>('chordpro');

  // Modalità editor: 'text' (textarea ChordPro) o 'touch' (Editor accordi a tocco)
  const [editorMode, setEditorMode] = useState<'text' | 'touch'>('text');

  // Bozza locale non salvata (Fase 10C)
  const [savedDraft, setSavedDraft] = useState<CantoDraft | null>(null);

  // Stati operativi
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingInput, setIsProcessingInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Input e stati per incolla intelligente e revisione (Fase 10B)
  const [pastedRawText, setPastedRawText] = useState('');
  const [isMonospace, setIsMonospace] = useState(false);
  const [isReviewingPaste, setIsReviewingPaste] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [preserveColBreak, setPreserveColBreak] = useState(true);

  // Refs per inserimento mirato
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ritmoInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitolo(initialCanto?.titolo || '');
      setAutore(initialCanto?.autore || '');
      setTonalita(initialCanto?.tonalita || '');
      setRitmo(initialCanto?.ritmo || '');
      setTempoBpm(initialCanto?.tempo_bpm ? String(initialCanto.tempo_bpm) : '');
      setBpmTesto(initialCanto?.bpm_testo || (initialCanto?.tempo_bpm ? String(initialCanto.tempo_bpm) : ''));
      setMisura(initialCanto?.misura || '');
      setCapotasto(initialCanto?.capotasto !== null && initialCanto?.capotasto !== undefined ? String(initialCanto.capotasto) : '');
      setTestoChordpro(initialCanto?.testo_chordpro || '');
      setErrorMessage(null);
      setSuccessNotice(null);
      setShowLivePreview(false);
      setPreviewMode('chordpro');
      setEditorMode('text');
      setPastedRawText('');
      setIsMonospace(false);
      setIsReviewingPaste(false);
      setShowManualForm(!!initialCanto);
      setActiveCreationTab('paste');

      // Verifica presenza bozza non salvata
      if (!initialCanto) {
        const draft = loadCantoDraft();
        if (draft) {
          setSavedDraft(draft);
        } else {
          setSavedDraft(null);
        }
      } else {
        setSavedDraft(null);
      }
    }
  }, [isOpen, initialCanto]);

  // Salvataggio periodico bozza ogni 5 secondi (Fase 10C)
  useEffect(() => {
    if (!isOpen || initialCanto) return;
    const hasContent = Boolean(titolo.trim() || testoChordpro.trim());
    if (!hasContent) return;

    const timer = setInterval(() => {
      saveCantoDraft({
        titolo,
        autore,
        misura,
        bpm_testo: bpmTesto,
        ritmo,
        capotasto,
        tonalita,
        testo_chordpro: testoChordpro,
        note: '',
        settore: 'tutti',
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [isOpen, initialCanto, titolo, autore, misura, bpmTesto, ritmo, capotasto, tonalita, testoChordpro]);

  // Salvataggio immediato debounced su cambio campi
  useEffect(() => {
    if (!isOpen || initialCanto) return;
    const hasContent = Boolean(titolo.trim() || testoChordpro.trim());
    if (!hasContent) return;

    const timer = setTimeout(() => {
      saveCantoDraft({
        titolo,
        autore,
        misura,
        bpm_testo: bpmTesto,
        ritmo,
        capotasto,
        tonalita,
        testo_chordpro: testoChordpro,
        note: '',
        settore: 'tutti',
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [titolo, autore, misura, bpmTesto, ritmo, capotasto, tonalita, testoChordpro]);

  const handleRestoreDraft = () => {
    if (!savedDraft) return;
    setTitolo(savedDraft.titolo || '');
    setAutore(savedDraft.autore || '');
    setMisura(savedDraft.misura || '');
    setBpmTesto(savedDraft.bpm_testo || '');
    setTempoBpm(savedDraft.bpm_testo ? String(parseInt(savedDraft.bpm_testo, 10) || '') : '');
    setRitmo(savedDraft.ritmo || '');
    setCapotasto(savedDraft.capotasto || '');
    setTonalita(savedDraft.tonalita || '');
    setTestoChordpro(savedDraft.testo_chordpro || '');
    setShowManualForm(true);
    setSavedDraft(null);
    setSuccessNotice('Bozza ripristinata con successo!');
  };

  const handleDiscardDraft = () => {
    clearCantoDraft();
    setSavedDraft(null);
  };

  // Segnalazione duplicato "morbida" tramite Levenshtein <= 2
  const candidateTitles = existingTitles.filter(
    (t) => t.trim().toLowerCase() !== (initialCanto?.titolo || '').trim().toLowerCase()
  );
  const similarTitle = titolo.trim() ? findSimilarName(titolo, candidateTitles) : null;

  // Validazione ChordPro "morbida" (avvisi senza bloccare il salvataggio)
  const chordValidation = validateChordPro(testoChordpro);

  const isValid = titolo.trim().length > 0 && testoChordpro.trim().length > 0;

  // Helper per inserimento simbolo nel ritmo (frecce pennata)
  const insertRhythmArrow = (symbol: string) => {
    const el = ritmoInputRef.current;
    if (!el) {
      setRitmo((prev) => (prev ? `${prev} ${symbol}` : symbol));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.substring(0, start);
    const after = el.value.substring(end);
    const textToAdd = before && !before.endsWith(' ') && !before.endsWith('(') ? ` ${symbol}` : symbol;
    const newText = before + textToAdd + after;
    setRitmo(newText);
    setTimeout(() => {
      el.focus();
      const pos = start + textToAdd.length;
      el.setSelectionRange(pos, pos);
    }, 10);
  };

  // Inserimento accordo o direttiva nel textarea
  const insertAtCursor = (textToInsert: string, cursorOffsetInside = 0) => {
    const el = textareaRef.current;
    if (!el) {
      setTestoChordpro((prev) => prev + textToInsert);
      return;
    }

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.substring(0, start);
    const after = el.value.substring(end);

    const newText = before + textToInsert + after;
    setTestoChordpro(newText);

    setTimeout(() => {
      el.focus();
      const newPos = start + textToInsert.length + cursorOffsetInside;
      el.setSelectionRange(newPos, newPos);
    }, 10);
  };

  // Caricamento ed elaborazione Word (.docx)
  const handleDocxFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setIsProcessingInput(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const res = await parseDocx(file, { preserveColumnBreak: preserveColBreak });
      setTitolo(res.titolo);
      setAutore(res.autore || '');
      setTonalita(res.tonalita || '');
      setRitmo(res.ritmo || '');
      setTempoBpm(res.tempo_bpm ? String(res.tempo_bpm) : '');
      setBpmTesto(res.bpm_testo || (res.tempo_bpm ? String(res.tempo_bpm) : ''));
      setMisura(res.misura || '');
      setCapotasto(res.capotasto !== null ? String(res.capotasto) : '');
      setTestoChordpro(res.testo_chordpro);

      setShowManualForm(true);
      setSuccessNotice(`Documento Word "${file.name}" importato con successo! Controlla e rifinisci i campi prima di salvare.`);
      setTimeout(() => setSuccessNotice(null), 8000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore nella lettura del file Word .docx');
    } finally {
      setIsProcessingInput(false);
      input.value = '';
    }
  };

  // Conferma della revisione testo (Fase 10B)
  const handleConfirmReview = (res: ParsedCantoResult) => {
    setTitolo(res.titolo);
    setAutore(res.autore || '');
    setTonalita(res.tonalita || '');
    setRitmo(res.ritmo || '');
    setTempoBpm(res.tempo_bpm ? String(res.tempo_bpm) : '');
    setBpmTesto(res.bpm_testo || (res.tempo_bpm ? String(res.tempo_bpm) : ''));
    setMisura(res.misura || '');
    setCapotasto(res.capotasto !== null ? String(res.capotasto) : '');
    setTestoChordpro(res.testo_chordpro);
    setIsReviewingPaste(false);
    setShowManualForm(true);
    setSuccessNotice('Canto analizzato e revisionato! Controlla e rifinisci i dati prima di salvare.');
    setTimeout(() => setSuccessNotice(null), 8000);
  };

  // Salvataggio nel database / Vault
  const handleSave = async () => {
    if (!isValid || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const parsedCapo = capotasto.trim() ? parseInt(capotasto.trim(), 10) : null;
      const saved = await saveCanto({
        id: initialCanto?.id,
        titolo: titolo.trim(),
        autore: autore.trim() || undefined,
        tonalita: tonalita.trim() || undefined,
        ritmo: ritmo.trim() || undefined,
        tempo_bpm: tempoBpm ? parseInt(tempoBpm, 10) : null,
        bpm_testo: bpmTesto.trim() || undefined,
        misura: misura.trim() || undefined,
        capotasto: parsedCapo !== null && !isNaN(parsedCapo) ? parsedCapo : null,
        testo_chordpro: testoChordpro.trim(),
      });
      setIsSaving(false);
      clearCantoDraft();
      setSavedDraft(null);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(err.message || I18N.dialogs.erroreSalvataggio);
    }
  };

  // Calcolo layout di anteprima per visualizzazione A4
  const previewLayout = useMemo(() => {
    if (!showLivePreview || previewMode !== 'print' || !testoChordpro.trim()) return null;
    const dummyCanto: Canto = {
      id: 'preview-canto',
      titolo: titolo.trim() || 'TITOLO DEL CANTO',
      autore: autore.trim() || null,
      misura: misura.trim() || null,
      bpm_testo: bpmTesto.trim() || null,
      tempo_bpm: tempoBpm ? parseInt(tempoBpm, 10) : null,
      ritmo: ritmo.trim() || null,
      capotasto: capotasto.trim() ? parseInt(capotasto.trim(), 10) : null,
      tonalita: tonalita.trim() || null,
      testo_chordpro: testoChordpro.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    try {
      return layoutCanzoniereSong(dummyCanto);
    } catch {
      return null;
    }
  }, [showLivePreview, previewMode, testoChordpro, titolo, autore, misura, bpmTesto, tempoBpm, ritmo, capotasto, tonalita]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={initialCanto ? 'Modifica Canto' : I18N.canti.nuovoCanto}
      subtitle={
        initialCanto
          ? 'Modifica testo, tonalità, ritmo e accordi.'
          : 'Inserisci un nuovo canto incollando il testo o caricando un file Word (.docx).'
      }
      footer={
        isReviewingPaste ? null : (
          <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose} disabled={isSaving || isProcessingInput}>
              {I18N.dialogs.annulla}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={isSaving}
              disabled={!isValid || isSaving || isProcessingInput || (!initialCanto && !showManualForm)}
            >
              {I18N.dialogs.salva}
            </Button>
          </div>
        )
      }
    >
      <div style={{ overflowX: 'hidden' }}>
        {/* Banner Bozza Locale Non Salvata (Fase 10C) */}
        {savedDraft && !showManualForm && !initialCanto && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--color-giochi-subtle)',
              borderLeft: '4px solid var(--color-giochi)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
            role="status"
          >
            <div>
              <strong style={{ color: 'var(--color-ink)', display: 'block' }}>
                C'è una bozza non salvata ({formatDraftTime(savedDraft.updatedAt)})
              </strong>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                "{savedDraft.titolo || 'Senza titolo'}"
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="primary" size="sm" onClick={handleRestoreDraft}>
                Ripristina
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDiscardDraft}>
                Scarta
              </Button>
            </div>
          </div>
        )}

        {/* Notifica di errore generale */}
        {errorMessage ? (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--color-rosso-subtle)',
              borderLeft: '4px solid var(--color-rosso)',
              color: 'var(--color-rosso)',
              fontSize: 'var(--font-size-sm)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
            }}
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        {/* Notifica di successo importazione */}
        {successNotice ? (
          <div className="canto-alert-banner canto-alert-banner-success" style={{ marginBottom: '16px' }}>
            <Icon name="check" size={16} />
            <span>{successNotice}</span>
          </div>
        ) : null}

        {/* Tab switcher per creazione nuovo canto (Incolla o scrivi | Da Word) */}
        {!initialCanto && !isReviewingPaste && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <SegmentedControl
              options={[
                { value: 'paste', label: '1. Incolla o scrivi' },
                { value: 'docx', label: '2. Da Word (.docx)' },
              ]}
              value={activeCreationTab}
              onChange={(val) => {
                setActiveCreationTab(val as CreationTab);
                setErrorMessage(null);
              }}
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* INGRESSO 2: CARICA FILE WORD (.docx)                          */}
        {/* ------------------------------------------------------------- */}
        {!initialCanto && !isReviewingPaste && activeCreationTab === 'docx' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div
              className="canto-import-dropzone"
              onClick={() => docxInputRef.current?.click()}
            >
              <Icon name="upload" size={36} style={{ color: 'var(--color-interactive)', marginBottom: '8px' }} />
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', color: 'var(--color-ink)' }}>
                {isProcessingInput ? 'Elaborazione del documento in corso...' : 'Tocca per selezionare il file Word (.docx)'}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Estrae automaticamente titolo, autore, BPM, ritmo con frecce, tabelle a 2 colonne e accordi.
              </div>
              <input
                ref={docxInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                onChange={handleDocxFile}
                disabled={isProcessingInput}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                Conserva interruzione di colonna originale (<code>&#123;nuova_colonna&#125;</code>)
              </span>
              <ToggleSwitch
                checked={preserveColBreak}
                onChange={setPreserveColBreak}
                aria-label="Conserva interruzione di colonna"
              />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* INGRESSO 1: INCOLLA O SCRIVI (CON REVISIONE INTELLIGENTE)     */}
        {/* ------------------------------------------------------------- */}
        {!initialCanto && activeCreationTab === 'paste' && isReviewingPaste && (
          <CantoPasteReviewView
            rawText={pastedRawText}
            isMonospace={isMonospace}
            onConfirm={handleConfirmReview}
            onBackToEdit={() => setIsReviewingPaste(false)}
          />
        )}

        {!initialCanto && activeCreationTab === 'paste' && !isReviewingPaste && !showManualForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              Incolla o digita il testo del canto con gli accordi sopra le righe o già nel formato ChordPro <code>[Do]</code>.
              Il sistema normalizzerà gli spazi, rimuoverà il rumore web e aprirà la schermata di revisione a due colonne.
            </div>

            <textarea
              className="ios-form-textarea"
              rows={8}
              placeholder={`Incolla qui il testo...\n\nEsempio con accordi sopra:\nDo              Sol\nNel mezzo del cammin...\n\nOppure ChordPro:\n[Do]Nel mezzo del [Sol]cammin...`}
              value={pastedRawText}
              onInput={(e) => setPastedRawText((e.target as HTMLTextAreaElement).value)}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text)' }}>
                Spaziatura fissa (testo monospace da blocco di codice)
              </span>
              <ToggleSwitch
                checked={isMonospace}
                onChange={setIsMonospace}
                aria-label="Spaziatura fissa monospace"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-2)' }}>
              <Button
                variant="primary"
                disabled={!pastedRawText.trim()}
                onClick={() => setIsReviewingPaste(true)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Icon name="check" size={16} />
                <span style={{ marginLeft: '6px' }}>Analizza e Rivedi</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowManualForm(true)}
              >
                Compila modulo vuoto
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* COMPILAZIONE MODULO (DOPO REVISIONE O MODIFICA ESISTENTE)     */}
        {/* ------------------------------------------------------------- */}
        {(initialCanto || showManualForm) && !isReviewingPaste && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            {!initialCanto && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualForm(false)}
                >
                  <Icon name="chevron-left" size={14} />
                  <span style={{ marginLeft: '4px' }}>Torna a incolla testo</span>
                </Button>
              </div>
            )}
            {similarTitle ? (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-giochi-subtle)',
                  borderLeft: '4px solid var(--color-giochi)',
                  color: 'var(--color-ink)',
                  fontSize: 'var(--font-size-sm)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '16px',
                }}
                role="status"
              >
                {I18N.admin.possibileDoppione(similarTitle)}
              </div>
            ) : null}

            {/* Campi Principali */}
            <div className="ios-form-group">
              <label className="ios-form-label" htmlFor="canto-titolo">
                {I18N.canti.titolo} *
              </label>
              <input
                id="canto-titolo"
                type="text"
                className="ios-form-input"
                required
                placeholder="es. Strade di Coraggio"
                value={titolo}
                onInput={(e) => setTitolo((e.target as HTMLInputElement).value)}
                disabled={isSaving}
              />
            </div>

            <div className="ios-form-group">
              <label className="ios-form-label" htmlFor="canto-autore">
                {I18N.canti.autore}
              </label>
              <input
                id="canto-autore"
                type="text"
                className="ios-form-input"
                placeholder="es. Marco Frisina, Clan La Roccia, Route Nazionale 2014"
                value={autore}
                onInput={(e) => setAutore((e.target as HTMLInputElement).value)}
                disabled={isSaving}
              />
            </div>

            {/* Griglia Metadati Musicali */}
            {/* Griglia Metadati Musicali Simmetrica (2 Colonne fisse) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
              }}
            >
              {/* Riga 1: Tonalità | Capotasto */}
              <div className="ios-form-group" style={{ marginBottom: 0 }}>
                <label className="ios-form-label" htmlFor="canto-tonalita">
                  {I18N.canti.tonalita}
                </label>
                <input
                  id="canto-tonalita"
                  type="text"
                  className="ios-form-input"
                  placeholder="es. Re, Mi-, G"
                  value={tonalita}
                  onInput={(e) => setTonalita((e.target as HTMLInputElement).value)}
                  disabled={isSaving}
                />
              </div>

              <div className="ios-form-group" style={{ marginBottom: 0 }}>
                <label className="ios-form-label" htmlFor="canto-capotasto">
                  {I18N.canti.capotasto}
                </label>
                <input
                  id="canto-capotasto"
                  type="number"
                  className="ios-form-input"
                  placeholder="es. 2 (tasto)"
                  min="0"
                  max="12"
                  value={capotasto}
                  onInput={(e) => setCapotasto((e.target as HTMLInputElement).value)}
                  disabled={isSaving}
                />
              </div>

              {/* Riga 2: Misura | BPM (Unico campo per metronomo e stampa) */}
              <div className="ios-form-group" style={{ marginBottom: 0 }}>
                <label className="ios-form-label" htmlFor="canto-misura">
                  {I18N.canti.misura}
                </label>
                <input
                  id="canto-misura"
                  type="text"
                  className="ios-form-input"
                  placeholder="es. 4/4, 3/4, 6/8"
                  value={misura}
                  onInput={(e) => setMisura((e.target as HTMLInputElement).value)}
                  disabled={isSaving}
                />
              </div>

              <div className="ios-form-group" style={{ marginBottom: 0 }}>
                <label className="ios-form-label" htmlFor="canto-bpm-testo">
                  BPM (Velocità)
                </label>
                <input
                  id="canto-bpm-testo"
                  type="text"
                  className="ios-form-input"
                  placeholder="es. circa 92-94 o 112"
                  value={bpmTesto}
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    setBpmTesto(val);
                    const n = val.match(/\d+/);
                    if (n && n[0]) setTempoBpm(n[0]);
                    else setTempoBpm('');
                  }}
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Campo Ritmo con Tastierino Frecce Pennata */}
            <div className="ios-form-group">
              <label className="ios-form-label" htmlFor="canto-ritmo">
                {I18N.canti.ritmo} (Pennata)
              </label>
              <input
                ref={ritmoInputRef}
                id="canto-ritmo"
                type="text"
                className="ios-form-input"
                placeholder="es. Giù, Giù-Su, Su-Giù-Su (↓ ↓↑ ↑↓↑)"
                value={ritmo}
                onInput={(e) => setRitmo((e.target as HTMLInputElement).value)}
                disabled={isSaving}
              />
              {/* Keypad touch per inserire le frecce del ritmo */}
              <div className="canto-rhythm-keypad">
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  Inserisci frecce:
                </span>
                <button
                  type="button"
                  className="canto-rhythm-btn"
                  onClick={() => insertRhythmArrow('↓')}
                  title="Pennata in giù"
                >
                  ↓ Giù
                </button>
                <button
                  type="button"
                  className="canto-rhythm-btn"
                  onClick={() => insertRhythmArrow('↑')}
                  title="Pennata in su"
                >
                  ↑ Su
                </button>
                <button
                  type="button"
                  className="canto-rhythm-btn"
                  onClick={() => insertRhythmArrow('↓↑')}
                  title="Giù-Su veloce"
                >
                  ↓↑ Giù-Su
                </button>
                <button
                  type="button"
                  className="canto-rhythm-btn"
                  onClick={() => insertRhythmArrow('•')}
                  title="Stoppato"
                >
                  • Stop
                </button>
              </div>
            </div>

            {/* Editor Testo ChordPro con Switcher Editor a Tocco / ChordPro Testuale */}
            <div className="ios-form-group">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <label className="ios-form-label" htmlFor="canto-testo-chordpro" style={{ margin: 0 }}>
                  {I18N.canti.testoChordpro} *
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Switcher Modalità Editor: A tocco vs Testo grezzo */}
                  <SegmentedControl
                    options={[
                      { value: 'touch', label: 'Editor a tocco' },
                      { value: 'text', label: 'ChordPro testuale' },
                    ]}
                    value={editorMode}
                    onChange={(val) => setEditorMode(val as 'text' | 'touch')}
                  />

                  <button
                    type="button"
                    className="ios-btn ios-btn-ghost"
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      padding: '4px 8px',
                      color: 'var(--color-interactive)',
                      fontWeight: 600,
                    }}
                    onClick={() => setShowLivePreview(!showLivePreview)}
                  >
                    <Icon name="eye" size={14} />
                    <span style={{ marginLeft: '4px' }}>
                      {showLivePreview ? 'Nascondi anteprima' : I18N.canti.editorPreview}
                    </span>
                  </button>
                </div>
              </div>

              {editorMode === 'touch' ? (
                <TouchChordEditor
                  chordproText={testoChordpro}
                  tonalita={tonalita}
                  onChange={(newCp) => setTestoChordpro(newCp)}
                  onClose={() => setEditorMode('text')}
                />
              ) : (
                <>
                  {/* Barra strumenti per inserimento rapido accordi (senza graffe criptiche) */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginBottom: 'var(--space-2)',
                      padding: '6px',
                      backgroundColor: 'var(--color-border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      alignItems: 'center',
                    }}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditorMode('touch')}
                      style={{ fontWeight: 700 }}
                    >
                      <Icon name="edit" size={13} />
                      <span style={{ marginLeft: '4px' }}>Aggiungi accordi a tocco</span>
                    </Button>

                    <button
                      type="button"
                      className="ios-btn ios-btn-secondary"
                      style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', height: '28px' }}
                      onClick={() => insertAtCursor('[Do]', -1)}
                    >
                      + [Accordo]
                    </button>
                    <button
                      type="button"
                      className="ios-btn ios-btn-ghost"
                      style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', height: '28px', fontWeight: 700 }}
                      onClick={() => insertAtCursor('\nRIT.\n', 0)}
                      title="Inserisce etichetta ritornello standard"
                    >
                      + RIT.
                    </button>
                    <button
                      type="button"
                      className="ios-btn ios-btn-ghost"
                      style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', height: '28px' }}
                      onClick={() => insertAtCursor('\n{nuova_colonna}\n', 0)}
                      title="Interrompe la colonna e passa alla colonna di destra"
                    >
                      + Nuova colonna
                    </button>
                    <button
                      type="button"
                      className="ios-btn ios-btn-ghost"
                      style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', height: '28px' }}
                      onClick={() => insertAtCursor('\n{nuova_pagina}\n', 0)}
                      title="Interrompe la pagina e passa al foglio successivo"
                    >
                      + Nuova pagina
                    </button>
                  </div>

                  <textarea
                    ref={textareaRef}
                    id="canto-testo-chordpro"
                    className="ios-form-textarea"
                    required
                    rows={10}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 'var(--font-size-sm)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre',
                    }}
                    placeholder="[Do]Sai da dove viene, [Sol]sai dove ti porta&#10;[Lam]questo camminare, [Fa]questa strada aperta...&#10;&#10;RIT.&#10;[Do]Canta con noi, [Sol]batti le mani"
                    value={testoChordpro}
                    onInput={(e) => setTestoChordpro((e.target as HTMLTextAreaElement).value)}
                    disabled={isSaving}
                  />
                </>
              )}
            </div>

            {/* Box Avvisi Validazione Morbida ChordPro */}
            {chordValidation.warnings.length > 0 ? (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-giochi-subtle)',
                  borderLeft: '4px solid var(--color-giochi)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    color: 'var(--color-giochi-text)',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}
                >
                  Controllo Sintassi Accordi (Salvataggio comunque consentito):
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 'var(--font-size-xs)', color: 'var(--color-ink)' }}>
                  {chordValidation.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Anteprima Live ChordPro / Foglio Stampa A4 */}
            {showLivePreview && testoChordpro ? (
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-3)',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {previewMode === 'chordpro' ? 'Anteprima Spartito Interattivo' : 'Anteprima Foglio Stampa A4 (Stile Ufficiale)'}
                  </div>

                  <SegmentedControl
                    options={[
                      { value: 'chordpro', label: 'Spartito' },
                      { value: 'print', label: 'Stampa A4' },
                    ]}
                    value={previewMode}
                    onChange={(val) => setPreviewMode(val as any)}
                  />
                </div>

                {previewMode === 'chordpro' ? (
                  <div style={{ overflowX: 'auto' }}>
                    <ChordProRenderer chordproText={testoChordpro} showChords={true} fontSizeRem={0.9} />
                  </div>
                ) : (
                  previewLayout && (
                    <div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <Badge variant={previewLayout.hasOverflow ? 'rosso' : 'azzurro'} size="sm">
                          {previewLayout.declaredPageCount} {previewLayout.declaredPageCount === 1 ? 'pagina A4' : 'pagine A4'} · Font {previewLayout.fontSizePt} pt
                        </Badge>
                      </div>

                      <div className="canto-print-preview-container">
                        {previewLayout.pages.map((p) => (
                          <div key={p.pageNumber} className="canto-print-preview-page-wrapper">
                            <CanzonierePageRenderer page={p} isScreenPreview={true} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : null}
          </form>
        )}
      </div>
    </BottomSheet>
  );
}
