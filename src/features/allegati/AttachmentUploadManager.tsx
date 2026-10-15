// src/features/allegati/AttachmentUploadManager.tsx
// Componente Admin per il caricamento di allegati con compressione automatica WebP,
// supporto fotocamera da smartphone, anteprima e barra di avanzamento.

import { useState, useRef } from 'preact/hooks';
import { uploadAttachment, AttachmentParent, validateAttachmentFile } from '../../lib/attachments';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/Button';

export interface AttachmentUploadManagerProps {
  parent: AttachmentParent;
  onUploaded?: () => void;
}

export function AttachmentUploadManager({ parent, onUploaded }: AttachmentUploadManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    setErrorMessage(null);
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file) return;

    const val = validateAttachmentFile(file);
    if (!val.valid) {
      setErrorMessage(val.error || 'File non valido');
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(10);
    setErrorMessage(null);

    try {
      await uploadAttachment(selectedFile, parent, 0, (pct) => {
        setUploadProgress(pct);
      });

      // Reset
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadProgress(0);
      setIsOpen(false);

      if (onUploaded) onUploaded();
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante il caricamento');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setUploadProgress(0);
    setIsOpen(false);
  };

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      {!isOpen ? (
        <button
          type="button"
          className="ios-btn ios-btn-secondary"
          style={{
            fontSize: 'var(--font-size-xs)',
            padding: '6px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
          onClick={() => setIsOpen(true)}
        >
          <Icon name="plus" size={14} />
          <span>Aggiungi Allegato (Foto o PDF)</span>
        </button>
      ) : (
        <div className="attachment-upload-box">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
              Carica Nuovo Allegato
            </span>
            <button
              type="button"
              className="ios-btn ios-btn-ghost"
              style={{ padding: '4px' }}
              onClick={handleCancel}
              disabled={isUploading}
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          {/* Hidden inputs per selezione file o fotocamera mobile */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {!selectedFile ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Formati ammessi: JPG, PNG, WebP o PDF (max 10 MB).
                <br />Le immagini vengono compresse automaticamente in WebP.
              </p>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon name="file" size={16} />
                  <span>Scegli File</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Icon name="camera" size={16} />
                  <span>Scatta Foto</span>
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* Anteprima file selezionato */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2)',
                  backgroundColor: 'var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Anteprima"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-bans-tenue)',
                      color: 'var(--color-bans)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="file" size={24} />
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <div
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      color: 'var(--color-ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {(selectedFile.size / 1024).toFixed(0)} KB • {selectedFile.type || 'Documento'}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  disabled={isUploading}
                  style={{ color: 'var(--color-bans)' }}
                >
                  <Icon name="close" size={16} />
                </Button>
              </div>

              {/* Barra di avanzamento */}
              {isUploading && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      marginBottom: '4px',
                    }}
                  >
                    <span>Caricamento e compressione...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'var(--color-border)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${uploadProgress}%`,
                        backgroundColor: 'var(--color-interactive)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" onClick={handleCancel} disabled={isUploading}>
                  Annulla
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUpload}
                  isLoading={isUploading}
                >
                  <Icon name="download" size={14} style={{ transform: 'rotate(180deg)' }} />
                  <span>Carica Ora</span>
                </Button>
              </div>
            </div>
          )}

          {/* Avviso di errore */}
          {errorMessage && (
            <div
              style={{
                marginTop: 'var(--space-3)',
                padding: '8px 12px',
                backgroundColor: 'var(--color-bans-tenue)',
                border: '1px solid var(--color-bans)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-bans-text)',
                textAlign: 'left',
              }}
            >
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
