import { useState, useEffect } from 'preact/hooks';
import { Icon } from './Icon';
import { Button } from './Button';

export function PwaInstallGuide() {
  const [isDismissed, setIsDismissed] = useState(true);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Se l'app è già avviata in modalità standalone (installata come PWA), non mostrare la guida
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    const dismissed = localStorage.getItem('vault_pwa_guide_dismissed') === 'true';
    if (!dismissed) {
      setIsDismissed(false);
      const userAgent = window.navigator.userAgent || '';
      const isAppleDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
      setIsIos(isAppleDevice);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('vault_pwa_guide_dismissed', 'true');
    } catch {
      // Ignora errori localStorage
    }
  };

  if (isDismissed) return null;

  return (
    <div
      className="ios-grouped-card"
      style={{
        margin: 'var(--space-4) 0',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        position: 'relative',
      }}
      role="region"
      aria-label="Guida installazione applicazione"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <div
          style={{
            backgroundColor: 'var(--color-interactive-tenue)',
            color: 'var(--color-interactive)',
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="share" size={24} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 600,
              color: 'var(--color-text)',
              margin: '0 0 var(--space-1)',
            }}
          >
            Installa il Vault sul telefono
          </h2>
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.4,
              margin: '0 0 var(--space-3)',
            }}
          >
            {isIos
              ? "Per usarlo all'aperto e senza rete: tocca il tasto Condividi in Safari (in basso) e scegli 'Aggiungi alla schermata Home'."
              : "Per usarlo all'aperto senza rete: apri il menu del browser (in alto a destra) e seleziona 'Installa applicazione' o 'Aggiungi a Home'."}
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Ho capito
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
