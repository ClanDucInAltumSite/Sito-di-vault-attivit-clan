import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { Button } from '../../ui/Button';
import { SectionIcon } from '../../ui/SectionIcon';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { useAdmin, logoutAdmin } from '../../lib/auth';
import { AdminLoginModal } from './AdminLoginModal';

export function AdminView() {
  const { isAdmin, userEmail } = useAdmin();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
      {/* Intestazione Sezione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <SectionIcon section="admin" size="md" />
          <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '-0.02em', margin: 0 }}>
              {I18N.admin.title}
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', margin: '2px 0 0' }}>
              Area riservata per capi e amministratori del clan
            </p>
          </div>
        </div>
        {isAdmin ? (
          <Button variant="secondary" size="sm" onClick={() => logoutAdmin()}>
            {I18N.auth.logoutButton}
          </Button>
        ) : null}
      </div>

      {!isAdmin ? (
        <GroupedList header="AUTENTICAZIONE RICHIESTA">
          <div style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: 'var(--space-3)', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-border-subtle)', color: 'var(--color-interactive)', marginBottom: 'var(--space-3)' }}>
              <Icon name="admin" size={32} />
            </div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-ink)', marginBottom: 'var(--space-1)' }}>
              {I18N.auth.loginTitle}
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: '400px', margin: '0 auto var(--space-4)' }}>
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
