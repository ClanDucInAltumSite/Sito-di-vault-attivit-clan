import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { I18N } from '../../lib/i18n';
import { Gioco } from '../../lib/db';
import { saveGioco } from '../../lib/admin_actions';
import { findSimilarName } from '../../lib/search';

export interface GiocoFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (gioco: Gioco) => void;
  initialGioco?: Gioco | null;
  existingNames: string[];
}

export function GiocoFormSheet({
  isOpen,
  onClose,
  onSaved,
  initialGioco,
  existingNames,
}: GiocoFormSheetProps) {
  const [nome, setNome] = useState('');
  const [regole, setRegole] = useState('');
  const [materiali, setMateriali] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNome(initialGioco?.nome || '');
      setRegole(initialGioco?.regole || '');
      setMateriali(initialGioco?.materiali || '');
      setErrorMessage(null);
    }
  }, [isOpen, initialGioco]);

  // Segnalazione duplicato "morbida" tramite Levenshtein <= 2
  const candidateNames = existingNames.filter(
    (n) => n.trim().toLowerCase() !== (initialGioco?.nome || '').trim().toLowerCase()
  );
  const similarName = nome.trim() ? findSimilarName(nome, candidateNames) : null;

  const isValid = nome.trim().length > 0 && regole.trim().length > 0;

  const handleSave = async () => {
    if (!isValid || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const saved = await saveGioco({
        id: initialGioco?.id,
        nome,
        regole,
        materiali,
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
      title={initialGioco ? 'Modifica Gioco' : I18N.giochi.nuovoGioco}
      subtitle="I campi contrassegnati da * sono obbligatori."
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

        {similarName ? (
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
            {I18N.admin.possibileDoppione(similarName)}
          </div>
        ) : null}

        <div className="ios-form-group">
          <label className="ios-form-label" htmlFor="gioco-nome">
            {I18N.giochi.nome} *
          </label>
          <input
            id="gioco-nome"
            type="text"
            className="ios-form-input"
            required
            placeholder="es. Palla Avvelenata dei Clan"
            value={nome}
            onInput={(e) => setNome((e.target as HTMLInputElement).value)}
            disabled={isSaving}
          />
        </div>

        <div className="ios-form-group">
          <label className="ios-form-label" htmlFor="gioco-materiali">
            {I18N.giochi.materiali}
          </label>
          <input
            id="gioco-materiali"
            type="text"
            className="ios-form-input"
            placeholder="es. 2 palloni leggeri, 4 corde, gessetti"
            value={materiali}
            onInput={(e) => setMateriali((e.target as HTMLInputElement).value)}
            disabled={isSaving}
          />
        </div>

        <div className="ios-form-group">
          <label className="ios-form-label" htmlFor="gioco-regole">
            {I18N.giochi.regole} *
          </label>
          <textarea
            id="gioco-regole"
            className="ios-form-textarea"
            required
            rows={5}
            placeholder="Descrivi lo scopo del gioco, la preparazione del campo e lo svolgimento dettagliato..."
            value={regole}
            onInput={(e) => setRegole((e.target as HTMLTextAreaElement).value)}
            disabled={isSaving}
          />
        </div>
      </form>
    </BottomSheet>
  );
}
