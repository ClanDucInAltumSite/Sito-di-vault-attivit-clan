import { useState } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { Canto } from '../../lib/db';
import { I18N } from '../../lib/i18n';
import { useAdmin } from '../../lib/auth';
import { calculatePageCount, ChordProRenderer } from '../../lib/chordpro';
import { AttachmentGallery } from '../allegati/AttachmentGallery';
import { AttachmentUploadManager } from '../allegati/AttachmentUploadManager';

export interface CantoDetailSheetProps {
  canto: Canto | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReadingMode: (canto: Canto) => void;
  onEdit?: (canto: Canto) => void;
  onDelete?: (canto: Canto) => void;
  onUpdated?: () => void;
  isNew?: boolean;
}

export function CantoDetailSheet({
  canto,
  isOpen,
  onClose,
  onOpenReadingMode,
  onEdit,
  onDelete,
  onUpdated,
  isNew = false,
}: CantoDetailSheetProps) {
  const { isAdmin } = useAdmin();
  const [attachmentKey, setAttachmentKey] = useState(0);

  if (!isOpen || !canto) return null;

  const pageCount = calculatePageCount(canto.testo_chordpro);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={canto.titolo}
      subtitle={canto.autore ? `Autore: ${canto.autore}` : undefined}
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
                onClick={() => onDelete?.(canto)}
                aria-label="Elimina canto"
              >
                <Icon name="trash" size={16} />
                <span>{I18N.dialogs.elimina}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit?.(canto)}
                aria-label="Modifica canto"
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
        {/* Chips informativa metadati musicali */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {isNew ? (
            <Badge variant="nuovo" size="sm">Nuovo</Badge>
          ) : null}

          {canto.categoria === 'scout' && (
            <Badge variant="azzurro" size="sm">Scout</Badge>
          )}
          {canto.categoria === 'chiesa' && (
            <Badge variant="giallo" size="sm">Chiesa</Badge>
          )}
          {canto.categoria === 'esterni' && (
            <Badge variant="rosso" size="sm">Esterni</Badge>
          )}

          {(canto.bpm_testo || canto.tempo_bpm) ? (
            <Badge variant="neutral" size="sm">
              {canto.bpm_testo ? `${canto.bpm_testo} BPM` : `${canto.tempo_bpm} BPM`}
            </Badge>
          ) : null}

          {canto.misura ? (
            <Badge variant="neutral" size="sm">
              {canto.misura}
            </Badge>
          ) : null}

          {canto.ritmo ? (
            <Badge variant="neutral" size="sm">
              {canto.ritmo}
            </Badge>
          ) : null}

          {canto.capotasto ? (
            <Badge variant="giallo" size="sm">
              Capo {canto.capotasto}°
            </Badge>
          ) : null}

          <Badge variant="neutral" size="sm">
            {pageCount === 1 ? '1 pag. stampa' : `${pageCount} pag. stampa`}
          </Badge>
        </div>

        {/* Pulsante In Evidenza: Modalità Lettura a Tutto Schermo */}
        <div>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => onOpenReadingMode(canto)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <Icon name="eye" size={20} />
            <span>{I18N.bans.modalitaLettura} (Accordi & Wake Lock)</span>
          </Button>
        </div>

        {/* Anteprima del testo con accordi */}
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-4)',
            overflowX: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--color-text-secondary)',
              letterSpacing: '0.04em',
              marginBottom: 'var(--space-3)',
            }}
          >
            {I18N.canti.testoChordpro}
          </div>

          <ChordProRenderer
            chordproText={canto.testo_chordpro}
            showChords={true}
            fontSizeRem={0.95}
          />
        </div>

        {/* Galleria Allegati (Fase 5) */}
        <AttachmentGallery
          key={attachmentKey}
          parentType="canto"
          parentId={canto.id}
          isAdmin={isAdmin}
          onChanged={() => {
            setAttachmentKey((k) => k + 1);
            onUpdated?.();
          }}
        />

        {isAdmin && (
          <AttachmentUploadManager
            parent={{ type: 'canto', id: canto.id }}
            onUploaded={() => {
              setAttachmentKey((k) => k + 1);
              onUpdated?.();
            }}
          />
        )}
      </div>
    </BottomSheet>
  );
}
