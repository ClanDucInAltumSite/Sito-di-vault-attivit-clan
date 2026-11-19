// src/features/vademecum/VademecumDetailSheet.tsx
// Scheda di lettura per Carta di Clan e Regole del Clan con visualizzazione PDF e testo arricchito

import { useState } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { VademecumItem } from '../../lib/vademecum';
import { useAdmin } from '../../lib/auth';
import { openPdfDocument, downloadPdfDocument } from '../../lib/pdf_utils';
import { QuadernoDocRenderer } from '../quaderno/QuadernoDocRenderer';
import { VademecumEditSheet } from './VademecumEditSheet';

export interface VademecumDetailSheetProps {
  item: VademecumItem | null;
  isOpen: boolean;
  onClose: () => void;
  onItemUpdated?: (updated: VademecumItem) => void;
}

export function VademecumDetailSheet({
  item,
  isOpen,
  onClose,
  onItemUpdated,
}: VademecumDetailSheetProps) {
  const { isAdmin } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState<VademecumItem | null>(item);

  // Sincronizza con l'item passato
  if (item && item.id !== currentItem?.id) {
    setCurrentItem(item);
  }

  if (!isOpen || !currentItem) return null;

  const handleSaved = (saved: VademecumItem) => {
    setCurrentItem(saved);
    onItemUpdated?.(saved);
  };

  const handleOpenPdf = () => {
    if (!currentItem.pdfDataUrl) return;
    openPdfDocument(currentItem.pdfDataUrl, currentItem.pdfNome || 'Documento PDF');
  };

  const handleDownloadPdf = () => {
    if (!currentItem.pdfDataUrl) return;
    downloadPdfDocument(currentItem.pdfDataUrl, currentItem.pdfNome || `${currentItem.id}.pdf`);
  };

  const formatSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formattedDate = currentItem.updatedAt
    ? new Date(currentItem.updatedAt).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <>
      <BottomSheet
        isOpen={isOpen && !isEditing}
        onClose={onClose}
        title={currentItem.titolo}
        subtitle={currentItem.descrizioneBreve || 'Documento del Clan'}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {isAdmin ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Icon name="edit" size={15} />
                <span>Modifica</span>
              </Button>
            ) : (
              <div />
            )}

            <Button variant="ghost" size="sm" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingBottom: 'var(--space-6)' }}>
          {/* Header metadati */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <Badge variant={currentItem.section === 'carta_clan' ? 'azzurro' : 'nuovo'} size="sm">
              {currentItem.section === 'carta_clan' ? 'Carta di Clan' : 'Regolamento'}
            </Badge>

            {formattedDate && (
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-tertiary)' }}>
                Ultimo aggiornamento: {formattedDate}
              </span>
            )}
          </div>

          {/* Scheda PDF se presente */}
          {currentItem.pdfDataUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: '180px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bans-tenue)',
                    color: 'var(--color-bans)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="file" size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                    {currentItem.pdfNome || 'Allegato PDF'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                    PDF • {formatSize(currentItem.pdfSize)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" onClick={handleOpenPdf}>
                  <Icon name="eye" size={14} />
                  <span>Apri PDF</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDownloadPdf} aria-label="Scarica PDF">
                  <Icon name="download" size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* Testo del Documento formattato */}
          <div
            className="doc-rendered-body"
            style={{
              lineHeight: 1.6,
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-base)',
            }}
          >
            <QuadernoDocRenderer content={currentItem.contenuto} />
          </div>
        </div>
      </BottomSheet>

      {/* Editor per l'Admin */}
      {isEditing && (
        <VademecumEditSheet
          item={currentItem}
          section={currentItem.section}
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
