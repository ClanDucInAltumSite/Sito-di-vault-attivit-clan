import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { useAdmin, logoutAdmin } from '../../lib/auth';
import { AdminLoginModal } from './AdminLoginModal';

export function AdminView() {
  const { isAdmin, userEmail } = useAdmin();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{I18N.admin.title}</h1>
        {isAdmin ? (
          <Button variant="outline" size="sm" onClick={() => logoutAdmin()}>
            {I18N.auth.logoutButton}
          </Button>
        ) : null}
      </div>

      {!isAdmin ? (
        <Card style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            {I18N.auth.loginDescription}
          </p>
          <Button variant="primary" onClick={() => setIsLoginOpen(true)}>
            🔒 {I18N.auth.loginButton}
          </Button>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card stitch style={{ padding: '16px', backgroundColor: 'var(--color-azzurro-subtle)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-azzurro)' }}>
              ✓ {I18N.auth.loggedInAsAdmin} ({userEmail})
            </span>
          </Card>

          <Card style={{ padding: '16px' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: '8px' }}>
              🗑️ {I18N.admin.cestino}
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {I18N.admin.cestinoVuoto}
            </p>
          </Card>

          <Card style={{ padding: '16px' }}>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: '8px' }}>
              💾 {I18N.admin.backupJson}
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
              Esporta l'intero archivio in un file JSON scaricabile localmente.
            </p>
            <Button variant="secondary" size="sm">
              📥 {I18N.admin.backupJson}
            </Button>
          </Card>
        </div>
      )}

      <AdminLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => setIsLoginOpen(false)}
      />
    </div>
  );
}
