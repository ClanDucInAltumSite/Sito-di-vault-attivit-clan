/**
 * src/features/canti/QuickCategoryAssignModal.tsx
 *
 * Modal per l'assegnazione rapida della categoria ai canti privi di categoria (Fase 11F).
 * Permette all'amministratore di categorizzare i canti uno ad uno con un solo clic.
 */

import { useState } from 'preact/hooks';
import { Canto, CategoriaCanto } from '../../lib/db';
import { saveCanto } from '../../lib/admin_actions';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';

export interface QuickCategoryAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  uncategorizedCanti: Canto[];
  onUpdated: () => Promise<void> | void;
}

export function QuickCategoryAssignModal({
  isOpen,
  onClose,
  uncategorizedCanti,
  onUpdated,
}: QuickCategoryAssignModalProps) {
  if (!isOpen) return null;

  const [items, setItems] = useState<Canto[]>(uncategorizedCanti);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAssign = async (canto: Canto, categoria: CategoriaCanto) => {
    setUpdatingId(canto.id);
    setErrorMessage(null);
    try {
      await saveCanto({
        id: canto.id,
        titolo: canto.titolo,
        autore: canto.autore,
        categoria,
        tonalita: canto.tonalita,
        ritmo: canto.ritmo,
        tempo_bpm: canto.tempo_bpm,
        bpm_testo: canto.bpm_testo,
        misura: canto.misura,
        capotasto: canto.capotasto,
        origine: canto.origine,
        nota_fonte: canto.nota_fonte,
        testo_chordpro: canto.testo_chordpro,
      });

      setItems((prev) => prev.filter((item) => item.id !== canto.id));
      await onUpdated();
    } catch (err: any) {
      setErrorMessage(`Errore durante l'assegnazione: ${err.message || 'Errore di rete'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-category-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="ios-card"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        {/* Intestazione */}
        <div
          style={{
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              id="quick-category-title"
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 700,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              Assegnazione Rapida Categorie
            </h2>
            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                margin: 'var(--space-1) 0 0',
              }}
            >
              {items.length === 0
                ? 'Nessun canto senza categoria'
                : `${items.length} ${items.length === 1 ? 'canto rimasto' : 'canti rimasti'} da categorizzare`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi finestra"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              padding: 'var(--space-1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'oklch(0.92 0.08 25)',
              color: 'oklch(0.35 0.15 25)',
              fontSize: 'var(--font-size-xs)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Lista dei canti */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--space-8) var(--space-4)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'oklch(0.92 0.1 145)',
                  color: 'oklch(0.35 0.15 145)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <Icon name="check" size={28} />
              </div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: '0 0 var(--space-1)', color: 'var(--color-ink)' }}>
                Tutti i canti sono stati categorizzati!
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
                Nessun canto è rimasto privo di categoria nel canzoniere.
              </p>
            </div>
          ) : (
            items.map((canto) => {
              const isUpdating = updatingId === canto.id;
              return (
                <div
                  key={canto.id}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                    opacity: isUpdating ? 0.6 : 1,
                    pointerEvents: isUpdating ? 'none' : 'auto',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)' }}>
                        {canto.titolo}
                      </div>
                      {canto.autore && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {canto.autore}
                        </div>
                      )}
                    </div>
                    <Badge variant="giallo" size="sm">
                      Senza categoria
                    </Badge>
                  </div>

                  {/* Pulsanti per scelta immediata */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    <button
                      type="button"
                      className="ios-btn"
                      onClick={() => handleAssign(canto, 'scout')}
                      disabled={isUpdating}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: '0.4rem 0.6rem',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        backgroundColor: 'oklch(0.92 0.06 245)',
                        color: 'oklch(0.28 0.15 245)',
                        border: '1px solid oklch(0.8 0.08 245)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      Canti scout
                    </button>
                    <button
                      type="button"
                      className="ios-btn"
                      onClick={() => handleAssign(canto, 'chiesa')}
                      disabled={isUpdating}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: '0.4rem 0.6rem',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        backgroundColor: 'oklch(0.92 0.06 145)',
                        color: 'oklch(0.28 0.15 145)',
                        border: '1px solid oklch(0.8 0.08 145)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      Canti di chiesa
                    </button>
                    <button
                      type="button"
                      className="ios-btn"
                      onClick={() => handleAssign(canto, 'esterni')}
                      disabled={isUpdating}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: '0.4rem 0.6rem',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      Canti esterni
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chiusura */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <Button variant="secondary" size="sm" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
}
