import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import {
  BlockedIpRecord,
  getBlockedIps,
  unblockIp,
} from '../../lib/proposte';

export interface BlockedIpsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsChanged?: () => void;
}

export function BlockedIpsSheet({
  isOpen,
  onClose,
  onItemsChanged,
}: BlockedIpsSheetProps) {
  const [blockedList, setBlockedList] = useState<BlockedIpRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionIp, setActionIp] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await getBlockedIps();
      setBlockedList(list);
    } catch (err) {
      console.error('Errore caricamento IP bloccati:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setFeedback(null);
    }
  }, [isOpen]);

  const handleUnblock = async (ip: string) => {
    setActionIp(ip);
    try {
      await unblockIp(ip);
      setFeedback(`Indirizzo IP ${ip} sbloccato e riabilitato con successo.`);
      await loadData();
      onItemsChanged?.();
    } catch (err: any) {
      console.error('Errore sblocco IP:', err);
      setFeedback(`Errore nello sblocco: ${err.message || 'Riprova'}`);
    } finally {
      setActionIp(null);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Sicurezza & IP Bloccati"
      subtitle="Sistema Anti-Flood automatico: soglia di sicurezza 20 richieste in 2 secondi"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {feedback && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-interactive)',
            }}
          >
            {feedback}
          </div>
        )}

        {/* Banner informativo circuito breaker */}
        <div
          style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="admin" size={18} style={{ color: 'var(--color-interactive)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
              Protezione Anti-Flood Circuit Breaker
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
            Qualsiasi client che invia piu di 20 richieste entro una finestra temporale di 2 secondi viene bloccato istantaneamente a livello database e locale. La riabilitazione e consentita esclusivamente agli Admin da questo pannello.
          </p>
        </div>

        {/* Elenco indirizzi bloccati */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-secondary)' }}>
            Verifica registro di sicurezza...
          </div>
        ) : blockedList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-2)' }}>
            <Icon name="check" size={32} style={{ color: 'var(--color-interactive)', marginBottom: 'var(--space-2)' }} />
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text)' }}>
              Nessun IP attualmente bloccato
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 0' }}>
              Il sistema di protezione Anti-Flood e attivo e vigile. Nessun tentativo anomalo di flood o sovraccarico rilevato.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              Indirizzi IP bloccati ({blockedList.length})
            </div>

            {blockedList.map((record) => {
              const isActionLoading = actionIp === record.ip;
              const formattedDate = new Date(record.blocked_at).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={record.ip}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-bans)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Badge variant="rosso" size="sm">Bloccato</Badge>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-ink)', fontFamily: 'monospace' }}>
                        {record.ip}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Motivo: {record.reason}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                      Bloccato il {formattedDate}
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUnblock(record.ip)}
                    isLoading={isActionLoading}
                  >
                    <Icon name="check" size={14} />
                    <span>Sblocca IP</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
