// src/features/vademecum/VademecumEditSheet.tsx
// Foglio di modifica e creazione semplificato per l'Admin per Carta, Regole e Canovacci
// Supporta modifica testo formattato, foto copertina per la Carta e caricamento allegati PDF

import { useState, useEffect, useRef } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import {
  VademecumItem,
  VademecumDocType,
  saveVademecumItem,
  compressCoverImage,
} from '../../lib/vademecum';
import { HEADER_PHOTOS } from '../../lib/photos';
import { useAdmin } from '../../lib/auth';
import { inviaProposta } from '../../lib/proposte';

export interface VademecumEditSheetProps {
  item: VademecumItem | null;
  section: VademecumDocType;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (item: VademecumItem) => void;
}

export function VademecumEditSheet({
  item,
  section,
  isOpen,
  onClose,
  onSaved,
}: VademecumEditSheetProps) {
  const { isAdmin } = useAdmin();
  const [titolo, setTitolo] = useState('');
  const [descrizioneBreve, setDescrizioneBreve] = useState('');
  const [contenuto, setContenuto] = useState('');
  const [fotoCopertinaUrl, setFotoCopertinaUrl] = useState<string | null>(null);
  const [pdfNome, setPdfNome] = useState<string | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [pdfSize, setPdfSize] = useState<number | null>(null);
  const [proponenteNome, setProponenteNome] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressingImg, setIsCompressingImg] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setTitolo(item.titolo);
        setDescrizioneBreve(item.descrizioneBreve);
        setContenuto(item.contenuto);
        setFotoCopertinaUrl(item.fotoCopertinaUrl ?? null);
        setPdfNome(item.pdfNome ?? null);
        setPdfDataUrl(item.pdfDataUrl ?? null);
        setPdfSize(item.pdfSize ?? null);
      } else {
        setTitolo(
          section === 'carta_clan'
            ? 'Carta di Clan'
            : section === 'regole_clan'
            ? 'Regole del Clan'
            : 'Nuovo Canovaccio'
        );
        setDescrizioneBreve('');
        setContenuto('');
        setFotoCopertinaUrl(null);
        setPdfNome(null);
        setPdfDataUrl(null);
        setPdfSize(null);
      }
      setErrorMessage(null);
    }
  }, [isOpen, item, section]);

  if (!isOpen) return null;

  const handleImageFileInput = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      setIsCompressingImg(true);
      setErrorMessage(null);
      try {
        const compressed = await compressCoverImage(input.files[0]);
        setFotoCopertinaUrl(compressed);
      } catch (err: any) {
        setErrorMessage(err.message || "Errore durante l'elaborazione dell'immagine.");
      } finally {
        setIsCompressingImg(false);
        if (imageInputRef.current) {
          imageInputRef.current.value = '';
        }
      }
    }
  };

  const handleFileSelected = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage(
        'Formato non valido. Carica un file PDF (se hai un PowerPoint, salvalo come PDF da PowerPoint o Google Presentazioni).'
      );
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Il file supera la dimensione massima consentita di 15 MB.');
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPdfDataUrl(reader.result as string);
      setPdfNome(file.name);
      setPdfSize(file.size);
    };
    reader.onerror = () => {
      setErrorMessage('Errore durante la lettura del file PDF.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePdf = () => {
    setPdfNome(null);
    setPdfDataUrl(null);
    setPdfSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!titolo.trim()) {
      setErrorMessage('Inserisci un titolo per il documento.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (isAdmin || section !== 'canovaccio') {
        const saved = await saveVademecumItem({
          id: item?.id,
          section: item?.section || section,
          titolo,
          descrizioneBreve,
          contenuto,
          fotoCopertinaUrl,
          pdfNome,
          pdfDataUrl,
          pdfSize,
        });
        onSaved(saved);
        onClose();
      } else {
        const prop = await inviaProposta(
          'canovacci',
          titolo,
          {
            section: 'canovaccio',
            titolo,
            descrizioneBreve,
            contenuto,
            fotoCopertinaUrl,
            pdfNome,
            pdfDataUrl,
            pdfSize,
          },
          proponenteNome
        );
        onSaved({
          id: prop.id,
          section: 'canovaccio',
          titolo: prop.titolo,
          descrizioneBreve,
          contenuto,
          fotoCopertinaUrl,
          pdfNome,
          pdfDataUrl,
          pdfSize,
          updatedAt: prop.created_at,
        });
        onClose();
      }
    } catch (err: any) {
      console.error('Errore salvataggio vademecum:', err);
      setErrorMessage(err.message || 'Impossibile salvare il documento. Riprova.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const titleMap: Record<VademecumDocType, string> = {
    carta_clan: 'Modifica Carta di Clan',
    regole_clan: 'Modifica Regole del Clan',
    canovaccio: isAdmin
      ? item ? 'Modifica Canovaccio' : 'Nuovo Canovaccio'
      : item ? 'Modifica Canovaccio' : 'Proponi un Canovaccio per Pattuglie',
  };

  const subtitleText = isAdmin
    ? 'Pannello Semplice Amministratore'
    : 'La proposta sarà inviata all\'Admin e sarà visibile subito su questo dispositivo.';

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={titleMap[section]}
      subtitle={subtitleText}
      className="vademecum-edit-sheet"
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="ghost" onClick={onClose} disabled={isSaving || isCompressingImg}>
            Annulla
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving || isCompressingImg}>
            <Icon name="check" size={16} />
            <span>
              {isSaving
                ? 'Salvataggio...'
                : isCompressingImg
                ? 'Ottimizzazione foto...'
                : isAdmin
                ? 'Salva documento'
                : 'Invia proposta all\'Admin'}
            </span>
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
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

        {/* 1. TITOLO */}
        <div className="ios-form-group">
          <label htmlFor="vademecum-edit-title" className="ios-form-label">
            Titolo *
          </label>
          <input
            id="vademecum-edit-title"
            type="text"
            className="ios-form-input"
            value={titolo}
            onInput={(e) => setTitolo((e.target as HTMLInputElement).value)}
            placeholder="es. Carta di Clan, Regole o Canovaccio..."
            required
          />
        </div>

        {/* Campo Proponente (visibile solo a utenti non-admin che propongono canovacci) */}
        {!isAdmin && section === 'canovaccio' && (
          <div className="ios-form-group">
            <label htmlFor="vademecum-edit-proponente" className="ios-form-label">
              Tuo nome o Pattuglia (facoltativo)
            </label>
            <input
              id="vademecum-edit-proponente"
              type="text"
              className="ios-form-input"
              value={proponenteNome}
              onInput={(e) => setProponenteNome((e.target as HTMLInputElement).value)}
              placeholder="es. Pattuglia Cervi o Marco"
            />
          </div>
        )}

        {/* 2. DESCRIZIONE BREVE (SOTTOTITOLO PER LA HOME) */}
        <div className="ios-form-group">
          <label htmlFor="vademecum-edit-desc" className="ios-form-label">
            Descrizione Breve (visibile in Home)
          </label>
          <input
            id="vademecum-edit-desc"
            type="text"
            className="ios-form-input"
            value={descrizioneBreve}
            onInput={(e) => setDescrizioneBreve((e.target as HTMLInputElement).value)}
            placeholder="es. I valori e gli impegni comunitari del Clan..."
          />
        </div>

        {/* 3. FOTO DI COPERTINA (SPECIFICA PER LA CARTA DI CLAN) */}
        {section === 'carta_clan' && (
          <div className="ios-form-group">
            <label className="ios-form-label">
              Foto di Copertina (Hero in Home)
            </label>
            <div className="vademecum-cover-picker">
              <div className="vademecum-cover-preview-wrap">
                <img
                  src={fotoCopertinaUrl || HEADER_PHOTOS.home.src}
                  alt="Anteprima foto di copertina Carta di Clan"
                  className="vademecum-cover-preview"
                />
                {fotoCopertinaUrl && (
                  <span className="vademecum-cover-custom-badge">Personalizzata</span>
                )}
              </div>
              <div className="vademecum-cover-actions">
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageFileInput}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isCompressingImg}
                >
                  <Icon name="image" size={15} />
                  <span>
                    {isCompressingImg
                      ? 'Compressione in corso…'
                      : fotoCopertinaUrl
                      ? 'Cambia immagine'
                      : 'Carica foto personalizzata'}
                  </span>
                </Button>
                {fotoCopertinaUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFotoCopertinaUrl(null)}
                    style={{ color: 'var(--color-bans)' }}
                  >
                    <Icon name="trash" size={14} />
                    <span>Ripristina sfondo montagne predefinito</span>
                  </Button>
                )}
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
                  Supporta JPG, PNG, WebP. L'immagine viene ottimizzata automaticamente sul dispositivo per non rallentare l'applicazione.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. TESTO DEL DOCUMENTO */}
        <div className="ios-form-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <label htmlFor="vademecum-edit-content" className="ios-form-label" style={{ marginBottom: 0 }}>
              Testo del Documento
            </label>
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-tertiary)' }}>
              Supporta titoli (#, ##) ed elenchi (-)
            </span>
          </div>
          <textarea
            id="vademecum-edit-content"
            className="ios-form-textarea"
            rows={12}
            value={contenuto}
            onInput={(e) => setContenuto((e.target as HTMLTextAreaElement).value)}
            placeholder="Scrivi qui il testo, le regole o le tracce..."
            style={{
              minHeight: '220px',
            }}
          />
        </div>

        {/* 5. CARICAMENTO FILE PDF / POWERPOINT */}
        <div className="ios-form-group">
          <label className="ios-form-label">
            Allegato PDF (Slide PowerPoint / Documento)
          </label>

          {pdfNome ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bans-tenue)',
                    color: 'var(--color-bans)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="file" size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pdfNome}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                    PDF • {formatSize(pdfSize)}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemovePdf}
                style={{ color: 'var(--color-bans)', flexShrink: 0 }}
                aria-label="Rimuovi allegato PDF"
              >
                <Icon name="trash" size={16} />
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
                  handleFileSelected(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--color-interactive)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4) var(--space-3)',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragging ? 'var(--color-surface-hover)' : 'var(--color-surface)',
                transition: 'all var(--duration-fast) var(--ease-ios)',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files && files[0]) {
                    handleFileSelected(files[0]);
                  }
                }}
              />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <Icon name="upload" size={24} style={{ color: 'var(--color-interactive)' }} />
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                  Carica un file PDF
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)' }}>
                  Trascina qui il file o tocca per sfogliare
                </span>
                <span
                  style={{
                    fontSize: 'var(--font-size-2xs)',
                    color: 'var(--color-text-tertiary)',
                    marginTop: 'var(--space-1)',
                  }}
                >
                  I PowerPoint (.pptx) si possono salvare come PDF da PowerPoint o Google Presentazioni
                </span>
              </div>
            </div>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
