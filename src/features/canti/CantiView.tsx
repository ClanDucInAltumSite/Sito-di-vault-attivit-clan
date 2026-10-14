import { I18N } from '../../lib/i18n';
import { Card } from '../../ui/Card';

export function CantiView() {
  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{I18N.canti.title}</h1>
      </div>
      <Card style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>{I18N.canti.empty}</p>
      </Card>
    </div>
  );
}
