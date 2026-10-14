import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { useAdmin, logoutAdmin } from '../../lib/auth';
import { AdminLoginModal } from './AdminLoginModal';

export function AdminView() {
  const { isAdmin, userEmail } = useAdmin();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <div className="container">
      {/* Intestazione Sezione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {I18N.admin.title}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}>
            Area riservata per capi e amministratori del clan
          </p>
        </div>
        {isAdmin ? (
          <Button variant="secondary" size="sm" onClick={() => logoutAdmin()}>
            {I18N.auth.logoutButton}
          </Button>
        ) : null}
      </div>

      {!isAdmin ? (
        <GroupedList header="AUTENTICAZIONE RICHIESTA">
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'var(--color-accent-subtle)', color: 'var(--color-accent)', marginBottom: '12px' }}>
              <Icon name="admin" size={32} />
            </div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: '6px' }}>
              {I18N.auth.loginTitle}
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: '400px', margin: '0 auto 16px' }}>
              {I18N.auth.loginDescription}
            </p>
            <Button variant="primary" onClick={() => setIsLoginOpen(true)}>
              {I18N.auth.loginButton}
            </Button>
          </div>
        </GroupedList>
      ) : (
        <>
          {/* Stato Sessione Admin */}
          <GroupedList header="STATO SESSIONE">
            <GroupedRow
              leading={<Icon name="check" size={20} />}
              title={I18N.auth.loggedInAsAdmin}
              subtitle={userEmail || 'admin@clan.scout'}
              trailing={<Badge variant="azzurro" size="sm">Attiva</Badge>}
            />
          </GroupedList>

          {/* Manutenzione e Cestino */}
          <GroupedList header="GESTIONE DATI E CESTINO" footer="Gli elementi eliminati restano nel cestino per 90 giorni prima della pulizia definitiva.">
            <GroupedRow
              leading={<Icon name="trash" size={20} />}
              title={I18N.admin.cestino}
              subtitle={I18N.admin.cestinoVuoto}
              trailing={<Badge variant="neutral" size="sm">0 elementi</Badge>}
              chevron
            />
            <GroupedRow
              leading={<Icon name="file-text" size={20} />}
              title={I18N.admin.backupJson}
              subtitle="Esporta l'intero archivio in un file JSON scaricabile localmente"
              trailing={<Button variant="secondary" size="sm">Esporta</Button>}
            />
          </GroupedList>

          {/* Sistema & Infrastruttura */}
          <GroupedList header="INFRASTRUTTURA SUPABASE">
            <GroupedRow
              leading={<Icon name="settings" size={20} />}
              title={I18N.admin.spazioStorage}
              subtitle="Bucket pubblico allegati (limite 1 GB piano gratuito)"
              trailing={<span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>0.0 MB</span>}
            />
            <GroupedRow
              leading={<Icon name="refresh" size={20} />}
              title={I18N.admin.statoKeepalive}
              subtitle="Database attivo • Prossimo heartbeat automatico programmato"
              trailing={<Badge variant="azzurro" size="sm">OK</Badge>}
            />
          </GroupedList>
        </>
      )}

      {/* Modale BottomSheet Login */}
      <AdminLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => setIsLoginOpen(false)}
      />
    </div>
  );
}
