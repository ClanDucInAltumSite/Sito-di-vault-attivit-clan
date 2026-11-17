import { useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import {
  PropostaItem,
  rifiutaPropostaAdmin,
  bloccaProponente,
} from '../../lib/proposte';

export interface RifiutaPropostaModalProps {
  proposta: PropostaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_MOTIVI = [
  'Non idoneo o duplicato',
  'Incompleto o poco chiaro',
  'Proposta non seria / spam',
];

export function RifiutaPropostaModal({
  proposta,
  isOpen,
  onClose,
  onSuccess,
}: RifiutaPropostaModalProps) {
  const [motivo, setMotivo] = useState('Non idoneo o duplicato');
  const [bloccaUtente, setBloccaUtente] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !proposta) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      // 1. Rifiuta la proposta
      await rifiutaPropostaAdmin(proposta.id, motivo.trim() || undefined);

      // 2. Se richiesto, blocca l'utente/dispositivo
      if (bloccaUtente) {
        await bloccaProponente(proposta, motivo.trim());
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Errore durante il rifiuto/blocco:', err);
      setErrorMessage(err.message || 'Errore durante l\'operazione');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rifiuta Proposta"
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annulla
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            style={{ backgroundColor: 'var(--color-bans)' }}
          >
            <Icon name="close" size={14} />
            <span>{bloccaUtente ? 'Rifiuta e Blocca Utente' : 'Conferma Rifiuto'}</span>
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Intestazione elemento */}
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Badge variant="giallo" size="sm">
              {proposta.tabella}
            </Badge>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Proposto da: <strong>{proposta.proponente_nome || 'Membro del Clan'}</strong>
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-ink)' }}>
            {proposta.titolo}
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bans-tenue)',
              color: 'var(--color-bans)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Motivo Rifiuto */}
        <div className="ios-form-group">
          <label className="ios-form-label" htmlFor="motivo-rifiuto-input">
            Motivo del rifiuto
          </label>

          {/* Preset rapidi */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-2)' }}>
            {PRESET_MOTIVI.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMotivo(p)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-full)',
                  border: motivo === p ? '1px solid var(--color-bans)' : '1px solid var(--color-border)',
                  backgroundColor: motivo === p ? 'var(--color-bans-tenue)' : 'var(--color-surface)',
                  color: motivo === p ? 'var(--color-bans)' : 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: motivo === p ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <input
            id="motivo-rifiuto-input"
            type="text"
            className="ios-form-input"
            value={motivo}
            onInput={(e) => setMotivo((e.target as HTMLInputElement).value)}
            placeholder="Specifica un motivo..."
          />
        </div>

        {/* Opzione per bloccare il mittente (se pubblica proposte non serie o spam) */}
        <div
          onClick={() => setBloccaUtente(!bloccaUtente)}
          style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: bloccaUtente ? '1.5px solid var(--color-bans)' : '1px solid var(--color-border)',
            backgroundColor: bloccaUtente ? 'var(--color-bans-tenue)' : 'var(--color-surface)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            transition: 'all 0.15s ease',
          }}
        >
          <input
            type="checkbox"
            checked={bloccaUtente}
            onChange={(e) => setBloccaUtente((e.target as HTMLInputElement).checked)}
            style={{ marginTop: '2px', cursor: 'pointer' }}
            id="blocca-utente-chk"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label
              htmlFor="blocca-utente-chk"
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                color: bloccaUtente ? 'var(--color-bans)' : 'var(--color-ink)',
                cursor: 'pointer',
              }}
            >
              Blocca questo utente dall'inviare ulteriori proposte
            </label>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              Inserisce il dispositivo e l'indirizzo in blacklist. Utile per chi pubblica proposte non serie, scherzi o spam. Potrai sempre riabilitarlo dalla sezione "Sicurezza &amp; IP Bloccati" dell'Admin.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
