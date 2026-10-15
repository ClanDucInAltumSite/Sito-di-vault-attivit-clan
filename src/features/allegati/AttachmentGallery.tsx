// src/features/allegati/AttachmentGallery.tsx
// Galleria di allegati (immagini con zoom modale e documenti PDF)
// Supporto offline tramite Cache API (mostra badge se non scaricato), rendering DOM sicuro, lazy loading.

import { useState, useEffect } from 'preact/hooks';
import { Allegato, getAllegati } from '../../lib/db';
import { getAttachmentPublicUrl, softDeleteAttachment } from '../../lib/attachments';
import { resolveAttachmentSource } from '../../lib/storage-cache';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/Button';

export interface AttachmentGalleryProps {
  parentType: 'gioco' | 'ban' | 'canto' | 'evento';
  parentId: string;
  isAdmin?: boolean;
  onChanged?: () => void;
}

export function AttachmentGallery({
  parentType,
  parentId,
  isAdmin = false,
  onChanged,
}: AttachmentGalleryProps) {
  const [allegati, setAllegati] = useState<Allegato[]>([]);
  const [sources, setSources] = useState<Record<string, { src: string | null; isOffline: boolean }>>({});
  const [zoomedImage, setZoomedImage] = useState<{ src: string; title: string } | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const loadAttachments = async () => {
    try {
      const items = await getAllegati(parentType, parentId, false);
      // Ordina per 'ordine' ascendente
      items.sort((a, b) => a.ordine - b.ordine);
      setAllegati(items);

      // Risolvi sorgenti offline/online per ciascun allegato
      const srcMap: Record<string, { src: string | null; isOffline: boolean }> = {};
      for (const item of items) {
        const publicUrl = getAttachmentPublicUrl(item.storage_path);
        const resolved = await resolveAttachmentSource(publicUrl);
        srcMap[item.id] = {
          src: resolved.src,
          isOffline: resolved.isOfflineFallback,
        };
      }
      setSources(srcMap);
    } catch (err) {
      console.warn('[AttachmentGallery] Errore caricamento allegati:', err);
    }
  };

  useEffect(() => {
    loadAttachments();
  }, [parentType, parentId]);

  const handleDelete = async (item: Allegato) => {
    if (!confirm(`Vuoi rimuovere l'allegato "${item.nome_file}"?`)) return;
    setIsDeletingId(item.id);
    try {
      await softDeleteAttachment(item.id);
      await loadAttachments();
      if (onChanged) onChanged();
    } catch (err: any) {
      alert(err.message || 'Errore durante la cancellazione dell\'allegato');
    } finally {
      setIsDeletingId(null);
    }
  };

  if (allegati.length === 0) {
    return null;
  }

  const images = allegati.filter((a) => a.mime.startsWith('image/'));
  const pdfs = allegati.filter((a) => a.mime === 'application/pdf');

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="attachment-gallery-section">
      <div className="attachment-section-header">
        <span className="attachment-section-title">
          Allegati ({allegati.length})
        </span>
      </div>

      {/* 1. Galleria Immagini */}
      {images.length > 0 && (
        <div className="attachment-grid">
          {images.map((img) => {
            const state = sources[img.id] || { src: null, isOffline: false };
            return (
              <div
                key={img.id}
                className="attachment-thumb-card"
                onClick={() => {
                  if (state.src) {
                    setZoomedImage({ src: state.src, title: img.nome_file });
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Ingrandisci immagine: ${img.nome_file}`}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && state.src) {
                    setZoomedImage({ src: state.src, title: img.nome_file });
                  }
                }}
              >
                {state.src ? (
                  <img
                    src={state.src}
                    alt={img.nome_file}
                    className="attachment-thumb-img"
                    loading="lazy"
                    width={200}
                    height={150}
                  />
                ) : (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px',
                      backgroundColor: 'var(--color-border-subtle)',
                      textAlign: 'center',
                    }}
                  >
                    <Icon name="wifi-off" size={24} style={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }} />
                    <span className="attachment-offline-badge">Non scaricato</span>
                  </div>
                )}

                {state.src && (
                  <div className="attachment-thumb-zoom-badge" aria-hidden="true">
                    <Icon name="zoom-in" size={14} />
                  </div>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    className="attachment-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(img);
                    }}
                    disabled={isDeletingId === img.id}
                    aria-label={`Elimina ${img.nome_file}`}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Elenco Documenti PDF */}
      {pdfs.length > 0 && (
        <div>
          {pdfs.map((pdf) => {
            const state = sources[pdf.id] || { src: null, isOffline: false };
            return (
              <div key={pdf.id} className="attachment-pdf-card">
                <div className="attachment-pdf-info">
                  <div className="attachment-pdf-icon-wrap" aria-hidden="true">
                    <Icon name="file" size={20} />
                  </div>
                  <div className="attachment-pdf-details">
                    <div className="attachment-pdf-title" title={pdf.nome_file}>
                      {pdf.nome_file}
                    </div>
                    <div className="attachment-pdf-meta">
                      PDF • {formatSize(pdf.dimensione)}
                      {state.isOffline && (
                        <span style={{ marginLeft: '8px' }} className="attachment-offline-badge">
                          Non scaricato — serve connessione
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {state.src ? (
                    <a
                      href={state.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ios-btn ios-btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: 'var(--font-size-xs)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Icon name="eye" size={14} />
                      <span>Apri</span>
                    </a>
                  ) : (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      Offline
                    </span>
                  )}

                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(pdf)}
                      isLoading={isDeletingId === pdf.id}
                      aria-label={`Elimina ${pdf.nome_file}`}
                      style={{ color: 'var(--color-bans)', padding: '6px' }}
                    >
                      <Icon name="trash" size={16} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Lightbox Modale per Zoom Immagine */}
      {zoomedImage && (
        <div
          className="attachment-lightbox-backdrop"
          onClick={() => setZoomedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={zoomedImage.title}
        >
          <div className="attachment-lightbox-topbar">
            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', maxWidth: '80%' }}>
              {zoomedImage.title}
            </span>
            <button
              type="button"
              className="ios-btn ios-btn-ghost"
              style={{ color: 'oklch(1 0 0)', padding: '8px', borderRadius: 'var(--radius-full)' }}
              onClick={(e) => {
                e.stopPropagation();
                setZoomedImage(null);
              }}
              aria-label="Chiudi zoom"
            >
              <Icon name="close" size={24} />
            </button>
          </div>

          <img
            src={zoomedImage.src}
            alt={zoomedImage.title}
            className="attachment-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
