// src/features/vademecum/CartaFotoEditModal.tsx
// Modale dedicato per l'Admin per modificare o aggiornare esclusivamente
// la foto di copertina della Carta di Clan esposta nella schermata iniziale del Vault.

import { useState, useEffect, useRef } from 'preact/hooks';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import {
  VademecumItem,
  saveVademecumItem,
  compressCoverImage,
  getVademecumItem,
  DEFAULT_VADEMECUM_ITEMS,
} from '../../lib/vademecum';
import { HEADER_PHOTOS } from '../../lib/photos';

export interface CartaFotoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartaDoc: VademecumItem | null;
  onSaved: (updated: VademecumItem) => void;
}

export function CartaFotoEditModal({
  isOpen,
  onClose,
  cartaDoc,
  onSaved,
}: CartaFotoEditModalProps) {
  const [currentFotoUrl, setCurrentFotoUrl] = useState<string | null>(null);
  const [initialFotoUrl, setInitialFotoUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const url = cartaDoc?.fotoCopertinaUrl ?? null;
      setCurrentFotoUrl(url);
      setInitialFotoUrl(url);
      setErrorMessage(null);
    }
  }, [isOpen, cartaDoc?.fotoCopertinaUrl]);

  if (!isOpen) return null;

  const hasChanged = currentFotoUrl !== initialFotoUrl;

  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        setErrorMessage("Seleziona un file immagine valido (JPG, PNG, WebP).");
        return;
      }
      setIsCompressing(true);
      setErrorMessage(null);
      try {
        const compressed = await compressCoverImage(file);
        setCurrentFotoUrl(compressed);
      } catch (err: any) {
        setErrorMessage(err.message || "Errore durante l'elaborazione dell'immagine.");
      } finally {
        setIsCompressing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleResetToDefault = () => {
    setCurrentFotoUrl(null);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // Recupera o ricava il documento Carta di Clan completo
      const baseItem =
        cartaDoc ||
        (await getVademecumItem('carta_clan')) ||
        DEFAULT_VADEMECUM_ITEMS.find((d) => d.id === 'carta_clan')!;

      const updated = await saveVademecumItem({
        id: baseItem.id || 'carta_clan',
        section: 'carta_clan',
        titolo: baseItem.titolo || 'Carta di Clan',
        descrizioneBreve:
          baseItem.descrizioneBreve ||
          'I valori, la legge della strada e gli impegni comunitari del Clan',
        contenuto: baseItem.contenuto || '',
        pdfNome: baseItem.pdfNome ?? null,
        pdfDataUrl: baseItem.pdfDataUrl ?? null,
        pdfSize: baseItem.pdfSize ?? null,
        fotoCopertinaUrl: currentFotoUrl,
      });

      onSaved(updated);
      onClose();
    } catch (err: any) {
      console.error('Errore salvataggio foto Carta di Clan:', err);
      setErrorMessage(err.message || 'Impossibile salvare la nuova foto. Riprova.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Modifica Foto Carta di Clan"
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={isSaving || isCompressing}>
            Annulla
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasChanged || isSaving || isCompressing}
          >
            <Icon name="check" size={16} />
            <span>
              {isSaving
                ? 'Salvataggio…'
                : isCompressing
                ? 'Elaborazione foto…'
                : 'Salva nuova foto'}
            </span>
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          Questa foto apparirà come copertina principale della <strong>Carta di Clan</strong> nella schermata iniziale.
          Se in futuro il Clan rinnova la Carta o ne realizzate una nuova versione fotografata, puoi aggiornarla qui in qualsiasi momento.
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bans-tenue)',
              color: 'var(--color-bans)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Anteprima foto interattiva con effetto scrim identico a quello in Home */}
        <div
          style={{
            position: 'relative',
            height: '170px',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-rest)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <img
            src={currentFotoUrl || HEADER_PHOTOS.home.src}
            alt="Anteprima foto Carta di Clan"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.92) 100%)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Badge variant="azzurro" size="sm">Documento Fondamentale</Badge>
              {currentFotoUrl ? (
                <Badge variant="nuovo" size="sm">Foto Personalizzata</Badge>
              ) : (
                <Badge variant="neutral" size="sm">Sfondo Predefinito</Badge>
              )}
            </div>
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: '#ffffff' }}>
              {cartaDoc?.titolo || 'Carta di Clan'}
            </div>
          </div>
        </div>

        {/* Azioni Caricamento / Ripristino */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing || isSaving}
              style={{ flex: 1, minWidth: '170px' }}
            >
              <Icon name="camera" size={16} />
              <span>
                {isCompressing
                  ? 'Compressione in corso…'
                  : currentFotoUrl
                  ? 'Scegli un\'altra foto'
                  : 'Carica foto Carta di Clan'}
              </span>
            </Button>

            {currentFotoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetToDefault}
                disabled={isCompressing || isSaving}
                style={{ color: 'var(--color-bans)' }}
              >
                <Icon name="trash" size={14} />
                <span>Ripristina sfondo predefinito</span>
              </Button>
            )}
          </div>

          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
            Supporta formati JPG, PNG e WebP. La foto viene ridimensionata e compressa automaticamente sul tuo dispositivo (max 1200x700) per garantire massima fluidità e funzionamento offline.
          </span>
        </div>
      </div>
    </Modal>
  );
}
