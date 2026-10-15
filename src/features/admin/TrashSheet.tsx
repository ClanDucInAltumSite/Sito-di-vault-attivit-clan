import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { I18N } from '../../lib/i18n';
import {
  TrashItem,
  getTrashItems,
  restoreRecord,
  hardDeleteRecord,
  purgeTrash,
} from '../../lib/admin_actions';

export interface TrashSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsChanged?: () => void;
}

export function TrashSheet({ isOpen, onClose, onItemsChanged }: TrashSheetProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadTrash = async () => {
    setIsLoading(true);
    try {
      const list = await getTrashItems();
      setItems(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTrash();
    }
  }, [isOpen]);

  const handleRestore = async (item: TrashItem) => {
    setActionLoadingId(item.id);
    try {
      await restoreRecord(item.table, item.id);
      await loadTrash();
      onItemsChanged?.();
    } catch (err: any) {
      alert(err.message || 'Errore durante il ripristino');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleHardDelete = async (item: TrashItem) => {
    if (
      !confirm(
        `Sei sicuro di voler eliminare DEFINITIVAMENTE «${item.title}»?\n\nAttenzione: gli altri dispositivi potrebbero mostrarlo fino al prossimo aggiornamento completo. L'operazione non può essere annullata.`
      )
    ) {
      return;
    }
    setActionLoadingId(item.id);
    try {
      await hardDeleteRecord(item.table, item.id);
      await loadTrash();
      onItemsChanged?.();
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'eliminazione');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePurgeAll = async () => {
    if (!confirm('Vuoi davvero eliminare definitivamente tutti gli elementi nel cestino?')) {
      return;
    }
    setIsLoading(true);
    try {
      await purgeTrash(); // Svuota tutto
      await loadTrash();
      onItemsChanged?.();
    } catch (err: any) {
      alert(err.message || 'Errore durante lo svuotamento del cestino');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={I18N.admin.cestino}
      subtitle="Elementi eliminati conservati per 180 giorni prima della pulizia definitiva."
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
          {items.length > 0 ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handlePurgeAll}
              disabled={isLoading || actionLoadingId !== null}
            >
              <Icon name="trash" size={16} />
              <span>{I18N.admin.svuotaCestino}</span>
            </Button>
          ) : (
            <div />
          )}
          <Button variant="primary" size="sm" onClick={onClose}>
            {I18N.dialogs.chiudi}
          </Button>
        </div>
      }
    >
      {items.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-8) var(--space-4)',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-border-subtle)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <Icon name="trash" size={24} />
          </div>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
            {I18N.admin.cestinoVuoto}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {items.map((item) => {
            const dateStr = new Date(item.deleted_at).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={`${item.table}-${item.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {item.subtitle}
                    </Badge>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      marginTop: '2px',
                    }}
                  >
                    Eliminato: {dateStr}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestore(item)}
                    isLoading={actionLoadingId === item.id}
                    disabled={actionLoadingId !== null}
                    aria-label={`Ripristina ${item.title}`}
                  >
                    <Icon name="refresh" size={14} />
                    <span>{I18N.admin.ripristina}</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleHardDelete(item)}
                    disabled={actionLoadingId !== null}
                    aria-label={`Elimina definitivamente ${item.title}`}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
