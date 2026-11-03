// src/features/calendario/WhatsAppShareModal.tsx
// Modale Apple-style di anteprima e invio del messaggio WhatsApp per le riunioni del Clan.

import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { I18N } from '../../lib/i18n';
import { openWhatsApp } from '../../lib/whatsapp';

export interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageText: string;
  onCopied?: () => void;
}

export function WhatsAppShareModal({
  isOpen,
  onClose,
  messageText,
  onCopied,
}: WhatsAppShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(messageText);
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = messageText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Errore durante la copia:', err);
    }
  };

  const handleOpenWhatsApp = () => {
    openWhatsApp(messageText);
  };

  return (
    <div style={{ position: 'relative', zIndex: 1200 }}>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={I18N.calendario.anteprimaWhatsApp}
        subtitle="Verifica il testo prima dell'invio o della copia"
        footer={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              aria-label={I18N.calendario.copiaTesto}
            >
              <Icon name="file-text" size={16} />
              <span>{copied ? I18N.calendario.testoCopiato : I18N.calendario.copiaTesto}</span>
            </Button>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                {I18N.dialogs.chiudi}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenWhatsApp}
                aria-label={I18N.calendario.inviaWhatsApp}
              >
                <Icon name="share" size={16} />
                <span>{I18N.calendario.inviaWhatsApp}</span>
              </Button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {copied && (
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-interactive)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-interactive)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Icon name="check" size={16} />
              <span>{I18N.calendario.testoCopiato}</span>
            </div>
          )}

          <div
            style={{
              maxHeight: '45vh',
              overflowY: 'auto',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontFamily: 'inherit',
              fontSize: 'var(--font-size-sm)',
              lineHeight: 1.6,
              color: 'var(--color-text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {messageText}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
