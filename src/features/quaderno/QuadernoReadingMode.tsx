// src/features/quaderno/QuadernoReadingMode.tsx
// Visualizzazione a schermo intero stile Documenti Google per le note del Quaderno di Clan
// Permette la lettura comoda, condivisione WhatsApp, modifica rapida (se admin) e supporto al tasto indietro

import { useState, useEffect } from 'preact/hooks';
import { QuadernoPagina, getOdgPunti } from '../../lib/db';
import { findNextFutureMeeting } from '../../lib/admin_actions';
import { buildQuadernoWhatsAppMessage } from '../../lib/whatsapp';
import { I18N } from '../../lib/i18n';
import { useAdmin } from '../../lib/auth';
import { Icon } from '../../ui/Icon';
import { QuadernoDocRenderer } from './QuadernoDocRenderer';
import { WhatsAppShareModal } from '../calendario/WhatsAppShareModal';

export interface QuadernoReadingModeProps {
  pagina: QuadernoPagina | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (pagina: QuadernoPagina) => void;
  onDelete?: (pagina: QuadernoPagina) => void;
}

export function QuadernoReadingMode({
  pagina,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: QuadernoReadingModeProps) {
  const { isAdmin } = useAdmin();
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState('');
  const [isPreparingWhatsApp, setIsPreparingWhatsApp] = useState(false);

  // Gestione tasto indietro fisico Android / gesture del browser (popstate)
  useEffect(() => {
    if (!isOpen || !pagina) return;

    window.history.pushState({ quadernoReadingOpen: true, paginaId: pagina.id }, '');

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.quadernoReadingOpen) {
        window.history.replaceState(null, '');
      }
    };
  }, [isOpen, pagina?.id, onClose]);

  // Gestione blocco scroll del body ed Escape
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

  const handleClose = () => {
    if (window.history.state?.quadernoReadingOpen) {
      window.history.back();
    } else {
      onClose();
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!pagina) return;
    setIsPreparingWhatsApp(true);
    try {
      const meetingTime = `${pagina.data}T23:59:59.000Z`;
      const nextMeeting = await findNextFutureMeeting(meetingTime);
      let nextOdgPunti: any[] = [];
      if (nextMeeting?.id) {
        nextOdgPunti = await getOdgPunti(nextMeeting.id);
      }

      const text = buildQuadernoWhatsAppMessage({
        pagina,
        nextMeeting,
        nextOdgPunti,
      });

      setWhatsAppText(text);
      setIsWhatsAppOpen(true);
    } catch (err) {
      console.error('Errore preparazione WhatsApp da quaderno:', err);
    } finally {
      setIsPreparingWhatsApp(false);
    }
  };

  const handleDelete = () => {
    if (!pagina) return;
    onDelete?.(pagina);
  };

  if (!isOpen || !pagina) return null;

  // Formattazione data italiana completa (es. lunedì 3 novembre 2026)
  const dateParts = (pagina.data || '').split('-');
  let formattedDate = pagina.data;
  if (dateParts.length === 3) {
    const d = new Date(Date.UTC(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])));
    if (!isNaN(d.getTime())) {
      formattedDate = d.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }
  }

  const categoryLabel = I18N.quaderno.categorie[pagina.categoria] || I18N.quaderno.categorie.libero;

  return (
    <>
      <div
        className="doc-editor-container"
        role="dialog"
        aria-modal="true"
        aria-label={`Documento: ${pagina.titolo}`}
      >
        {/* TOP BAR APPLE ELEGANTE DELLA MODALITÀ LETTURA */}
        <header className="doc-editor-topbar">
          <div className="doc-topbar-left">
            <button
              type="button"
              className="doc-icon-btn"
              onClick={handleClose}
              title={I18N.quaderno.editor.chiudi}
              aria-label={I18N.quaderno.editor.chiudi}
            >
              <Icon name="chevron-left" size={22} />
            </button>

            <div className="doc-topbar-info">
              <span className="doc-topbar-title">{pagina.titolo}</span>
              <div className="doc-topbar-meta">
                <span className="doc-status-badge doc-status-saved">
                  <Icon name="book-open" size={13} />
                  <span>{I18N.quaderno.title}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="doc-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* Condividi su WhatsApp */}
            <button
              type="button"
              className="ios-btn ios-btn-secondary ios-btn-sm"
              onClick={handleOpenWhatsApp}
              disabled={isPreparingWhatsApp}
              title={I18N.quaderno.condividiWhatsApp}
            >
              <Icon name="share" size={15} />
              <span className="doc-topbar-btn-text">
                {isPreparingWhatsApp ? 'Preparazione…' : 'Condividi'}
              </span>
            </button>

            {/* Pulsanti Admin: Modifica ed Elimina */}
            {isAdmin && (
              <>
                <button
                  type="button"
                  className="ios-btn ios-btn-primary ios-btn-sm"
                  onClick={() => onEdit?.(pagina)}
                  title={I18N.dialogs.modifica}
                >
                  <Icon name="edit" size={15} />
                  <span className="doc-topbar-btn-text">{I18N.dialogs.modifica}</span>
                </button>

                <button
                  type="button"
                  className="ios-btn ios-btn-danger ios-btn-sm"
                  onClick={handleDelete}
                  title={I18N.dialogs.elimina}
                  aria-label={I18N.dialogs.elimina}
                >
                  <Icon name="trash" size={15} />
                  <span className="doc-topbar-btn-text">{I18N.dialogs.elimina}</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* WORKSPACE FOGLIO CENTRATO IN SOLA LETTURA */}
        <main className="doc-sheet-viewport">
          <div className="doc-sheet doc-reading-sheet">
            {/* Header del documento: Titolo, Categoria e Data */}
            <div className="doc-reading-header">
              <h1 className="doc-reading-title">
                {pagina.titolo}
              </h1>

              <div className="doc-reading-meta">
                <span className="doc-reading-date">
                  {formattedDate}
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
                      pagina.categoria === 'riunione'
                        ? 'var(--color-brand-purple-tenue)'
                        : pagina.categoria === 'punto_strada'
                        ? 'var(--color-canti-tenue)'
                        : pagina.categoria === 'verifica'
                        ? 'var(--color-uscita-tenue)'
                        : 'var(--color-giochi-tenue)',
                    color:
                      pagina.categoria === 'riunione'
                        ? 'var(--color-brand-purple-text)'
                        : pagina.categoria === 'punto_strada'
                        ? 'var(--color-canti-text)'
                        : pagina.categoria === 'verifica'
                        ? 'var(--color-uscita-text)'
                        : 'var(--color-giochi-badge-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {categoryLabel}
                </span>
              </div>
            </div>

            <hr className="doc-sheet-divider" />

            {/* CONTENUTO RENDERIZZATO SICURO (ZERO INJECTION XSS) */}
            <div className="doc-reading-content doc-rendered">
              {pagina.contenuto && pagina.contenuto.trim() ? (
                <QuadernoDocRenderer content={pagina.contenuto} />
              ) : (
                <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                  {I18N.quaderno.emptyContent}
                </p>
              )}
            </div>
          </div>
        </main>
      </div>

      <WhatsAppShareModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        messageText={whatsAppText}
      />
    </>
  );
}
