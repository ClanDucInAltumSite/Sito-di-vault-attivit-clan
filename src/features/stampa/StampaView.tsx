import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { Button } from '../../ui/Button';
import { SectionIcon } from '../../ui/SectionIcon';
import { BrandLogo } from '../../ui/BrandLogo';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';

export function StampaView() {
  const [selectedCount] = useState(2);

  return (
    <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
      {/* Intestazione Stampa con Logo Completo su Targa Protagonista */}
      <div
        className="ios-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: 'var(--space-6)',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <BrandLogo variant="completo" withTarga={true} size={180} />
        </div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '-0.02em', margin: 'var(--space-1) 0' }}>
          {I18N.stampa.title}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: '440px', margin: '0 auto var(--space-4)' }}>
          Componi e stampa fascicoli cartacei A4 per uscite, bivacchi e riunioni. I fogli di stile A4 escludono barre e controlli touch.
        </p>

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
        footer="I fogli A4 stampati avranno la testata ufficiale del Clan Duc In Altum, margini conformi e font ottimizzati."
      >
        <GroupedRow
          leading={<SectionIcon section="canti" size="sm" />}
          title="Strade e Pensieri per Domani"
          subtitle="Canzoniere • 1 pagina A4 • Accordi inclusi"
          trailing={<Badge variant="azzurro" size="sm">Selezionato</Badge>}
        />
        <GroupedRow
          leading={<SectionIcon section="giochi" size="sm" />}
          title="Palla Avvelenata dei Clan"
          subtitle="Scheda gioco • Regole e materiali • 1 facciata"
          trailing={<Badge variant="azzurro" size="sm">Selezionato</Badge>}
        />
        <GroupedRow
          leading={<SectionIcon section="calendario" size="sm" />}
          title="Ordine del Giorno — Uscita dei Passaggi"
          subtitle="Punti ODG e note logistiche • 1 pagina"
          trailing={<Badge variant="neutral" size="sm">Escluso</Badge>}
        />
      </GroupedList>
    </div>
  );
}
