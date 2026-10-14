import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';

export function StampaView() {
  const [selectedCount] = useState(2);

  return (
    <div className="container">
      {/* Intestazione Sezione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {I18N.stampa.title}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}>
            Componi e stampa fascicoli A4 per uscite, bivacchi e riunioni
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => window.print()}
          disabled={selectedCount === 0}
        >
          <Icon name="stampa" size={18} />
          <span>{I18N.stampa.stampaOra}</span>
        </Button>
      </div>

      {/* Lista Documenti Pronti per la Stampa */}
      <GroupedList
        header={I18N.stampa.elementiSelezionati(selectedCount)}
        footer="I layout di stampa escludono la barra di navigazione e ottimizzano margini e interlinea per fogli A4."
      >
        <GroupedRow
          leading={<Icon name="canti" size={20} />}
          title="Canto della Promessa"
          subtitle="Canzoniere • 1 pagina A4 • Accordi inclusi"
          trailing={<Badge variant="azzurro" size="sm">Selezionato</Badge>}
        />
        <GroupedRow
          leading={<Icon name="giochi" size={20} />}
          title="Palla Avvelenata dei Clan"
          subtitle="Scheda gioco • Regole e materiali • 1 facciata"
          trailing={<Badge variant="azzurro" size="sm">Selezionato</Badge>}
        />
        <GroupedRow
          leading={<Icon name="file-text" size={20} />}
          title="Ordine del Giorno — Riunione Clan"
          subtitle="Punti ODG e note • 1 pagina"
          trailing={<Badge variant="neutral" size="sm">Escluso</Badge>}
        />
      </GroupedList>
    </div>
  );
}
