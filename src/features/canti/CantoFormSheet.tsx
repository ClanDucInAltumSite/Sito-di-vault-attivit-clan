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
import { parseDocx, parsePastedText, AI_IMPORT_PROMPT } from './canzoniere_parser';
import { layoutCanzoniereSong } from './canzoniere_layout';
import { CanzonierePageRenderer } from './CanzonierePageRenderer';

export interface CantoFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (canto: Canto) => void;
  initialCanto?: Canto | null;
  existingTitles: string[];
}

type CreationTab = 'manual' | 'docx' | 'ai';

export function CantoFormSheet({
  isOpen,
  onClose,
  onSaved,
  initialCanto,
  existingTitles,
}: CantoFormSheetProps) {
  // Modalità creazione unificata: 3 ingressi (1. Scrivi a mano, 2. Da Word, 3. Con IA)
  const [activeCreationTab, setActiveCreationTab] = useState<CreationTab>('manual');

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

  // Stati operativi
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingInput, setIsProcessingInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [copiedPromptSuccess, setCopiedPromptSuccess] = useState(false);

  // Input per importazione
  const [preserveColBreak, setPreserveColBreak] = useState(true);
  const [aiPastedInput, setAiPastedInput] = useState('');

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
      setCopiedPromptSuccess(false);
      setAiPastedInput('');
      setActiveCreationTab('manual');
    }
  }, [isOpen, initialCanto]);

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

      setActiveCreationTab('manual');
      setSuccessNotice(`Documento Word "${file.name}" importato con successo! Controlla e rifinisci i campi prima di salvare.`);
      setTimeout(() => setSuccessNotice(null), 8000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore nella lettura del file Word .docx');
    } finally {
      setIsProcessingInput(false);
      input.value = '';
    }
  };

  // Copia prompt per AI esterna
  const handleCopyPrompt = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(AI_IMPORT_PROMPT);
      }
      setCopiedPromptSuccess(true);
      setTimeout(() => setCopiedPromptSuccess(false), 5000);
    } catch {
      setCopiedPromptSuccess(true);
      setTimeout(() => setCopiedPromptSuccess(false), 5000);
    }
  };

  // Estrazione risposta AI (da textarea o direttamente da appunti)
  const handleAiExtract = async () => {
    let rawText = aiPastedInput.trim();

    // Se il riquadro è vuoto, tenta la lettura diretta dagli appunti
    if (!rawText && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim()) {
          rawText = clip.trim();
        }
      } catch {
        // Nessun permesso appunti
      }
    }

    if (!rawText) {
      setErrorMessage('Incolla la risposta fornita dall\'AI nel riquadro per estrarre il canto.');
      return;
    }

    setIsProcessingInput(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const res = parsePastedText(rawText);
      setTitolo(res.titolo);
      setAutore(res.autore || '');
      setTonalita(res.tonalita || '');
      setRitmo(res.ritmo || '');
      setTempoBpm(res.tempo_bpm ? String(res.tempo_bpm) : '');
      setBpmTesto(res.bpm_testo || (res.tempo_bpm ? String(res.tempo_bpm) : ''));
      setMisura(res.misura || '');
      setCapotasto(res.capotasto !== null ? String(res.capotasto) : '');
      setTestoChordpro(res.testo_chordpro);

      setAiPastedInput('');
      setActiveCreationTab('manual');
      setSuccessNotice('Canto digitalizzato con IA estratto con successo! Controlla e rifinisci i campi prima di salvare.');
      setTimeout(() => setSuccessNotice(null), 8000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante l\'interpretazione del testo fornito dall\'AI.');
    } finally {
      setIsProcessingInput(false);
    }
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
          : 'Crea un nuovo canto scrivendolo a mano, caricando un Word (.docx) o digitalizzandolo con IA.'
      }
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={isSaving || isProcessingInput}>
            {I18N.dialogs.annulla}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!isValid || isSaving || isProcessingInput}
          >
            {I18N.dialogs.salva}
          </Button>
        </div>
      }
    >
      <div style={{ overflowX: 'hidden' }}>
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

        {/* Tab switcher per creazione nuovo canto */}
        {!initialCanto && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <SegmentedControl
              options={[
                { value: 'manual', label: '1. Scrivi a mano' },
                { value: 'docx', label: '2. Da Word (.docx)' },
                { value: 'ai', label: '3. Con IA' },
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
        {!initialCanto && activeCreationTab === 'docx' && (
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
        {/* INGRESSO 3: DIGITALIZZA CON IA (FOTO / PDF / RICERCA WEB)     */}
        {/* ------------------------------------------------------------- */}
        {!initialCanto && activeCreationTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="canto-ai-card">
              <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-ink)' }}>
                Come digitalizzare con l'Intelligenza Artificiale
              </h4>
              <ol style={{ paddingLeft: 'var(--space-4)', margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
                <li>Premi <strong>"Copia Prompt per l'AI"</strong> qui sotto.</li>
                <li>Incollalo nella tua chat AI preferita (ChatGPT, Claude, Gemini).</li>
                <li>Allega la foto dello spartito/canzoniere o chiedi il canto scout desiderato: l'AI verificherà gli accordi su fonti affidabili e ricercherà BPM, ritmo con frecce e battiti.</li>
                <li>Copia la risposta dell'AI e premi <strong>"Estrai Canto"</strong>.</li>
              </ol>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyPrompt}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Icon name="file-text" size={16} />
                <span>{copiedPromptSuccess ? 'Prompt Copiato negli Appunti!' : 'Copia Prompt per l\'AI'}</span>
              </Button>

              {copiedPromptSuccess && (
                <div className="canto-alert-banner canto-alert-banner-info" style={{ marginTop: 'var(--space-2)' }}>
                  <Icon name="check" size={14} />
                  <span>Prompt pronto! Ora incollalo nell'AI allegando foto/spartito o indicando la canzone.</span>
                </div>
              )}
            </div>

            <div className="ios-form-group" style={{ marginBottom: 0 }}>
              <label className="ios-form-label" htmlFor="ai-pasted-response">
                Incolla qui la risposta dell'AI (o premi il pulsante per leggere dagli appunti):
              </label>
              <textarea
                id="ai-pasted-response"
                className="ios-form-textarea"
                rows={6}
                placeholder={`TITOLO: ...\nAUTORE: ...\nTEMPO: 4/4\nBPM: circa 92-94\nRITMO: Giù, Giù-Su (↓ ↓↑)\n---\n[Do]Nel mezzo del [Sol]cammin...`}
                value={aiPastedInput}
                onInput={(e) => setAiPastedInput((e.target as HTMLTextAreaElement).value)}
                style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}
              />
            </div>

            <Button
              variant="primary"
              onClick={handleAiExtract}
              disabled={isProcessingInput}
              style={{ justifyContent: 'center' }}
            >
              <Icon name="check" size={16} />
              <span>{isProcessingInput ? 'Elaborazione in corso...' : 'Estrai Canto e Modifica'}</span>
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* INGRESSO 1: SCRIVI A MANO / MODIFICA GUIDATA (DEFAULT)        */}
        {/* ------------------------------------------------------------- */}
        {(initialCanto || activeCreationTab === 'manual') && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
              }}
            >
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
                <label className="ios-form-label" htmlFor="canto-bpm">
                  {I18N.canti.tempoBpm} (Metronomo)
                </label>
                <input
                  id="canto-bpm"
                  type="number"
                  className="ios-form-input"
                  placeholder="es. 112"
                  min="30"
                  max="280"
                  value={tempoBpm}
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    setTempoBpm(val);
                    if (!bpmTesto) setBpmTesto(val);
                  }}
                  disabled={isSaving}
                />
              </div>

              <div className="ios-form-group" style={{ marginBottom: 0 }}>
                <label className="ios-form-label" htmlFor="canto-bpm-testo">
                  BPM (Testo / Intervallo)
                </label>
                <input
                  id="canto-bpm-testo"
                  type="text"
                  className="ios-form-input"
                  placeholder="es. circa 92-94 o 112"
                  value={bpmTesto}
                  onInput={(e) => setBpmTesto((e.target as HTMLInputElement).value)}
                  disabled={isSaving}
                />
              </div>

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

            {/* Editor Testo ChordPro con Pulsanti Rapidi */}
            <div className="ios-form-group">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <label className="ios-form-label" htmlFor="canto-testo-chordpro" style={{ margin: 0 }}>
                  {I18N.canti.testoChordpro} *
                </label>
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
                }}
              >
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
