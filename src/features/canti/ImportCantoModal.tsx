/**
 * src/features/canti/ImportCantoModal.tsx
 *
 * Ingresso Unico per l'importazione canti nel Canzoniere Scout.
 * Offre due sole modalità operative (Fase 11B / Compattazione Scout):
 * 1. File Visivi: PDF (Accordi e Spartiti, vari) e Immagini (PNG, JPG)
 * 2. Modello Word & Scrittura Libera: Download modello .docx conforme a "Strade di Coraggio",
 *    caricamento del file compilato e scrittura/incolla con compattazione automatica.
 */

import { useState, useRef } from 'preact/hooks';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { parsePdfCanto, compactChordProText, ParsedPdfCantoResult } from './pdf_importer';
import { parseDocx, parsePastedText } from './canzoniere_parser';
import { downloadScoutWordTemplate } from './word_template';

export interface ImportedSongData {
  titolo: string;
  autore?: string | null;
  categoria?: 'scout' | 'chiesa' | 'esterni' | null;
  tonalita?: string | null;
  misura?: string | null;
  tempo_bpm?: number | null;
  bpm_testo?: string | null;
  ritmo?: string | null;
  capotasto?: number | null;
  origine?: string | null;
  nota_fonte?: string | null;
  testo_chordpro: string;
  warnings?: any[];
  removedNoise?: any[];
  pdfBytes?: Uint8Array | null;
}

export interface ImportCantoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (data: ImportedSongData) => void;
}

