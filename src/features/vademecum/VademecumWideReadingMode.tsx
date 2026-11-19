// src/features/vademecum/VademecumWideReadingMode.tsx
// Visualizzazione a schermo intero stile Documenti Google (come per le note del diario Quaderno)
// per la Carta di Clan, Regole e Canovacci con supporto PDF e modifica rapida admin

import { useState, useEffect } from 'preact/hooks';
import { VademecumItem, subscribeVademecum, getVademecumItem } from '../../lib/vademecum';
import { useAdmin } from '../../lib/auth';
import { Icon } from '../../ui/Icon';
import { QuadernoDocRenderer } from '../quaderno/QuadernoDocRenderer';
import { QuadernoDocEditor } from '../quaderno/QuadernoDocEditor';
import { WhatsAppShareModal } from '../calendario/WhatsAppShareModal';

export interface VademecumWideReadingModeProps {
  item: VademecumItem | null;
  isOpen: boolean;
  onClose: () => void;
  onItemUpdated?: (updated: VademecumItem) => void;
}

export function VademecumWideReadingMode({
  item,
  isOpen,
  onClose,
  onItemUpdated,
}: VademecumWideReadingModeProps) {
  const { isAdmin } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState<VademecumItem | null>(item);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setCurrentItem(item);
    }
  }, [item]);

  // Aggiornamento reattivo da IndexedDB in tempo reale
  useEffect(() => {
    if (!currentItem?.id) return;
    const unsubscribe = subscribeVademecum(async () => {
      const fresh = await getVademecumItem(currentItem.id);
      if (fresh) {
        setCurrentItem(fresh);
      }
    });
    return unsubscribe;
  }, [currentItem?.id]);

  // Gestione tasto indietro browser / popstate
  useEffect(() => {
    if (!isOpen || !currentItem) return;

    if (window.history.state?.vademecumEditorOpen) {
      window.history.replaceState({ vademecumReadingOpen: true, docId: currentItem.id }, '');
    } else if (!window.history.state?.vademecumReadingOpen) {
      window.history.pushState({ vademecumReadingOpen: true, docId: currentItem.id }, '');
    }

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.vademecumReadingOpen) {
        window.history.replaceState(null, '');
      }
    };
  }, [isOpen, currentItem?.id, onClose]);

  // Blocco scroll del body ed Escape
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen || !currentItem) return null;

  const handleClose = () => {
    if (window.history.state?.vademecumReadingOpen) {
      window.history.back();
    } else {
      onClose();
    }
  };

  const handleOpenPdf = () => {
    if (!currentItem.pdfDataUrl) return;
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${currentItem.pdfDataUrl}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`
      );
      win.document.title = currentItem.pdfNome || currentItem.titolo;
    }
  };

  const handleDownloadPdf = () => {
    if (!currentItem.pdfDataUrl) return;
    const a = document.createElement('a');
    a.href = currentItem.pdfDataUrl;
    a.download = currentItem.pdfNome || `${currentItem.titolo}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSaved = (saved: VademecumItem) => {
    setCurrentItem(saved);
    onItemUpdated?.(saved);
    setIsEditing(false);
  };

  const formatSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formattedDate = currentItem.updatedAt
    ? new Date(currentItem.updatedAt).toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const whatsAppText = `*${currentItem.titolo}*\n${currentItem.descrizioneBreve}\n\n${currentItem.contenuto.slice(0, 500)}...`;

  return (
    <>
      <div
        className="doc-editor-container"
        role="dialog"
        aria-modal="true"
        aria-label={`Documento: ${currentItem.titolo}`}
      >
        {/* TOP BAR APPLE DELLA MODALITÀ LETTURA AMPIA */}
        <header className="doc-editor-topbar">
          <div className="doc-topbar-left">
            <button
              type="button"
              className="doc-icon-btn"
              onClick={handleClose}
              title="Torna indietro"
              aria-label="Torna indietro"
            >
              <Icon name="chevron-left" size={22} />
            </button>

            <div className="doc-topbar-info">
              <span className="doc-topbar-title">{currentItem.titolo}</span>
              <div className="doc-topbar-meta">
                <span className="doc-status-badge doc-status-saved">
                  <Icon name="book-open" size={13} />
                  <span>
                    {currentItem.section === 'carta_clan'
                      ? 'Carta di Clan'
                      : currentItem.section === 'regole_clan'
                      ? 'Regole del Clan'
                      : 'Canovaccio'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="doc-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* Condivisione WhatsApp */}
            <button
              type="button"
              className="ios-btn ios-btn-secondary ios-btn-sm"
              onClick={() => setIsWhatsAppOpen(true)}
              title="Condividi testo"
            >
              <Icon name="share" size={15} />
              <span className="doc-topbar-btn-text">Condividi</span>
            </button>

            {/* Modifica per Admin */}
            {isAdmin && (
              <button
                type="button"
                className="ios-btn ios-btn-primary ios-btn-sm"
                onClick={() => setIsEditing(true)}
                title="Modifica documento"
              >
                <Icon name="edit" size={15} />
                <span className="doc-topbar-btn-text">Modifica</span>
              </button>
            )}
          </div>
        </header>

        {/* WORKSPACE FOGLIO A GRANDE SCHERMO (COME QUADERNO DI CLAN) */}
        <main className="doc-sheet-viewport">
          <div className="doc-sheet doc-reading-sheet">
            {currentItem.fotoCopertinaUrl && (
              <div className="doc-reading-cover-banner">
                <img
                  src={currentItem.fotoCopertinaUrl}
                  alt={`Copertina per ${currentItem.titolo}`}
                  className="doc-reading-cover-img"
                />
              </div>
            )}
            {/* Header del documento: Titolo, Badge e Data */}
            <div className="doc-reading-header">
              <h1 className="doc-reading-title">
                {currentItem.titolo}
              </h1>

              <div className="doc-reading-meta">
                <span className="doc-reading-date">
                  Ultimo aggiornamento: {formattedDate}
                </span>

                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    fontSize: 'var(--font-size-2xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    backgroundColor:
                      currentItem.section === 'carta_clan'
                        ? 'var(--color-brand-purple-tenue)'
                        : currentItem.section === 'regole_clan'
                        ? 'var(--color-uscita-tenue)'
                        : 'var(--color-giochi-tenue)',
                    color:
                      currentItem.section === 'carta_clan'
                        ? 'var(--color-brand-purple-text)'
                        : currentItem.section === 'regole_clan'
                        ? 'var(--color-uscita-text)'
                        : 'var(--color-giochi-badge-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {currentItem.section === 'carta_clan'
                    ? 'Documento Fondamentale'
                    : currentItem.section === 'regole_clan'
                    ? 'Patto Comunitario'
                    : 'Traccia Pattuglia'}
                </span>
              </div>
            </div>

            {/* Card PDF se presente */}
            {currentItem.pdfDataUrl && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  margin: 'var(--space-4) 0',
                  gap: 'var(--space-3)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: '180px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-bans-tenue)',
                      color: 'var(--color-bans)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="file" size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-ink)' }}>
                      {currentItem.pdfNome || 'Documento / Slide PDF'}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                      PDF • {formatSize(currentItem.pdfSize)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className="ios-btn ios-btn-secondary ios-btn-sm"
                    onClick={handleOpenPdf}
                  >
                    <Icon name="eye" size={14} />
                    <span>Apri PDF</span>
                  </button>
                  <button
                    type="button"
                    className="ios-btn ios-btn-ghost ios-btn-sm"
                    onClick={handleDownloadPdf}
                    aria-label="Scarica PDF"
                  >
                    <Icon name="download" size={16} />
                  </button>
                </div>
              </div>
            )}

            <hr className="doc-sheet-divider" />

            {/* CONTENUTO RENDERIZZATO SICURO A GRANDE SCHERMO */}
            <div className="doc-reading-content doc-rendered">
              <QuadernoDocRenderer content={currentItem.contenuto} />
            </div>
          </div>
        </main>
      </div>

      {/* Editor per l'Admin: Documenti Google WYSIWYG completo come nel Quaderno */}
      {isEditing && currentItem && (
        <QuadernoDocEditor
          vademecumItem={currentItem}
          isOpen={isEditing}
          onClose={(updated: VademecumItem) => {
            setIsEditing(false);
            if (updated) {
              handleSaved(updated);
            }
          }}
        />
      )}

      {/* Condivisione WhatsApp */}
      <WhatsAppShareModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        messageText={whatsAppText}
      />
    </>
  );
}
