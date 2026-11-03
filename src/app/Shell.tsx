import { useState } from 'preact/hooks';
import { I18N } from '../lib/i18n';
import { useRoute, navigate, RouteName } from './router';
import { useAdmin } from '../lib/auth';
import { AdminLoginModal } from '../features/admin/AdminLoginModal';
import { Icon, IconName } from '../ui/Icon';
import { Toast } from '../ui/Toast';
import { shareWebApp } from '../lib/share';
import { BrandLogo } from '../ui/BrandLogo';
import { TopographicBackground } from '../ui/TopographicBackground';
import { CompassSync } from '../ui/ScoutMotifs';

export interface ShellProps {
  isOnline: boolean;
  isSyncing?: boolean;
  lastSyncTime: string | null;
  pwaNeedRefresh: boolean;
  onPwaUpdate: () => void;
  onManualSync?: () => void;
  children: any;
}

export function Shell({
  isOnline,
  isSyncing = false,
  lastSyncTime,
  pwaNeedRefresh,
  onPwaUpdate,
  onManualSync,
  children,
}: ShellProps) {
  const { route } = useRoute();
  const { isAdmin } = useAdmin();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleShare = async () => {
    try {
      const result = await shareWebApp();
      if (result.copied) {
        setToastMessage(I18N.app.shareSuccess);
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch (err) {
      console.error('Errore condivisione web app:', err);
    }
  };

  const routeTitles: Record<RouteName, string> = {
    home: I18N.app.shortTitle,
    giochi: I18N.nav.giochi,
    bans: I18N.nav.bans,
    canti: I18N.nav.canti,
    calendario: I18N.nav.calendario,
    quaderno: I18N.quaderno.title,
    stampa: I18N.stampa.title,
    admin: I18N.nav.admin,
    design: 'Sistema di Design',
    'stato-dati': 'Stato Dati e Sync',
  };

  const navItems: { id: RouteName; label: string; icon: IconName }[] = [
    { id: 'home', label: I18N.nav.home, icon: 'home' },
    { id: 'giochi', label: I18N.nav.giochi, icon: 'giochi' },
    { id: 'bans', label: I18N.nav.bans, icon: 'bans' },
    { id: 'canti', label: I18N.nav.canti, icon: 'canti' },
    { id: 'calendario', label: I18N.nav.calendario, icon: 'calendario' },
    { id: 'quaderno', label: 'Quaderno', icon: 'quaderno' },
  ];

  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
    : I18N.status.neverSynced;

  return (
    <>
      {/* Banner Aggiornamento PWA Disponibile */}
      {pwaNeedRefresh ? (
        <div className="ios-banner-pwa" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="refresh" size={16} />
            <span>{I18N.status.pwaUpdateAvailable}</span>
          </div>
          <button
            type="button"
            className="ios-toast-action"
            onClick={onPwaUpdate}
          >
            {I18N.status.pwaUpdateAction}
          </button>
        </div>
      ) : null}

      {/* Banner Offline con indicazione data e ora dell'ultimo aggiornamento */}
      {!isOnline ? (
        <div className="ios-banner-offline" role="status">
          <Icon name="wifi-off" size={16} />
          <span>{I18N.status.offlineBanner(formattedSyncTime)}</span>
        </div>
      ) : null}

      {/* Top Bar Apple Traslucida */}
      <header className="ios-top-bar">
        <div className="ios-top-bar-leading">
          <a
            href="#/"
            className="ios-top-bar-brand"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}
            onClick={(e) => {
              e.preventDefault();
              navigate('home');
            }}
            aria-label="Torna alla Home"
          >
            <div
              style={{
                backgroundColor: 'var(--color-targa-bg)',
                borderRadius: '8px',
                padding: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-rest)',
                border: '1px solid var(--color-targa-border)',
              }}
            >
              <BrandLogo variant="emblema" size={26} />
            </div>
            <span className="ios-top-bar-title">{routeTitles[route] || I18N.app.shortTitle}</span>
          </a>
        </div>

        <div className="ios-top-bar-trailing">
          {/* Indicatore e Pulsante Sincronizzazione con Bussola Scout Animata */}
          <button
            type="button"
            className="ios-btn ios-btn-ghost ios-btn-sm"
            onClick={onManualSync || (() => navigate('stato-dati'))}
            aria-label={isSyncing ? 'Sincronizzazione in corso' : 'Sincronizza archivio'}
            title={
              isSyncing
                ? 'Sincronizzazione in corso…'
                : lastSyncTime
                ? `Ultimo aggiornamento: ${formattedSyncTime}. Tocca per sincronizzare`
                : 'Aggiorna ora'
            }
            disabled={!isOnline && !isSyncing}
            style={{ padding: '0 6px', minWidth: '36px' }}
          >
            <CompassSync isSyncing={isSyncing} size={20} />
          </button>

          {/* Condivisione Web App */}
          <button
            type="button"
            className="ios-btn ios-btn-ghost ios-btn-sm"
            onClick={handleShare}
            aria-label={I18N.app.shareBtn}
            title={I18N.app.shareBtn}
            style={{ padding: '0 8px', minWidth: '38px' }}
          >
            <Icon name="share" size={20} />
          </button>

          {/* Scorciatoia Centro Stampa */}
          <button
            type="button"
            className="ios-btn ios-btn-ghost ios-btn-sm"
            onClick={() => navigate('stampa')}
            aria-label={I18N.nav.stampa}
            title={I18N.nav.stampa}
            style={{ padding: '0 8px', minWidth: '38px' }}
          >
            <Icon name="stampa" size={20} />
          </button>

          {/* Accesso Admin */}
          <button
            type="button"
            className={`ios-btn ios-btn-sm ${isAdmin ? 'ios-btn-primary' : 'ios-btn-ghost'}`}
            onClick={() => {
              if (isAdmin) {
                navigate('admin');
              } else {
                setIsLoginModalOpen(true);
              }
            }}
            aria-label={I18N.nav.admin}
            title={isAdmin ? I18N.auth.loggedInAsAdmin : I18N.auth.loginTitle}
            style={{ padding: '0 10px' }}
          >
            <Icon name="admin" size={18} />
            <span style={{ fontSize: '13px', marginLeft: '4px' }}>
              {isAdmin ? 'Admin' : 'Accedi'}
            </span>
          </button>
        </div>
      </header>

      {/* Sfondo Topografico Ambientale Globale (visibile in tutte le pagine) */}
      <TopographicBackground />

      {/* Contenuto Principale con scroll e padding sicuro */}
      <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {children}
      </main>

      {/* Tab Bar Apple Traslucida con supporto Safe Area */}
      <nav className="ios-tab-bar" aria-label="Navigazione principale">
        {navItems.map((item) => {
          const isActive = route === item.id;
          return (
            <a
              key={item.id}
              href={`#/${item.id === 'home' ? '' : item.id}`}
              className={`ios-tab-item ${isActive ? 'ios-tab-item-active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.id);
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="ios-tab-item-icon" aria-hidden="true">
                <Icon name={item.icon} size={22} strokeWidth={isActive ? 2.2 : 1.75} />
              </span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* Modale BottomSheet Login Admin */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          setIsLoginModalOpen(false);
          navigate('admin');
        }}
      />

      {/* Notifica Toast Fluttuante */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(var(--tab-bar-height, 64px) + 16px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3500,
          }}
        >
          <Toast
            message={toastMessage}
            type="success"
            onClose={() => setToastMessage(null)}
          />
        </div>
      )}
    </>
  );
}
