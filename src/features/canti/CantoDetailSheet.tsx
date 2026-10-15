import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { Canto } from '../../lib/db';
import { I18N } from '../../lib/i18n';
import { useAdmin } from '../../lib/auth';
import { calculatePageCount, ChordProRenderer } from '../../lib/chordpro';

export interface CantoDetailSheetProps {
  canto: Canto | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReadingMode: (canto: Canto) => void;
  onEdit?: (canto: Canto) => void;
  onDelete?: (canto: Canto) => void;
}

export function CantoDetailSheet({
  canto,
  isOpen,
  onClose,
  onOpenReadingMode,
  onEdit,
  onDelete,
}: CantoDetailSheetProps) {
  const { isAdmin } = useAdmin();

  if (!isOpen || !canto) return null;

  const isNew = Date.now() - new Date(canto.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
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
            <Badge variant="giallo" size="sm">Nuovo</Badge>
          ) : null}

          {canto.tonalita ? (
            <Badge variant="azzurro" size="sm">
              Tonalità: {canto.tonalita}
            </Badge>
          ) : null}

          {canto.tempo_bpm ? (
            <Badge variant="neutral" size="sm">
              {canto.tempo_bpm} BPM
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
      </div>
    </BottomSheet>
  );
}
