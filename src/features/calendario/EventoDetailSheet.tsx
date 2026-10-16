// src/features/calendario/EventoDetailSheet.tsx
// Foglio di dettaglio completo di un evento:
// Blocco data stile parete, chip tipo evento, logistica, Galleria Allegati (Fase 5),
// e Sezione Ordine del Giorno (ODG) con permessi differenziati per Admin e Utenti anonimi.

import { useState } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { AttachmentGallery } from '../allegati/AttachmentGallery';
import { AttachmentUploadManager } from '../allegati/AttachmentUploadManager';
import { OdgManager } from './OdgManager';
import { Evento } from '../../lib/db';
import { I18N } from '../../lib/i18n';
import { useAdmin } from '../../lib/auth';
import {
  getWallCalendarDate,
  formatEventDateTimeRange,
  getEventCountdownText,
  getEventTypeInfo,
} from '../../lib/calendario';

export interface EventoDetailSheetProps {
  evento: Evento | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (evento: Evento) => void;
  onDelete?: (evento: Evento) => void;
  onCreateMeeting?: () => void;
  onChanged?: () => void;
}

export function EventoDetailSheet({
  evento,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onCreateMeeting,
  onChanged,
}: EventoDetailSheetProps) {
  const { isAdmin } = useAdmin();
  const [attachmentKey, setAttachmentKey] = useState(0);

  if (!isOpen || !evento) return null;

  const dateBlock = getWallCalendarDate(evento.inizio);
  const countdown = getEventCountdownText(evento);
  const timeRange = formatEventDateTimeRange(evento);
  const typeInfo = getEventTypeInfo(evento.tipo);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={evento.titolo}
      subtitle={timeRange}
      footer={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: 'var(--space-2)',
          }}
        >
          {isAdmin ? (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete?.(evento)}
                aria-label="Elimina evento"
              >
                <Icon name="trash" size={16} />
                <span>{I18N.dialogs.elimina}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit?.(evento)}
                aria-label="Modifica evento"
              >
                <Icon name="edit" size={16} />
                <span>{I18N.dialogs.modifica}</span>
              </Button>
            </div>
          ) : (
            <div />
          )}

          <Button variant="primary" size="sm" onClick={onClose}>
            {I18N.dialogs.chiudi}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Intestazione rapida: Blocco Data da Parete + Chip Tipo + Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            className={`calendar-date-block ${dateBlock.isToday ? 'calendar-date-block-today' : ''}`}
            aria-hidden="true"
          >
            <div className="calendar-date-month">{dateBlock.month}</div>
            <div className="calendar-date-day">{dateBlock.day}</div>
            <div className="calendar-date-weekday">{dateBlock.weekday}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className={typeInfo.chipClass}>{typeInfo.label}</span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: dateBlock.isToday ? 'var(--color-bans)' : 'var(--color-text-secondary)',
                }}
              >
                {countdown}
              </span>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', fontWeight: 500 }}>
              {timeRange}
            </div>
          </div>
        </div>

        {/* Luogo */}
        {evento.luogo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text)',
            }}
          >
            <span style={{ color: 'var(--color-interactive)', marginTop: '2px' }}>
              <Icon name="compass" size={16} />
            </span>
            <div>
              <strong style={{ display: 'block', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {I18N.calendario.luogo}
              </strong>
              {evento.luogo}
            </div>
          </div>
        )}

        {/* Responsabile */}
        {evento.responsabile && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text)',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              <Icon name="search" size={16} />
            </span>
            <div>
              <strong style={{ display: 'block', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {I18N.calendario.responsabile}
              </strong>
              {evento.responsabile}
            </div>
          </div>
        )}

        {/* Cosa Portare */}
        {evento.cosa_portare && (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-giochi-tenue)',
              borderLeft: '4px solid var(--color-giochi)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <strong
              style={{
                display: 'block',
                fontSize: 'var(--font-size-2xs)',
                fontWeight: 700,
                color: 'var(--color-giochi-text)',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}
            >
              {I18N.calendario.cosaPortare}
            </strong>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
              {evento.cosa_portare}
            </span>
          </div>
        )}

        {/* Descrizione / Note */}
        {evento.descrizione && (
          <div>
            <strong
              style={{
                display: 'block',
                fontSize: 'var(--font-size-2xs)',
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}
            >
              {I18N.calendario.descrizione}
            </strong>
            <div
              style={{
                fontSize: 'var(--font-size-sm)',
                lineHeight: 1.5,
                color: 'var(--color-text)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {evento.descrizione}
            </div>
          </div>
        )}

        {/* Ordine del Giorno (ODG) */}
        <OdgManager
          evento={evento}
          isAdmin={isAdmin}
          onCreateMeeting={onCreateMeeting}
          onChanged={onChanged}
        />

        {/* Galleria Allegati (Fase 5) */}
        <div style={{ marginTop: 'var(--space-2)' }}>
          <AttachmentGallery
            key={attachmentKey}
            parentType="evento"
            parentId={evento.id}
            isAdmin={isAdmin}
            onChanged={() => {
              setAttachmentKey((k) => k + 1);
              onChanged?.();
            }}
          />

          {isAdmin && (
            <AttachmentUploadManager
              parent={{ type: 'evento', id: evento.id }}
              onUploaded={() => {
                setAttachmentKey((k) => k + 1);
                onChanged?.();
              }}
            />
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
