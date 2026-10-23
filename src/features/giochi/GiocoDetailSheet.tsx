import { useState } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { AttachmentGallery } from '../allegati/AttachmentGallery';
import { AttachmentUploadManager } from '../allegati/AttachmentUploadManager';
import { Gioco } from '../../lib/db';
import { I18N } from '../../lib/i18n';
import { useAdmin } from '../../lib/auth';

export interface GiocoDetailSheetProps {
  gioco: Gioco | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (gioco: Gioco) => void;
  onDelete?: (gioco: Gioco) => void;
  isNew?: boolean;
}

export function GiocoDetailSheet({
  gioco,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  isNew = false,
}: GiocoDetailSheetProps) {
  const { isAdmin } = useAdmin();
  const [attachmentKey, setAttachmentKey] = useState(0);

  if (!isOpen || !gioco) return null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={gioco.nome}
      subtitle={gioco.materiali ? `Materiali: ${gioco.materiali}` : undefined}
      footer={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: 'var(--space-2)',
          }}
        >
          {isAdmin ? (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete?.(gioco)}
                aria-label="Elimina gioco"
              >
                <Icon name="trash" size={16} />
                <span>{I18N.dialogs.elimina}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit?.(gioco)}
                aria-label="Modifica gioco"
              >
                <Icon name="edit" size={16} />
                <span>{I18N.dialogs.modifica}</span>
              </Button>
            </div>
          ) : (
            <div />
          )}

          <Button variant="primary" size="sm" onClick={onClose}>
            {I18N.dialogs.chiudi}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {isNew ? (
          <div>
            <Badge variant="nuovo" size="sm">Nuovo</Badge>
          </div>
        ) : null}

        {gioco.materiali ? (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-giochi-subtle)',
              borderLeft: '4px solid var(--color-giochi)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--color-ink)',
                marginBottom: 'var(--space-1)',
              }}
            >
              {I18N.giochi.materiali}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', wordBreak: 'break-word' }}>
              {gioco.materiali}
            </div>
          </div>
        ) : null}

        <div>
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
              letterSpacing: '0.04em',
              marginBottom: 'var(--space-2)',
            }}
          >
            {I18N.giochi.regole}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-base)',
              lineHeight: 1.6,
              color: 'var(--color-text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {gioco.regole}
          </div>
        </div>

        {/* Galleria Allegati (Fase 5) */}
        <AttachmentGallery
          key={attachmentKey}
          parentType="gioco"
          parentId={gioco.id}
          isAdmin={isAdmin}
          onChanged={() => setAttachmentKey((k) => k + 1)}
        />

        {isAdmin && (
          <AttachmentUploadManager
            parent={{ type: 'gioco', id: gioco.id }}
            onUploaded={() => setAttachmentKey((k) => k + 1)}
          />
        )}
      </div>
    </BottomSheet>
  );
}
