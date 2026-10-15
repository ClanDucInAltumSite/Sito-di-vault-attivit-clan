// src/features/calendario/OdgManager.tsx
// Gestore dell'Ordine del Giorno (ODG) con permessi rigorosi:
// Spunta animata, riordino su/giù e aggiunta RISERVATI AGLI AMMINISTRATORI.
// Gli utenti anonimi possono solo consultare in sola lettura con checkbox disabilitate.

import { useState, useEffect } from 'preact/hooks';
import { OdgPunto, Evento, getOdgPunti } from '../../lib/db';
import {
  saveOdgPunto,
  toggleOdgPunto,
  reorderOdgPunti,
  softDeleteRecord,
  findNextFutureMeeting,
  forwardUnfinishedOdgPunti,
} from '../../lib/admin_actions';
import { countOpenOdgPoints } from '../../lib/calendario';
import { I18N } from '../../lib/i18n';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/Button';

export interface OdgManagerProps {
  evento: Evento;
  isAdmin: boolean;
  onChanged?: () => void;
}

export function OdgManager({ evento, isAdmin, onChanged }: OdgManagerProps) {
  const [punti, setPunti] = useState<OdgPunto[]>([]);
  const [newPointText, setNewPointText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadPoints = async () => {
    try {
      const items = await getOdgPunti(evento.id, false);
      setPunti(items);
    } catch (err) {
      console.error('Errore caricamento ODG:', err);
    }
  };

  useEffect(() => {
    loadPoints();
  }, [evento.id]);

  const openCount = countOpenOdgPoints(punti);

  // Toggle completamento (Admin only)
  const handleToggle = async (point: OdgPunto) => {
    if (!isAdmin) return;
    try {
      const newStatus = !point.completato;
      // Aggiornamento ottimistico locale
      setPunti((prev) =>
        prev.map((p) => (p.id === point.id ? { ...p, completato: newStatus } : p))
      );
      await toggleOdgPunto(point.id, newStatus);
      onChanged?.();
    } catch (err: any) {
      setMessage({ text: err.message || 'Errore durante l\'aggiornamento', type: 'error' });
      loadPoints();
    }
  };

  // Aggiunta nuovo punto (Admin only)
  const handleAddPoint = async (e: Event) => {
    e.preventDefault();
    if (!isAdmin || !newPointText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);
    try {
      await saveOdgPunto({
        evento_id: evento.id,
        testo: newPointText.trim(),
      });
      setNewPointText('');
      await loadPoints();
      onChanged?.();
    } catch (err: any) {
      setMessage({ text: err.message || 'Errore salvataggio punto ODG', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Spostamento su / giù (Admin only)
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!isAdmin) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= punti.length) return;

    const reordered = [...punti];
    const temp = reordered[index]!;
    reordered[index] = reordered[targetIndex]!;
    reordered[targetIndex] = temp;

    setPunti(reordered);

    try {
      await reorderOdgPunti(evento.id, reordered.map((p) => p.id));
      onChanged?.();
    } catch (err: any) {
      setMessage({ text: err.message || 'Errore riordino punti', type: 'error' });
      loadPoints();
    }
  };

  // Eliminazione punto (Admin only)
  const handleDeletePoint = async (point: OdgPunto) => {
    if (!isAdmin) return;
    try {
      await softDeleteRecord('odg_punti', point.id);
      await loadPoints();
      onChanged?.();
    } catch (err: any) {
      setMessage({ text: err.message || 'Errore eliminazione punto', type: 'error' });
    }
  };

  // Riporto punti non conclusi alla prossima riunione (Admin only)
  const handleForwardPoints = async () => {
    if (!isAdmin || isForwarding) return;
    if (openCount === 0) {
      setMessage({ text: I18N.calendario.nessunPuntoDaRiportare, type: 'error' });
      return;
    }

    setIsForwarding(true);
    setMessage(null);

    try {
      const nextMeeting = await findNextFutureMeeting(evento.inizio);
      if (!nextMeeting) {
        setMessage({
          text: I18N.calendario.nessunaRiunioneFutura,
          type: 'error',
        });
        setIsForwarding(false);
        return;
      }

      const confirmed = window.confirm(
        I18N.calendario.confermaRiporto(openCount, nextMeeting.titolo)
      );

      if (!confirmed) {
        setIsForwarding(false);
        return;
      }

      const count = await forwardUnfinishedOdgPunti(evento.id, nextMeeting.id);
      setMessage({
        text: I18N.calendario.puntiRiportatiSuccess(count),
        type: 'success',
      });
      onChanged?.();
    } catch (err: any) {
      setMessage({ text: err.message || 'Errore durante il riporto dei punti', type: 'error' });
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <section className="odg-section" aria-labelledby="odg-heading">
      <div className="odg-header">
        <div className="odg-title-badge-wrap">
          <h3 id="odg-heading" style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-ink)' }}>
            {I18N.calendario.odgTitle}
          </h3>
          {openCount > 0 ? (
            <span className="odg-open-badge" title={`${openCount} punti da completare`}>
              {openCount} {openCount === 1 ? 'aperto' : 'aperti'}
            </span>
          ) : punti.length > 0 ? (
            <span
              style={{
                fontSize: 'var(--font-size-2xs)',
                fontWeight: 600,
                color: 'var(--color-canti)',
                backgroundColor: 'var(--color-canti-tenue)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              Completato
            </span>
          ) : null}
        </div>

        {/* Solo Admin: pulsante riporto punti se ci sono punti aperti */}
        {isAdmin && openCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForwardPoints}
            disabled={isForwarding}
            style={{ fontSize: 'var(--font-size-xs)' }}
          >
            <Icon name="chevron-right" size={14} />
            <span>Riporta alla prossima</span>
          </Button>
        )}
      </div>

      {message && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            backgroundColor:
              message.type === 'success' ? 'var(--color-giochi-tenue)' : 'var(--color-bans-tenue)',
            color:
              message.type === 'success' ? 'var(--color-giochi-text)' : 'var(--color-bans-text)',
            borderLeft: `3px solid ${message.type === 'success' ? 'var(--color-giochi)' : 'var(--color-bans)'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Lista Punti */}
      {punti.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {I18N.calendario.odgEmpty}
        </p>
      ) : (
        <div className="odg-list" role="list">
          {punti.map((point, index) => (
            <div
              key={point.id}
              className={`odg-item ${point.completato ? 'odg-item-completed' : ''}`}
              role="listitem"
            >
              <div className="odg-item-left">
                {/* Spunta animata con permessi rigorosi: disabilitata per visitatori anonimi */}
                <button
                  type="button"
                  className={`odg-check-btn ${point.completato ? 'odg-check-btn-checked' : ''}`}
                  onClick={() => handleToggle(point)}
                  disabled={!isAdmin}
                  aria-checked={point.completato}
                  role="checkbox"
                  aria-label={
                    isAdmin
                      ? `Contrassegna punto "${point.testo}" come ${point.completato ? 'non completato' : 'completato'}`
                      : `${point.testo} (${point.completato ? 'Completato' : 'In attesa'} - Solo lettura)`
                  }
                  title={!isAdmin ? I18N.calendario.soloAdminSpunta : undefined}
                >
                  {point.completato && (
                    <svg className="odg-check-svg" viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                <div className="odg-content">
                  <span className={`odg-text ${point.completato ? 'odg-text-completed' : ''}`}>
                    {point.testo}
                  </span>
                  {point.riportato_da && (
                    <span className="odg-reported-pill" title="Punto riportato da una riunione precedente">
                      <Icon name="refresh" size={10} />
                      <span>Riportato da riunione precedente</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Azioni Admin: Riordino su/giù ed eliminazione */}
              {isAdmin && (
                <div className="odg-item-actions">
                  <button
                    type="button"
                    className="odg-icon-btn"
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    aria-label="Sposta su"
                    title="Sposta su"
                  >
                    <Icon name="chevron-up" size={14} />
                  </button>
                  <button
                    type="button"
                    className="odg-icon-btn"
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === punti.length - 1}
                    aria-label="Sposta giù"
                    title="Sposta giù"
                  >
                    <Icon name="chevron-down" size={14} />
                  </button>
                  <button
                    type="button"
                    className="odg-icon-btn odg-icon-btn-danger"
                    onClick={() => handleDeletePoint(point)}
                    aria-label="Elimina punto ODG"
                    title="Elimina punto ODG"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Aggiunta Punto (Admin only) */}
      {isAdmin && (
        <form onSubmit={handleAddPoint} style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <input
            type="text"
            className="ios-search-container"
            style={{ flex: 1, height: '36px', fontSize: 'var(--font-size-sm)' }}
            placeholder={I18N.calendario.nuovoPuntoOdg}
            value={newPointText}
            onInput={(e) => setNewPointText((e.target as HTMLInputElement).value)}
            disabled={isSubmitting}
            aria-label={I18N.calendario.nuovoPuntoOdg}
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={!newPointText.trim() || isSubmitting}
            isLoading={isSubmitting}
          >
            Aggiungi
          </Button>
        </form>
      )}
    </section>
  );
}
