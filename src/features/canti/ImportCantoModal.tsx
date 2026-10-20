/**
 * src/features/canti/ImportCantoModal.tsx
 *
 * Ingresso Unico per l'importazione canti (Fase 11B).
 * Offre due ingressi:
 * 1. Da file PDF (.pdf) tramite pdf_importer.ts
 * 2. Da file Word (.docx) tramite canzoniere_parser.ts
 * Rimuove "Scrivi a mano", "Incolla testo", "Con IA" e import in blocco.
 */

import { useState, useRef } from 'preact/hooks';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { parsePdfCanto, ParsedPdfCantoResult } from './pdf_importer';
import { parseDocx } from './canzoniere_parser';

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

  const [activeTab, setActiveTab] = useState<'pdf' | 'docx'>('pdf');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);

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

  const handleDocxFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseDocx(buffer);

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
        testo_chordpro: parsed.testo_chordpro,
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

  return (
    <div
      className="import-canto-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
          maxWidth: '520px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="upload" size={20} className="text-interactive" />
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Importa Canto
            </h2>
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
              padding: '0.25rem',
            }}
          >
            <Icon name="close" size={18} aria-label="Chiudi" />
          </button>
        </div>

        {/* Schede Ingresso: PDF e Word (.docx) */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-raised, #f3f4f6)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              border: 'none',
              background: activeTab === 'pdf' ? 'var(--color-surface)' : 'transparent',
              borderBottom: activeTab === 'pdf' ? '3px solid var(--color-ink)' : 'none',
              color: activeTab === 'pdf' ? 'var(--color-ink)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <Icon name="file-text" size={16} />
            <span>Da file PDF (.pdf)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docx')}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              border: 'none',
              background: activeTab === 'docx' ? 'var(--color-surface)' : 'transparent',
              borderBottom: activeTab === 'docx' ? '3px solid var(--color-ink)' : 'none',
              color: activeTab === 'docx' ? 'var(--color-ink)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <Icon name="file" size={16} />
            <span>Da Word (.docx)</span>
          </button>
        </div>

        {/* Corpo del Modal */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {errorMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--color-error-bg, #fee2e2)',
                color: 'var(--color-error, #dc2626)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
              }}
            >
              {errorMessage}
            </div>
          )}

          {activeTab === 'pdf' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer?.files[0];
                if (file && /\.pdf$/i.test(file.name)) {
                  handlePdfFile(file);
                } else {
                  setErrorMessage('Seleziona un file con estensione .pdf valido.');
                }
              }}
              style={{
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--color-bg)',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease',
              }}
              onClick={() => pdfInputRef.current?.click()}
            >
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handlePdfFile(file);
                }}
              />
              <Icon name="file-text" size={40} style={{ color: 'var(--color-ink)', marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {isLoading ? 'Analisi PDF in corso...' : 'Trascina qui il file PDF o clicca per sfogliare'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Riconoscimento automatico colonne, allineamento sillabico degli accordi e metadati.
              </div>
            </div>
          ) : (
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
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--color-bg)',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease',
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
              <Icon name="file" size={40} style={{ color: 'var(--color-ink)', marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {isLoading ? 'Analisi file Word in corso...' : 'Trascina qui il file Word (.docx) o clicca'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Importa tabelle a 2 colonne, accordi formattati in grassetto e parametri musicali.
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
            Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}
