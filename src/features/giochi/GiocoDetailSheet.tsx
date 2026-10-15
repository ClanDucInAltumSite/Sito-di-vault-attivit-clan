import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { Gioco } from '../../lib/db';
import { I18N } from '../../lib/i18n';
import { useAdmin } from '../../lib/auth';

export interface GiocoDetailSheetProps {
  gioco: Gioco | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (gioco: Gioco) => void;
  onDelete?: (gioco: Gioco) => void;
}

export function GiocoDetailSheet({
  gioco,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: GiocoDetailSheetProps) {
  const { isAdmin } = useAdmin();

  if (!isOpen || !gioco) return null;

  const isNew = Date.now() - new Date(gioco.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;

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
            <Badge variant="giallo" size="sm">Nuovo</Badge>
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

        {/* Predisposizione per la futura galleria allegati (Fase 5) */}
        <div
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-border-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 'var(--space-1)',
            }}
          >
            <Icon name="file-text" size={16} />
            <span>{I18N.giochi.allegati}</span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Schemi di gioco e documenti PDF (Disponibile nella Fase 5).
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
