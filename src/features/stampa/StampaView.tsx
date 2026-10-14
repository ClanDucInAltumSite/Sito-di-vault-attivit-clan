import { I18N } from '../../lib/i18n';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';

export function StampaView() {
  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{I18N.stampa.title}</h1>
        <Button variant="primary" onClick={() => window.print()}>
          🖨️ {I18N.stampa.stampaOra}
        </Button>
      </div>
      <Card style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>{I18N.stampa.nessunElementoSelezionato}</p>
      </Card>
    </div>
  );
}
