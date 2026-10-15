import { useState } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { AttachmentGallery } from '../allegati/AttachmentGallery';
import { AttachmentUploadManager } from '../allegati/AttachmentUploadManager';
import { Ban } from '../../lib/db';
import { I18N } from '../../lib/i18n';
import { useAdmin } from '../../lib/auth';

export interface BanDetailSheetProps {
  ban: Ban | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReadingMode: (ban: Ban) => void;
  onEdit?: (ban: Ban) => void;
  onDelete?: (ban: Ban) => void;
  onUpdated?: () => void;
}

export function BanDetailSheet({
  ban,
  isOpen,
  onClose,
  onOpenReadingMode,
  onEdit,
  onDelete,
  onUpdated,
}: BanDetailSheetProps) {
  const { isAdmin } = useAdmin();
  const [attachmentKey, setAttachmentKey] = useState(0);

  if (!isOpen || !ban) return null;

  const isNew = Date.now() - new Date(ban.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={ban.nome}
      subtitle={ban.note_gesti ? `Gesti: ${ban.note_gesti}` : undefined}
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
                onClick={() => onDelete?.(ban)}
                aria-label="Elimina ban"
              >
                <Icon name="trash" size={16} />
                <span>{I18N.dialogs.elimina}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit?.(ban)}
                aria-label="Modifica ban"
              >
                <Icon name="edit" size={16} />
                <span>{I18N.dialogs.modifica}</span>
              </Button>
            </div>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onOpenReadingMode(ban);
              }}
            >
              <Icon name="eye" size={16} />
              <span>{I18N.bans.modalitaLettura}</span>
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isNew ? <Badge variant="giallo" size="sm">Nuovo</Badge> : <div />}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onClose();
              onOpenReadingMode(ban);
            }}
          >
            <Icon name="eye" size={16} />
            <span>{I18N.bans.modalitaLettura}</span>
          </Button>
        </div>

        {ban.note_gesti ? (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-bans-subtle)',
              borderLeft: '4px solid var(--color-bans)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--color-bans)',
                marginBottom: 'var(--space-1)',
              }}
            >
              {I18N.bans.noteGesti}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', wordBreak: 'break-word' }}>
              {ban.note_gesti}
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
            {I18N.bans.testo}
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
            {ban.testo}
          </div>
        </div>

        {/* Galleria Allegati (Fase 5) */}
        <AttachmentGallery
          key={attachmentKey}
          parentType="ban"
          parentId={ban.id}
          isAdmin={isAdmin}
          onChanged={() => {
            setAttachmentKey((k) => k + 1);
            onUpdated?.();
          }}
        />

        {isAdmin && (
          <AttachmentUploadManager
            parent={{ type: 'ban', id: ban.id }}
            onUploaded={() => {
              setAttachmentKey((k) => k + 1);
              onUpdated?.();
            }}
          />
        )}
      </div>
    </BottomSheet>
  );
}
