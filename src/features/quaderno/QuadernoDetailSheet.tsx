// src/features/quaderno/QuadernoDetailSheet.tsx
// Foglio di lettura completa per una pagina del Quaderno di Clan con integrazione WhatsApp

import { useState } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { WhatsAppShareModal } from '../calendario/WhatsAppShareModal';
import { QuadernoPagina, getOdgPunti } from '../../lib/db';
import { findNextFutureMeeting } from '../../lib/admin_actions';
import { buildQuadernoWhatsAppMessage } from '../../lib/whatsapp';
import { I18N } from '../../lib/i18n';
import { useAdmin } from '../../lib/auth';
import { QuadernoDocRenderer } from './QuadernoDocRenderer';

export interface QuadernoDetailSheetProps {
  pagina: QuadernoPagina | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (pagina: QuadernoPagina) => void;
  onDelete?: (pagina: QuadernoPagina) => void;
}

export function QuadernoDetailSheet({
  pagina,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: QuadernoDetailSheetProps) {
  const { isAdmin } = useAdmin();
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState('');
  const [isPreparingWhatsApp, setIsPreparingWhatsApp] = useState(false);

  if (!isOpen || !pagina) return null;

  // Formattazione data italiana
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

  const handleOpenWhatsApp = async () => {
    setIsPreparingWhatsApp(true);
    try {
      // Cerca la prossima riunione futura a calendario
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
    onClose();
  };

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={I18N.quaderno.dettaglioTitle}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {isAdmin ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit?.(pagina)}
                >
                  <Icon name="edit" size={15} />
                  <span>{I18N.dialogs.modifica}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  style={{ color: 'var(--color-bans)' }}
                >
                  <Icon name="trash" size={15} />
                  <span>{I18N.dialogs.elimina}</span>
                </Button>
              </div>
            ) : <div />}

            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenWhatsApp}
              disabled={isPreparingWhatsApp}
            >
              <Icon name="share" size={15} />
              <span>{isPreparingWhatsApp ? 'Preparazione…' : I18N.quaderno.condividiWhatsApp}</span>
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Header con Data e Categoria */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textTransform: 'capitalize',
              }}
            >
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

          {/* Titolo Principale */}
          <h2
            style={{
              margin: '0',
              fontSize: 'var(--font-size-xl)',
              fontWeight: 700,
              color: 'var(--color-ink)',
              lineHeight: 1.3,
            }}
          >
            {pagina.titolo}
          </h2>

          {/* Contenuto / Foglio Documento Google */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              minHeight: '180px',
            }}
          >
            <QuadernoDocRenderer content={pagina.contenuto} />
          </div>
        </div>
      </BottomSheet>

      <WhatsAppShareModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        messageText={whatsAppText}
      />
    </>
  );
}
