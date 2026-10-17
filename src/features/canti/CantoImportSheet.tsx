import { useState } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import {
  parsePastedText,
  parseDocx,
  ParsedCantoResult,
  AI_IMPORT_PROMPT,
} from './canzoniere_parser';
import { layoutCanzoniereSong } from './canzoniere_layout';
import { CanzonierePageRenderer } from './CanzonierePageRenderer';
import { saveCanto } from '../../lib/admin_actions';
import { Canto } from '../../lib/db';

export interface CantoImportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (canto: Canto) => void;
}

type TabType = 'docx' | 'paste' | 'ai';

export function CantoImportSheet({ isOpen, onClose, onSuccess }: CantoImportSheetProps) {
  const [activeTab, setActiveTab] = useState<TabType>('docx');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);

  // Opzioni
  const [preserveColBreak, setPreserveColBreak] = useState(true);
  const [isMonospace, setIsMonospace] = useState(false);
  const [pastedContent, setPastedContent] = useState('');

  // Risultato del parsing (stato di anteprima e conferma)
  const [parsedResult, setParsedResult] = useState<ParsedCantoResult | null>(null);

  // Campi modificabili nella preview prima del salvataggio
  const [formTitolo, setFormTitolo] = useState('');
  const [formAutore, setFormAutore] = useState('');
  const [formMisura, setFormMisura] = useState('');
  const [formBpmTesto, setFormBpmTesto] = useState('');
  const [formRitmo, setFormRitmo] = useState('');
  const [formCapo, setFormCapo] = useState<string>('');
  const [formTonalita, setFormTonalita] = useState('');
  const [formBody, setFormBody] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await parseDocx(file, { preserveColumnBreak: preserveColBreak, isMonospace });
      populateForm(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore nella lettura del file Word .docx');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteParse = () => {
    if (!pastedContent.trim()) {
      setErrorMessage('Inserisci o incolla del testo per procedere.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = parsePastedText(pastedContent, { isMonospace });
      populateForm(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante il parsing del testo incollato.');
    } finally {
      setIsProcessing(false);
    }
  };

  const populateForm = (res: ParsedCantoResult) => {
    setParsedResult(res);
    setFormTitolo(res.titolo);
    setFormAutore(res.autore || '');
    setFormMisura(res.misura || '');
    setFormBpmTesto(res.bpm_testo || (res.tempo_bpm ? String(res.tempo_bpm) : ''));
    setFormRitmo(res.ritmo || '');
    setFormCapo(res.capotasto !== null ? String(res.capotasto) : '');
    setFormTonalita(res.tonalita || '');
    setFormBody(res.testo_chordpro);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_IMPORT_PROMPT);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 3000);
    } catch {
      // Fallback
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 3000);
    }
  };

  const handleSaveToVault = async () => {
    if (!formTitolo.trim()) {
      setErrorMessage('Il titolo del canto è obbligatorio.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const parsedCapo = formCapo.trim() ? parseInt(formCapo.trim(), 10) : null;
      const saved = await saveCanto({
        titolo: formTitolo.trim(),
        autore: formAutore.trim() || undefined,
        tonalita: formTonalita.trim() || undefined,
        ritmo: formRitmo.trim() || undefined,
        bpm_testo: formBpmTesto.trim() || undefined,
        misura: formMisura.trim() || undefined,
        capotasto: parsedCapo !== null && !isNaN(parsedCapo) ? parsedCapo : null,
        testo_chordpro: formBody.trim(),
      });

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante il salvataggio del canto nel Vault.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Preview live del layout calcolato
  const previewCanto: Canto = {
    id: 'preview-canto',
    titolo: formTitolo || 'Titolo Canto',
    autore: formAutore || null,
    tonalita: formTonalita || null,
    ritmo: formRitmo || null,
    tempo_bpm: formBpmTesto ? parseInt(formBpmTesto.match(/\d+/)?.[0] || '0', 10) || null : null,
    bpm_testo: formBpmTesto || null,
    misura: formMisura || null,
    capotasto: formCapo ? parseInt(formCapo, 10) || null : null,
    testo_chordpro: formBody,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  const layoutResult = parsedResult ? layoutCanzoniereSong(previewCanto) : null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Importa Canto nel Canzoniere"
      subtitle="Word .docx, testo incollato o prompt per AI esterna"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Banner Toast Copia Prompt */}
        {copyToast && (
          <div
            className="ios-badge"
            style={{
              backgroundColor: 'var(--color-ink)',
              color: '#FFFFFF',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            Prompt copiato negli appunti! Incollalo nella tua chat AI con la foto o il PDF.
          </div>
        )}

        {/* Messaggio di Errore */}
        {errorMessage && (
          <div
            className="stampa-overflow-alert"
            style={{
              backgroundColor: 'var(--color-bans-bg)',
              color: 'var(--color-bans-text)',
              borderColor: 'var(--color-bans-border)',
            }}
          >
            <Icon name="info" size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* FASE 1: SELEZIONE METODO DI IMPORTAZIONE (SE NON ANCORA PARSATO) */}
        {!parsedResult ? (
          <div>
            {/* Navigazione tra le 3 modalità */}
            <div
              className="ios-segmented-control"
              style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}
            >
              <button
                type="button"
                className={`ios-segmented-btn ${activeTab === 'docx' ? 'active' : ''}`}
                style={{ flex: 1, padding: 'var(--space-2)' }}
                onClick={() => setActiveTab('docx')}
              >
                1. File Word (.docx)
              </button>
              <button
                type="button"
                className={`ios-segmented-btn ${activeTab === 'paste' ? 'active' : ''}`}
                style={{ flex: 1, padding: 'var(--space-2)' }}
                onClick={() => setActiveTab('paste')}
              >
                2. Incolla Testo
              </button>
              <button
                type="button"
                className={`ios-segmented-btn ${activeTab === 'ai' ? 'active' : ''}`}
                style={{ flex: 1, padding: 'var(--space-2)' }}
                onClick={() => setActiveTab('ai')}
              >
                3. Da Foto / PDF
              </button>
            </div>

            {/* TAB 1: CARICA WORD (.docx) */}
            {activeTab === 'docx' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Carica un file <code>.docx</code> contenente il canto impaginato su tabella a due colonne
                  o paragrafi normali. I titoli, i parametri, il ritmo e gli accordi in grassetto verranno
                  estratti automaticamente.
                </p>

                <div
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-fill-quaternary)',
                  }}
                  onClick={() => document.getElementById('docx-file-input')?.click()}
                >
                  <Icon name="file-text" size={36} style={{ color: 'var(--color-accent)', marginBottom: '8px' }} />
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>
                    Tocca per selezionare il file Word (.docx)
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Nessun upload a server esterni: elaborato interamente sul tuo dispositivo
                  </div>
                  <input
                    id="docx-file-input"
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>
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

            {/* TAB 2: INCOLLA TESTO */}
            {activeTab === 'paste' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Incolla il testo in formato con intestazione <code>TITOLO / AUTORE / ---</code>, con accordi
                  sopra il testo oppure solo testo pulito senza accordi.
                </p>

                <textarea
                  className="ios-form-textarea"
                  rows={8}
                  placeholder={`TITOLO: Nome del Canto\nAUTORE: Autore\nTEMPO: 4/4\nBPM: circa 92-94\nRITMO: Giù, Giù-Su (↓ ↓↑)\n---\n[Do]Nel mezzo del [Sol]cammin...`}
                  value={pastedContent}
                  onInput={(e) => setPastedContent((e.target as HTMLTextAreaElement).value)}
                  style={{ fontFamily: isMonospace ? 'monospace' : 'var(--font-sans)', fontSize: 'var(--font-size-sm)' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>
                    Il testo incollato è a spaziatura fissa (Monospace)
                  </span>
                  <ToggleSwitch
                    checked={isMonospace}
                    onChange={setIsMonospace}
                    aria-label="Spaziatura fissa"
                  />
                </div>

                <Button
                  variant="primary"
                  onClick={handlePasteParse}
                  disabled={isProcessing || !pastedContent.trim()}
                >
                  {isProcessing ? 'Elaborazione in corso...' : 'Analizza Testo e Mostra Anteprima'}
                </Button>
              </div>
            )}

            {/* TAB 3: DA FOTO O PDF (WORKFLOW ESTERNO AI) */}
            {activeTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-fill-quaternary)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '4px solid var(--color-accent)',
                  }}
                >
                  <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                    Come digitalizzare da Foto o PDF
                  </h4>
                  <ol style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
                    <li>Premi il pulsante qui sotto per <strong>copiare il prompt formattatore</strong>.</li>
                    <li>Apri la tua chat AI preferita (ChatGPT, Claude, Gemini, ecc.).</li>
                    <li>Incolla il prompt e allega la foto o il file PDF della pagina del canzoniere.</li>
                    <li>Copia la risposta generata dall'AI e incollala nella scheda <strong>"2. Incolla Testo"</strong>.</li>
                  </ol>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button variant="primary" onClick={handleCopyPrompt} style={{ flex: 1 }}>
                    <Icon name="file-text" size={16} />
                    <span>Copia Prompt per l'AI</span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setActiveTab('paste')}
                    style={{ flex: 1 }}
                  >
                    <span>Vai a "Incolla Testo"</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* FASE 2: ANTEPRIMA, REVISIONE E CONFERMA PRIMA DEL SALVATAGGIO */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Statistiche Rilevate */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Badge variant="azzurro" size="sm">
                {parsedResult.stats.chordsCount} accordi rilevati
              </Badge>
              <Badge variant="neutral" size="sm">
                {parsedResult.stats.totalLines} righe
              </Badge>
              <Badge variant="neutral" size="sm">
                {parsedResult.stats.blocksCount} blocchi
              </Badge>
              {layoutResult && (
                <Badge variant={layoutResult.hasOverflow ? 'rosso' : 'giallo'} size="sm">
                  {layoutResult.declaredPageCount} {layoutResult.declaredPageCount === 1 ? 'pagina A4' : 'pagine A4'} · font {layoutResult.fontSizePt} pt
                </Badge>
              )}
            </div>

            {/* Avvisi del Parser (Se presenti) */}
            {parsedResult.warnings.length > 0 && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bans-bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-bans-border)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-bans-text)',
                }}
              >
                <strong>Avvisi durante l'analisi:</strong>
                <ul style={{ paddingLeft: 'var(--space-4)', marginTop: '4px' }}>
                  {parsedResult.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Campi Metadati Modificabili */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Titolo *</label>
                <input
                  type="text"
                  className="ios-form-input"
                  value={formTitolo}
                  onInput={(e) => setFormTitolo((e.target as HTMLInputElement).value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Autore o Evento</label>
                <input
                  type="text"
                  className="ios-form-input"
                  value={formAutore}
                  placeholder="es. Route Nazionale RS 2014"
                  onInput={(e) => setFormAutore((e.target as HTMLInputElement).value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Tonalità</label>
                <input
                  type="text"
                  className="ios-form-input"
                  value={formTonalita}
                  placeholder="es. Re o Lam"
                  onInput={(e) => setFormTonalita((e.target as HTMLInputElement).value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Tempo (Misura)</label>
                <input
                  type="text"
                  className="ios-form-input"
                  value={formMisura}
                  placeholder="es. 4/4"
                  onInput={(e) => setFormMisura((e.target as HTMLInputElement).value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>BPM (Testo Esatto)</label>
                <input
                  type="text"
                  className="ios-form-input"
                  value={formBpmTesto}
                  placeholder="es. circa 92-94"
                  onInput={(e) => setFormBpmTesto((e.target as HTMLInputElement).value)}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Ritmo Pennata (con frecce)</label>
                <input
                  type="text"
                  className="ios-form-input"
                  value={formRitmo}
                  placeholder="es. Giù, Giù-Su, Su-Giù-Su (↓ ↓↑ ↑↓↑)"
                  onInput={(e) => setFormRitmo((e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            {/* Testo ChordPro Modificabile */}
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                Testo in formato ChordPro (con accordi tra parentesi quadre)
              </label>
              <textarea
                className="ios-form-textarea"
                rows={8}
                value={formBody}
                onInput={(e) => setFormBody((e.target as HTMLTextAreaElement).value)}
                style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}
              />
            </div>

            {/* Anteprima Live Impaginata A4 Stile Ufficiale */}
            {layoutResult && layoutResult.pages.length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  Anteprima di Stampa A4 a Due Colonne ({layoutResult.pages.length} {layoutResult.pages.length === 1 ? 'pagina' : 'pagine'}):
                </div>
                <div
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2)',
                    backgroundColor: 'var(--color-bg)',
                  }}
                >
                  {layoutResult.pages.map((p) => (
                    <div key={p.pageNumber} style={{ transform: 'scale(0.85)', transformOrigin: 'top left', marginBottom: 'var(--space-4)' }}>
                      <CanzonierePageRenderer page={p} isScreenPreview={true} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Azioni di Conferma */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <Button
                variant="secondary"
                onClick={() => setParsedResult(null)}
                disabled={isProcessing}
              >
                Ricomincia
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveToVault}
                disabled={isProcessing}
              >
                {isProcessing ? 'Salvataggio...' : 'Conferma e Salva nel Vault'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
