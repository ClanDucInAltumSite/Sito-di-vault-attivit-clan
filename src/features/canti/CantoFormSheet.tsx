import { useState, useEffect, useRef } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { I18N } from '../../lib/i18n';
import { Canto } from '../../lib/db';
import { saveCanto } from '../../lib/admin_actions';
import { findSimilarName } from '../../lib/search';
import { validateChordPro, ChordProRenderer } from '../../lib/chordpro';

export interface CantoFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (canto: Canto) => void;
  initialCanto?: Canto | null;
  existingTitles: string[];
}

export function CantoFormSheet({
  isOpen,
  onClose,
  onSaved,
  initialCanto,
  existingTitles,
}: CantoFormSheetProps) {
  const [titolo, setTitolo] = useState('');
  const [autore, setAutore] = useState('');
  const [tonalita, setTonalita] = useState('');
  const [ritmo, setRitmo] = useState('');
  const [tempoBpm, setTempoBpm] = useState<string>('');
  const [bpmTesto, setBpmTesto] = useState<string>('');
  const [misura, setMisura] = useState('');
  const [capotasto, setCapotasto] = useState<string>('');
  const [testoChordpro, setTestoChordpro] = useState('');

  const [showLivePreview, setShowLivePreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitolo(initialCanto?.titolo || '');
      setAutore(initialCanto?.autore || '');
      setTonalita(initialCanto?.tonalita || '');
      setRitmo(initialCanto?.ritmo || '');
      setTempoBpm(initialCanto?.tempo_bpm ? String(initialCanto.tempo_bpm) : '');
      setBpmTesto(initialCanto?.bpm_testo || (initialCanto?.tempo_bpm ? String(initialCanto.tempo_bpm) : ''));
      setMisura(initialCanto?.misura || '');
      setCapotasto(initialCanto?.capotasto ? String(initialCanto.capotasto) : '');
      setTestoChordpro(initialCanto?.testo_chordpro || '');
      setErrorMessage(null);
      setShowLivePreview(false);
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

  // Inserimento accordo o direttiva alla posizione corrente del cursore
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

    // Riposiziona il cursore dopo l'inserimento
    setTimeout(() => {
      el.focus();
      const newPos = start + textToInsert.length + cursorOffsetInside;
      el.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleSave = async () => {
    if (!isValid || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const saved = await saveCanto({
        id: initialCanto?.id,
        titolo,
        autore,
        tonalita,
        ritmo,
        tempo_bpm: tempoBpm ? parseInt(tempoBpm, 10) : null,
        bpm_testo: bpmTesto || undefined,
        misura,
        capotasto: capotasto ? parseInt(capotasto, 10) : null,
        testo_chordpro: testoChordpro,
      });
      setIsSaving(false);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(err.message || I18N.dialogs.erroreSalvataggio);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={initialCanto ? 'Modifica Canto' : I18N.canti.nuovoCanto}
      subtitle="Inserisci gli accordi nel formato [Do] o [C] prima della sillaba."
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {I18N.dialogs.annulla}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!isValid || isSaving}
          >
            {I18N.dialogs.salva}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
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
            placeholder="es. Strade e Pensieri per Domani"
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
            placeholder="es. Marco Frisina, Sequeri, Clan Duc In Altum"
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
              BPM (Testo Esatto / Intervallo)
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
              placeholder="es. 4/4, 3/4"
              value={misura}
              onInput={(e) => setMisura((e.target as HTMLInputElement).value)}
              disabled={isSaving}
            />
          </div>

          <div className="ios-form-group" style={{ marginBottom: 0 }}>
            <label className="ios-form-label" htmlFor="canto-ritmo">
              {I18N.canti.ritmo}
            </label>
            <input
              id="canto-ritmo"
              type="text"
              className="ios-form-input"
              placeholder="es. Marcia, Balzo"
              value={ritmo}
              onInput={(e) => setRitmo((e.target as HTMLInputElement).value)}
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

        {/* Editor Testo ChordPro con pulsanti rapidi */}
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

          {/* Barra strumenti per inserimento rapido accordi e direttive */}
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
              style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', height: '28px' }}
              onClick={() => insertAtCursor('{ritornello}\n', 0)}
            >
              {'{ritornello}'}
            </button>
            <button
              type="button"
              className="ios-btn ios-btn-ghost"
              style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', height: '28px' }}
              onClick={() => insertAtCursor('{strofa}\n', 0)}
            >
              {'{strofa}'}
            </button>
            <button
              type="button"
              className="ios-btn ios-btn-ghost"
              style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', height: '28px' }}
              onClick={() => insertAtCursor('{ponte}\n', 0)}
            >
              {'{ponte}'}
            </button>
            <button
              type="button"
              className="ios-btn ios-btn-ghost"
              style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', height: '28px' }}
              onClick={() => insertAtCursor('{nuova_pagina}\n', 0)}
            >
              {'{nuova_pagina}'}
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
            placeholder="[Do]Sai da dove viene, [Sol]sai dove ti porta&#10;[La]questo camminare, [Re]questa strada aperta...&#10;&#10;{ritornello}&#10;[Sol]Canta con noi, [La]batti le mani"
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

        {/* Anteprima Live ChordPro (Se abilitata) */}
        {showLivePreview && testoChordpro ? (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
              overflowX: 'auto',
            }}
          >
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-2)',
              }}
            >
              {I18N.canti.editorPreview}
            </div>
            <ChordProRenderer chordproText={testoChordpro} showChords={true} fontSizeRem={0.9} />
          </div>
        ) : null}
      </form>
    </BottomSheet>
  );
}
