import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { I18N } from '../../lib/i18n';
import { Ban } from '../../lib/db';
import { saveBan } from '../../lib/admin_actions';
import { findSimilarName } from '../../lib/search';
import { Icon } from '../../ui/Icon';

export interface BanFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (ban: Ban) => void;
  initialBan?: Ban | null;
  existingNames: string[];
}

export function BanFormSheet({
  isOpen,
  onClose,
  onSaved,
  initialBan,
  existingNames,
}: BanFormSheetProps) {
  const [nome, setNome] = useState('');
  const [testo, setTesto] = useState('');
  const [noteGesti, setNoteGesti] = useState('');
  const [link, setLink] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNome(initialBan?.nome || '');
      setTesto(initialBan?.testo || '');
      setNoteGesti(initialBan?.note_gesti || '');
      setLink(initialBan?.link || '');
      setErrorMessage(null);
    }
  }, [isOpen, initialBan]);

  const candidateNames = existingNames.filter(
    (n) => n.trim().toLowerCase() !== (initialBan?.nome || '').trim().toLowerCase()
  );
  const similarName = nome.trim() ? findSimilarName(nome, candidateNames) : null;

  const isValid = nome.trim().length > 0 && testo.trim().length > 0;

  const handleSave = async () => {
    if (!isValid || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const saved = await saveBan({
        id: initialBan?.id,
        nome,
        testo,
        note_gesti: noteGesti,
        link: link.trim() || null,
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
      title={initialBan ? 'Modifica Ban' : I18N.bans.nuovoBan}
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
          <label className="ios-form-label" htmlFor="ban-nome">
            {I18N.bans.nome} *
          </label>
          <input
            id="ban-nome"
            type="text"
            className="ios-form-input"
            required
            placeholder="es. La Macchina del Capo"
            value={nome}
            onInput={(e) => setNome((e.target as HTMLInputElement).value)}
            disabled={isSaving}
          />
        </div>

        <div className="ios-form-group">
          <label className="ios-form-label" htmlFor="ban-testo">
            {I18N.bans.testo} *
          </label>
          <textarea
            id="ban-testo"
            className="ios-form-textarea"
            required
            rows={6}
            placeholder="Testo strofe e ritornello del ban..."
            value={testo}
            onInput={(e) => setTesto((e.target as HTMLTextAreaElement).value)}
            disabled={isSaving}
          />
        </div>

        <div className="ios-form-group">
          <label className="ios-form-label" htmlFor="ban-note-gesti">
            {I18N.bans.noteGesti}
          </label>
          <textarea
            id="ban-note-gesti"
            className="ios-form-textarea"
            rows={3}
            placeholder="Descrivi i gesti associati alle parole e il ritmo..."
            value={noteGesti}
            onInput={(e) => setNoteGesti((e.target as HTMLTextAreaElement).value)}
            disabled={isSaving}
          />
        </div>

        <div className="ios-form-group">
          <label className="ios-form-label" htmlFor="ban-link">
            {I18N.bans.link} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', textTransform: 'none' }}>(opzionale)</span>
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="ban-link"
              type="url"
              inputMode="url"
              className="ios-form-input"
              placeholder={I18N.bans.linkPlaceholder}
              value={link}
              onInput={(e) => setLink((e.target as HTMLInputElement).value)}
              disabled={isSaving}
              style={{ paddingLeft: '38px' }}
            />
            <div
              style={{
                position: 'absolute',
                left: '12px',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
                color: 'var(--color-text-secondary)',
              }}
              aria-hidden="true"
            >
              <Icon name="link" size={16} />
            </div>
          </div>
          <span
            style={{
              display: 'block',
              fontSize: 'var(--font-size-2xs)',
              color: 'var(--color-text-secondary)',
              marginTop: 'var(--space-1)',
            }}
          >
            {I18N.bans.linkHelper}
          </span>
        </div>
      </form>
    </BottomSheet>
  );
}
