import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import {
  Proposta,
  getProposteAdmin,
  approvaPropostaAdmin,
} from '../../lib/proposte';
import { RifiutaPropostaModal } from './RifiutaPropostaModal';

export interface ProposteReviewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsChanged?: () => void;
}

export function ProposteReviewSheet({
  isOpen,
  onClose,
  onItemsChanged,
}: ProposteReviewSheetProps) {
  const [proposte, setProposte] = useState<Proposta[]>([]);
  const [filter, setFilter] = useState<'tutte' | 'canti' | 'giochi' | 'bans' | 'canovacci'>('tutte');
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectingProposta, setRejectingProposta] = useState<Proposta | null>(null);

  const loadProposte = async () => {
    setIsLoading(true);
    try {
      const list = await getProposteAdmin();
      setProposte(list);
    } catch (err) {
      console.error('Errore caricamento proposte admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProposte();
      setMessage(null);
    }
  }, [isOpen]);

  const handleApprova = async (proposta: Proposta) => {
    setActionLoadingId(proposta.id);
    try {
      await approvaPropostaAdmin(proposta);
      setMessage(`Proposta "${proposta.titolo}" approvata e pubblicata con successo!`);
      await loadProposte();
      onItemsChanged?.();
    } catch (err: any) {
      console.error('Errore approvazione:', err);
      setMessage(`Errore durante l'approvazione: ${err.message || 'Riprova'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRifiuta = (proposta: Proposta) => {
    setRejectingProposta(proposta);
  };

  const filteredProposte = proposte.filter((p) => {
    if (filter === 'tutte') return true;
    return p.tabella === filter;
  });

  const getSectionBadge = (tabella: string) => {
    switch (tabella) {
      case 'canti':
        return <Badge variant="azzurro" size="sm">Canto</Badge>;
      case 'giochi':
        return <Badge variant="giallo" size="sm">Gioco</Badge>;
      case 'bans':
        return <Badge variant="rosso" size="sm">Ban</Badge>;
      case 'canovacci':
        return <Badge variant="azzurro" size="sm">Canovaccio</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{tabella}</Badge>;
    }
  };

  const renderContentPreview = (p: Proposta) => {
    const d = p.dati as any;
    if (!d) return null;

    if (p.tabella === 'canti') {
      return (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          {d.autore && <span>Autore: {d.autore} • </span>}
          {d.tonalita && <span>Tonalita: {d.tonalita} • </span>}
          <div style={{ marginTop: '4px', fontStyle: 'italic', maxHeight: '48px', overflow: 'hidden' }}>
            {d.testo ? d.testo.slice(0, 150) + '...' : 'Nessun testo'}
          </div>
        </div>
      );
    }

    if (p.tabella === 'giochi') {
      return (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          {d.tipo && <span>Tipo: {d.tipo} • </span>}
          {d.luogo && <span>Luogo: {d.luogo} • </span>}
          {d.durataMinuti && <span>Durata: {d.durataMinuti} min • </span>}
          <div style={{ marginTop: '4px', maxHeight: '48px', overflow: 'hidden' }}>
            {d.descrizione ? d.descrizione.slice(0, 150) + '...' : 'Nessuna descrizione'}
          </div>
        </div>
      );
    }

    if (p.tabella === 'bans') {
      return (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          <div style={{ marginTop: '4px', maxHeight: '48px', overflow: 'hidden' }}>
            {d.descrizione ? d.descrizione.slice(0, 150) + '...' : 'Nessuna descrizione'}
          </div>
        </div>
      );
    }

    if (p.tabella === 'canovacci') {
      return (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          {d.pdfNome && <span>Allegato PDF: {d.pdfNome} • </span>}
          <div style={{ marginTop: '4px', maxHeight: '48px', overflow: 'hidden' }}>
            {d.descrizioneBreve || (d.contenuto ? d.contenuto.slice(0, 150) + '...' : 'Traccia canovaccio')}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Revisione Proposte Clan"
      subtitle="Valida e pubblica nel Vault le proposte inviate da utenti non admin"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {message && (
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
            {message}
          </div>
        )}

        {/* Filtri per sezione */}
        <div style={{ display: 'flex', gap: 'var(--space-1)', overflowX: 'auto', paddingBottom: '4px' }}>
          {(['tutte', 'canti', 'giochi', 'bans', 'canovacci'] as const).map((tab) => {
            const count = tab === 'tutte' ? proposte.length : proposte.filter((p) => p.tabella === tab).length;
            const active = filter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: active ? '1px solid var(--color-interactive)' : '1px solid var(--color-border)',
                  backgroundColor: active ? 'var(--color-interactive)' : 'var(--color-surface)',
                  color: active ? '#ffffff' : 'var(--color-text)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ textTransform: 'capitalize' }}>{tab}</span>
                <span style={{ opacity: 0.75 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Elenco proposte */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-secondary)' }}>
            Caricamento proposte...
          </div>
        ) : filteredProposte.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-2)' }}>
            <Icon name="check" size={32} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }} />
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text)' }}>
              Nessuna proposta in attesa
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 0' }}>
              I membri del clan possono proporre canti, giochi, bans e canovacci senza autenticazione admin. Le nuove proposte appariranno qui per l'approvazione.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {filteredProposte.map((p) => {
              const isActionLoading = actionLoadingId === p.id;
              const formattedDate = new Date(p.created_at).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getSectionBadge(p.tabella)}
                        <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                          {formattedDate}
                        </span>
                      </div>
                      <h4 style={{ margin: '4px 0 0', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-ink)' }}>
                        {p.titolo}
                      </h4>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-interactive)', fontWeight: 500 }}>
                        Proposto da: {p.proponente_nome || 'Membro del Clan'}
                      </span>
                    </div>
                  </div>

                  {renderContentPreview(p)}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 'var(--space-2)',
                      paddingTop: 'var(--space-2)',
                      borderTop: '0.5px solid var(--color-border-subtle)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRifiuta(p)}
                      disabled={isActionLoading}
                      style={{ color: 'var(--color-bans)' }}
                    >
                      <Icon name="close" size={14} />
                      <span>Rifiuta</span>
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprova(p)}
                      isLoading={isActionLoading}
                    >
                      <Icon name="check" size={14} />
                      <span>Approva e Pubblica</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>

    <RifiutaPropostaModal
      proposta={rejectingProposta}
      isOpen={Boolean(rejectingProposta)}
      onClose={() => setRejectingProposta(null)}
      onSuccess={() => {
        setMessage(`Proposta "${rejectingProposta?.titolo}" rifiutata con successo.`);
        setRejectingProposta(null);
        loadProposte();
        onItemsChanged?.();
      }}
    />
    </>
  );
}
