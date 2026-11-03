// src/features/quaderno/QuadernoFormSheet.tsx
// Modale di creazione e impostazione iniziale pagina del Quaderno di Clan
// Ordine compatto: Titolo in alto, Categoria e Data sotto, apertura immediata dell'Editor

import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { I18N } from '../../lib/i18n';
import { QuadernoPagina, QuadernoCategoria } from '../../lib/db';
import { saveQuadernoPagina } from '../../lib/admin_actions';

export interface QuadernoFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (pagina: QuadernoPagina) => void;
  onOpenEditor?: (pagina: QuadernoPagina) => void;
  initialPagina?: QuadernoPagina | null;
}

export function QuadernoFormSheet({
  isOpen,
  onClose,
  onSaved,
  onOpenEditor,
  initialPagina,
}: QuadernoFormSheetProps) {
  const [data, setData] = useState('');
  const [titolo, setTitolo] = useState('');
  const [categoria, setCategoria] = useState<QuadernoCategoria>('riunione');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (initialPagina) {
        setData(initialPagina.data || '');
        setTitolo(initialPagina.titolo || '');
        setCategoria(initialPagina.categoria || 'riunione');
      } else {
        const today = new Date().toISOString().slice(0, 10);
        setData(today);
        setTitolo('');
        setCategoria('riunione');
      }
    }
  }, [isOpen, initialPagina]);

  const handleSubmit = async () => {
    const trimmedTitle = titolo.trim();
    if (!trimmedTitle) {
      setErrorMessage('Inserisci un titolo per la pagina del quaderno.');
      return;
    }

    if (!data) {
      setErrorMessage('Seleziona una data valida.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const saved = await saveQuadernoPagina({
        id: initialPagina?.id,
        data,
        titolo: trimmedTitle,
        categoria,
        contenuto: initialPagina?.contenuto || '',
        evento_id: initialPagina?.evento_id || null,
      });

      onSaved(saved);
      onClose();
      if (onOpenEditor) {
        onOpenEditor(saved);
      }
    } catch (err: any) {
      setErrorMessage(err.message || I18N.quaderno.erroreSalvataggio);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const categories: { key: QuadernoCategoria; label: string }[] = [
    { key: 'riunione', label: I18N.quaderno.categorie.riunione },
    { key: 'punto_strada', label: I18N.quaderno.categorie.punto_strada },
    { key: 'verifica', label: I18N.quaderno.categorie.verifica },
    { key: 'libero', label: I18N.quaderno.categorie.libero },
  ];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={initialPagina ? I18N.quaderno.modificaPagina : I18N.quaderno.nuovaPagina}
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {I18N.dialogs.annulla}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSaving}>
            <span>{isSaving ? 'Preparazione in corso…' : I18N.quaderno.continuaNellEditor}</span>
            <Icon name="chevron-right" size={16} />
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
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

        {/* 1. TITOLO DELLA PAGINA (IN ALTO, GRANDE E PRIMO INPUT) */}
        <div>
          <label
            htmlFor="quaderno-form-titolo"
            style={{
              display: 'block',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-ink)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {I18N.quaderno.titolo} *
          </label>
          <input
            id="quaderno-form-titolo"
            type="text"
            className="ios-form-input"
            value={titolo}
            autoFocus
            onInput={(e) => setTitolo((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={I18N.quaderno.titoloPlaceholder}
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 600,
            }}
          />
        </div>

        {/* 2. SOTTO: CATEGORIA E DATA AFFIANCATE IN GRIGLIA COMPATTA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label
              htmlFor="quaderno-form-categoria"
              style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {I18N.quaderno.categoria}
            </label>
            <select
              id="quaderno-form-categoria"
              className="ios-form-input"
              value={categoria}
              onChange={(e) => setCategoria((e.target as HTMLSelectElement).value as QuadernoCategoria)}
              style={{ height: '44px' }}
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="quaderno-form-data"
              style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {I18N.quaderno.data}
            </label>
            <input
              id="quaderno-form-data"
              type="date"
              className="ios-form-input"
              value={data}
              onInput={(e) => setData((e.target as HTMLInputElement).value)}
              style={{ height: '44px' }}
            />
          </div>
        </div>

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-brand-purple-tenue)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-glass-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: 'var(--color-brand-purple-text)',
            fontSize: 'var(--font-size-xs)',
            lineHeight: 1.4,
          }}
        >
          <Icon name="edit" size={18} />
          <span>Al click si aprirà direttamente la schermata grande dell'Editor in stile Documenti Google con toolbar completa, formattazione e immagini.</span>
        </div>
      </form>
    </BottomSheet>
  );
}
