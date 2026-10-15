import { useState, useEffect } from 'preact/hooks';
import { Modal } from './Modal';
import { Button } from './Button';
import { I18N } from '../lib/i18n';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  itemName: string;
  itemTypeLabel?: string;
  isLoading?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  isLoading = false,
}: DeleteConfirmModalProps) {
  const [typedName, setTypedName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTypedName('');
    }
  }, [isOpen]);

  const isMatch = typedName.trim() === itemName.trim();

  const handleConfirm = async () => {
    if (!isMatch || isLoading) return;
    await onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={I18N.admin.confermaElimina}
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {I18N.dialogs.annulla}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={!isMatch || isLoading}
          >
            {I18N.dialogs.elimina}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
          {I18N.admin.doppiaConfermaElimina(itemName)}
        </p>

        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-ink)',
            wordBreak: 'break-word',
          }}
        >
          {itemName}
        </div>

        <div className="ios-form-group" style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
          <label
            htmlFor="delete-confirm-input"
            className="ios-form-label"
            style={{ fontSize: 'var(--font-size-xs)' }}
          >
            Digita il nome per confermare
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            className="ios-form-input"
            autoComplete="off"
            value={typedName}
            onInput={(e) => setTypedName((e.target as HTMLInputElement).value)}
            placeholder={itemName}
            disabled={isLoading}
          />
        </div>
      </div>
    </Modal>
  );
}