export function ImportCantoModal({
  isOpen,
  onClose,
  onImportSuccess,
}: ImportCantoModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'visual' | 'docs'>('visual');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stato per immagini caricate
  const [loadedImage, setLoadedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [imageTitle, setImageTitle] = useState('');
  const [imageAuthor, setImageAuthor] = useState('');
  const [imageText, setImageText] = useState('');

  // Stato per scrittura libera
  const [freeTitle, setFreeTitle] = useState('');
  const [freeAuthor, setFreeAuthor] = useState('');
  const [freeText, setFreeText] = useState('');

  const visualInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);

  // Gestione caricamento PDF
  const handlePdfFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const parsed: ParsedPdfCantoResult = await parsePdfCanto(uint8);

      onImportSuccess({
        titolo: parsed.titolo,
        autore: parsed.autore,
        categoria: parsed.categoria || null,
        tonalita: parsed.tonalita,
        misura: parsed.misura,
        tempo_bpm: parsed.tempo_bpm,
        bpm_testo: parsed.bpm_testo,
        ritmo: parsed.ritmo,
        capotasto: parsed.capotasto,
        origine: 'import_pdf',
        nota_fonte: `Importato da PDF: ${file.name}`,
        testo_chordpro: parsed.testo_chordpro,
        warnings: parsed.warnings,
        removedNoise: parsed.removedNoise,
        pdfBytes: uint8,
      });
      onClose();
    } catch (err) {
      console.error('Errore importazione PDF:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Errore durante la lettura del file PDF. Assicurati che contenga testo selezionabile.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Gestione caricamento Immagine (PNG, JPG)
  const handleImageFile = (file: File) => {
    setErrorMessage(null);
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setImageTitle(cleanName);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLoadedImage({ name: file.name, dataUrl });
    };
    reader.readAsDataURL(file);
  };

  // Compattazione scout del testo inserito per l'immagine
  const handleCompactImageText = () => {
    if (!imageText.trim()) return;
    try {
      // Converte prima eventuali accordi sopra le righe se necessario
      const parsed = parsePastedText(imageText);
      const compacted = compactChordProText(parsed.testo_chordpro);
      setImageText(compacted);
    } catch {
      setImageText(compactChordProText(imageText));
    }
  };

  // Completamento importazione da immagine
  const handleConfirmImageImport = () => {
    if (!imageTitle.trim()) {
      setErrorMessage('Inserisci il titolo del canto.');
      return;
    }
    if (!imageText.trim()) {
      setErrorMessage('Inserisci il testo con accordi del canto.');
      return;
    }

    const parsed = parsePastedText(imageText);
    const finalChordPro = compactChordProText(parsed.testo_chordpro || imageText);

    onImportSuccess({
      titolo: imageTitle.trim(),
      autore: imageAuthor.trim() || null,
      categoria: null,
      tonalita: parsed.tonalita || null,
      misura: parsed.misura || null,
      tempo_bpm: parsed.tempo_bpm || null,
      bpm_testo: parsed.bpm_testo || null,
      ritmo: parsed.ritmo || null,
      capotasto: parsed.capotasto || null,
      origine: 'import_immagine',
      nota_fonte: `Importato da immagine: ${loadedImage?.name || 'scansione'}`,
      testo_chordpro: finalChordPro,
      warnings: [],
      removedNoise: [],
      pdfBytes: null,
    });
    onClose();
  };

  // Gestione caricamento file Word (.docx)
  const handleDocxFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseDocx(buffer);
      const compacted = compactChordProText(parsed.testo_chordpro);

      onImportSuccess({
        titolo: parsed.titolo || file.name.replace(/\.docx$/i, ''),
        autore: parsed.autore,
        categoria: (parsed as any).categoria || null,
        tonalita: parsed.tonalita,
        misura: parsed.misura,
        tempo_bpm: parsed.tempo_bpm,
        bpm_testo: parsed.bpm_testo,
        ritmo: parsed.ritmo,
        capotasto: parsed.capotasto,
        origine: 'import_docx',
        nota_fonte: `Importato da Word (.docx): ${file.name}`,
        testo_chordpro: compacted,
        warnings: parsed.warnings.map((w) => ({
          tipo: 'accordo_ambiguo',
          riga: 0,
          testo: '',
          messaggio: w,
        })),
        removedNoise: [],
        pdfBytes: null,
      });
      onClose();
    } catch (err) {
      console.error('Errore importazione Word:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Errore durante la lettura del file Word (.docx).'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Compattazione scout per la scrittura libera
  const handleCompactFreeText = () => {
    if (!freeText.trim()) return;
    try {
      const parsed = parsePastedText(freeText);
      const compacted = compactChordProText(parsed.testo_chordpro);
      setFreeText(compacted);
    } catch {
      setFreeText(compactChordProText(freeText));
    }
  };

  // Conferma importazione da scrittura libera
  const handleConfirmFreeImport = () => {
    if (!freeTitle.trim()) {
      setErrorMessage('Inserisci il titolo del canto prima di importare.');
      return;
    }
    if (!freeText.trim()) {
      setErrorMessage('Inserisci il testo con accordi del canto.');
      return;
    }

    const parsed = parsePastedText(freeText);
    const finalChordPro = compactChordProText(parsed.testo_chordpro || freeText);

    onImportSuccess({
      titolo: freeTitle.trim(),
      autore: freeAuthor.trim() || parsed.autore || null,
      categoria: parsed.categoria || null,
      tonalita: parsed.tonalita || null,
      misura: parsed.misura || null,
      tempo_bpm: parsed.tempo_bpm || null,
      bpm_testo: parsed.bpm_testo || null,
      ritmo: parsed.ritmo || null,
      capotasto: parsed.capotasto || null,
      origine: 'scrittura_libera',
      nota_fonte: 'Inserimento libero con compattazione Scout',
      testo_chordpro: finalChordPro,
      warnings: [],
      removedNoise: [],
      pdfBytes: null,
    });
    onClose();
  };

  // Gestione selezione file universale per Tab 1 (PDF o Immagine)
  const handleVisualFileSelect = (file: File) => {
    if (/\.pdf$/i.test(file.name)) {
      setLoadedImage(null);
      handlePdfFile(file);
    } else if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
      handleImageFile(file);
    } else {
      setErrorMessage('Formato non supportato. Seleziona un file .pdf oppure un\'immagine (.png, .jpg, .jpeg).');
    }
  };

  return (
    <div
      className="import-canto-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        className="import-canto-modal-card"
        style={{
          width: '100%',
          maxWidth: loadedImage ? '780px' : '560px',
          maxHeight: '90vh',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.2s ease',
        }}
      >
        {/* Intestazione */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface-raised, #f8f9fa)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-ink)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="upload" size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                Importa Canto nel Canzoniere
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Compattazione automatica in stile tascabile Scout (Strofa 1 con accordi, RIT. sintetico)
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: '0.35rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Icon name="close" size={20} aria-label="Chiudi" />
          </button>
        </div>

        {/* Schede Operative (2 sole modalità) */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-raised, #f3f4f6)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              fontWeight: 600,
              fontSize: '0.92rem',
              border: 'none',
              background: activeTab === 'visual' ? 'var(--color-surface)' : 'transparent',
              borderBottom: activeTab === 'visual' ? '3px solid var(--color-ink)' : 'none',
              color: activeTab === 'visual' ? 'var(--color-ink)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon name="image" size={17} />
            <span>File Visivi (PDF e Immagini)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              fontWeight: 600,
              fontSize: '0.92rem',
              border: 'none',
              background: activeTab === 'docs' ? 'var(--color-surface)' : 'transparent',
              borderBottom: activeTab === 'docs' ? '3px solid var(--color-ink)' : 'none',
              color: activeTab === 'docs' ? 'var(--color-ink)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon name="file" size={17} />
            <span>Modello Word & Scrittura Libera</span>
          </button>
        </div>

        {/* Corpo del Modal con Scroll */}
        <div
          style={{
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {errorMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--color-error-bg, #fee2e2)',
                color: 'var(--color-error, #dc2626)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Icon name="info" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: FILE VISIVI (PDF e IMMAGINI) */}
          {activeTab === 'visual' && (
            <div>
              {!loadedImage ? (
                <div>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer?.files[0];
                      if (file) handleVisualFileSelect(file);
                    }}
                    style={{
                      border: '2px dashed var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '2.5rem 1.5rem',
                      textAlign: 'center',
                      backgroundColor: 'var(--color-bg)',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s ease',
                    }}
                    onClick={() => visualInputRef.current?.click()}
                  >
                    <input
                      ref={visualInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleVisualFileSelect(file);
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-ink)' }}>
                      <Icon name="file-text" size={36} />
                      <Icon name="image" size={36} />
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      {isLoading ? 'Analisi e compattazione in corso...' : 'Trascina qui il file PDF o l\'immagine (PNG, JPG)'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', maxWidth: '420px', margin: '0 auto 0.75rem auto' }}>
                      Supporta PDF di Accordi e Spartiti, spartiti generici o screenshot/scansioni fotografiche di canzonieri.
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--color-ink)', fontWeight: 600 }}>
                      <Icon name="upload" size={14} />
                      <span>Clicca per sfogliare dal tuo dispositivo</span>
                    </div>
                  </div>

                  {/* Vantaggi della Compattazione Scout */}
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem 1rem',
                      background: 'var(--color-surface-raised, #f8f9fa)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                      Regole di formattazione automatica applicate:
                    </div>
                    <div>• <strong>Strofa 1:</strong> Accordi completi posizionati esattamente sulle sillabe.</div>
                    <div>• <strong>Strofe 2 e successive:</strong> Solo testo pulito senza accordi ripetuti.</div>
                    <div>• <strong>Ritornello:</strong> Primo ritornello con <code>RIT:</code>, ripetizioni successive compattate in <code>RIT.</code></div>
                    <div>• <strong>Filtro rumore:</strong> Rimozione automatica di copyright, numeri di pagina e avvisi web.</div>
                  </div>
                </div>
              ) : (
                /* Modalità Assistente Immagine */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                      Immagine caricata: {loadedImage.name}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLoadedImage(null);
                        setImageText('');
                      }}
                    >
                      Rimuovi / Scegli altro file
                    </Button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 1fr) minmax(260px, 1.3fr)',
                      gap: '1rem',
                      maxHeight: '400px',
                    }}
                  >
                    {/* Anteprima Immagine */}
                    <div
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#000000',
                        maxHeight: '380px',
                      }}
                    >
                      <img
                        src={loadedImage.dataUrl}
                        alt="Anteprima spartito"
                        style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain' }}
                      />
                    </div>

                    {/* Area Testo e Trascrizione Assistita */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Titolo del canto *"
                          value={imageTitle}
                          onInput={(e) => setImageTitle((e.target as HTMLInputElement).value)}
                          style={{
                            flex: 1.5,
                            padding: '0.45rem 0.65rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            fontSize: '0.85rem',
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Autore (opzionale)"
                          value={imageAuthor}
                          onInput={(e) => setImageAuthor((e.target as HTMLInputElement).value)}
                          style={{
                            flex: 1,
                            padding: '0.45rem 0.65rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            fontSize: '0.85rem',
                          }}
                        />
                      </div>

                      <textarea
                        rows={10}
                        placeholder={"Incolla o trascrivi qui il testo e accordi...\nEsempio:\nDO           SOL\nTra boschi e prati verdi\n\nOppure in formato ChordPro:\n[DO]Tra boschi e [SOL]prati verdi"}
                        value={imageText}
                        onInput={(e) => setImageText((e.target as HTMLTextAreaElement).value)}
                        style={{
                          width: '100%',
                          flex: 1,
                          padding: '0.65rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontFamily: 'monospace',
                          fontSize: '0.82rem',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                        }}
                      />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCompactImageText}
                          title="Rimuove gli accordi dalle strofe successive e converte i ritornelli duplicati in RIT."
                        >
                          Compatta Canzoniere Scout
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleConfirmImageImport}>
                          Importa Canto
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MODELLO WORD & SCRITTURA LIBERA */}
          {activeTab === 'docs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Sezione 1: Template Word (.docx) */}
              <div
                style={{
                  padding: '1rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-raised, #f9fafb)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                      1. Modello Word / Google Docs pre-impostato
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Scarica il modello ufficiale conforme a "Strade di Coraggio", modificalo su Word o Google Docs e ricaricalo compilato.
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => downloadScoutWordTemplate('Modello_Canto_Scout.docx')}
                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Icon name="download" size={15} />
                    <span>Scarica Modello .docx</span>
                  </Button>
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer?.files[0];
                    if (file && /\.docx$/i.test(file.name)) {
                      handleDocxFile(file);
                    } else {
                      setErrorMessage('Seleziona un file con estensione .docx valido.');
                    }
                  }}
                  style={{
                    border: '1.5px dashed var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem 1rem',
                    textAlign: 'center',
                    backgroundColor: 'var(--color-bg)',
                    cursor: 'pointer',
                  }}
                  onClick={() => docxInputRef.current?.click()}
                >
                  <input
                    ref={docxInputRef}
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleDocxFile(file);
                    }}
                  />
                  <Icon name="file" size={28} style={{ color: 'var(--color-ink)', marginBottom: '0.35rem' }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {isLoading ? 'Analisi Word in corso...' : 'Trascina qui il file .docx compilato o clicca'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Riconosce tabelle a 2 colonne, accordi in grassetto e compattazione scout automatica.
                  </div>
                </div>
              </div>

              {/* Sezione 2: Scrittura Libera / Incolla Testo */}
              <div
                style={{
                  padding: '1rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                    2. Scrittura Libera o Incolla Rapido
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Incolla testo da qualsiasi sito o digita liberamente con accordi sopra le parole o tra parentesi quadre.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Titolo del canto *"
                    value={freeTitle}
                    onInput={(e) => setFreeTitle((e.target as HTMLInputElement).value)}
                    style={{
                      flex: 1.5,
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Autore (opzionale)"
                    value={freeAuthor}
                    onInput={(e) => setFreeAuthor((e.target as HTMLInputElement).value)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>

                <textarea
                  rows={8}
                  placeholder={"Incolla qui il testo del canto con gli accordi...\nAccetta accordi posizionati sopra il testo (es. da siti web) o [Accordo] inline."}
                  value={freeText}
                  onInput={(e) => setFreeText((e.target as HTMLTextAreaElement).value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCompactFreeText}
                    title="Rimuove accordi dalle strofe successive e sintetizza i ritornelli ripetuti in RIT."
                  >
                    Compatta Canzoniere Scout
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleConfirmFreeImport}>
                    Importa Canto
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface-raised, #f9fafb)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
}
