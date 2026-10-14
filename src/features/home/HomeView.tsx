import { I18N } from '../../lib/i18n';
import { Card } from '../../ui/Card';
import { navigate } from '../../app/router';

export function HomeView() {
  return (
    <div className="container">
      <div style={{ textAlign: 'center', margin: '24px 0 32px' }}>
        <img
          src="./assets/favicon.png"
          alt="Logo Duc In Altum"
          style={{ width: '84px', height: '84px', objectFit: 'contain', marginBottom: '12px' }}
        />
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text)' }}>
          {I18N.app.title}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-base)', marginTop: '4px' }}>
          {I18N.app.subtitle}
        </p>
      </div>

      {/* Griglia Accesso Rapido alle 4 Sezioni Principali */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card
          interactive
          style={{ padding: '20px', cursor: 'pointer', textAlign: 'center' }}
          onClick={() => navigate('giochi')}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎲</div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{I18N.nav.giochi}</h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Regole e materiali
          </p>
        </Card>

        <Card
          interactive
          style={{ padding: '20px', cursor: 'pointer', textAlign: 'center' }}
          onClick={() => navigate('bans')}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔥</div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{I18N.nav.bans}</h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Testi e gesti a memoria
          </p>
        </Card>

        <Card
          interactive
          style={{ padding: '20px', cursor: 'pointer', textAlign: 'center' }}
          onClick={() => navigate('canti')}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎸</div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{I18N.nav.canti}</h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Canzoniere con accordi
          </p>
        </Card>

        <Card
          interactive
          style={{ padding: '20px', cursor: 'pointer', textAlign: 'center' }}
          onClick={() => navigate('calendario')}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{I18N.nav.calendario}</h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Attività e Ordine del Giorno
          </p>
        </Card>
      </div>

      {/* Prossimo Evento in Evidenza */}
      <Card stitch style={{ padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-azzurro)', textTransform: 'uppercase' }}>
            {I18N.calendario.prossimiEventi}
          </span>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          {I18N.calendario.empty}
        </p>
      </Card>
    </div>
  );
}
