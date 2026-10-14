import { useState } from 'preact/hooks';
import { I18N } from '../lib/i18n';
import { useRoute, navigate, RouteName } from './router';
import { useAdmin } from '../lib/auth';
import { AdminLoginModal } from '../features/admin/AdminLoginModal';

export interface ShellProps {
  isOnline: boolean;
  lastSyncTime: string | null;
  pwaNeedRefresh: boolean;
  onPwaUpdate: () => void;
  children: any;
}

export function Shell({
  isOnline,
  lastSyncTime,
  pwaNeedRefresh,
  onPwaUpdate,
  children,
}: ShellProps) {
  const { route } = useRoute();
  const { isAdmin } = useAdmin();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const navItems: { id: RouteName; label: string; icon: string }[] = [
    { id: 'home', label: I18N.nav.home, icon: '🏠' },
    { id: 'giochi', label: I18N.nav.giochi, icon: '🎲' },
    { id: 'bans', label: I18N.nav.bans, icon: '🔥' },
    { id: 'canti', label: I18N.nav.canti, icon: '🎸' },
    { id: 'calendario', label: I18N.nav.calendario, icon: '📅' },
  ];

  return (
    <>
      {/* Banner Aggiornamento PWA Disponibile */}
      {pwaNeedRefresh ? (
        <div className="pwa-banner" role="alert">
          <span>🔄 {I18N.status.pwaUpdateAvailable}</span>
          <button
            type="button"
            className="toast-action-btn"
            style={{ backgroundColor: 'var(--color-giallo)', color: '#21262B' }}
            onClick={onPwaUpdate}
          >
            {I18N.status.pwaUpdateAction}
          </button>
        </div>
      ) : null}

      {/* Banner Offline */}
      {!isOnline ? (
        <div className="offline-banner" role="status">
          <span>
            ⚠️ {I18N.status.offlineBanner(lastSyncTime || I18N.status.neverSynced)}
          </span>
        </div>
      ) : null}

      {/* Top Bar Fissa */}
      <header className="top-bar">
        <a
          href="#/"
          className="top-bar-brand"
          onClick={(e) => {
            e.preventDefault();
            navigate('home');
          }}
        >
          <img src="./assets/favicon.png" alt="Logo" className="top-bar-logo" />
          <span>{I18N.app.shortTitle}</span>
        </a>

        <div className="top-bar-actions">
          {/* Scorciatoia Stampa */}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('stampa')}
            aria-label={I18N.nav.stampa}
            title={I18N.nav.stampa}
          >
            🖨️
          </button>

          {/* Accesso Admin */}
          <button
            type="button"
            className={`btn btn-sm ${isAdmin ? 'btn-accent' : 'btn-ghost'}`}
            onClick={() => {
              if (isAdmin) {
                navigate('admin');
              } else {
                setIsLoginModalOpen(true);
              }
            }}
            aria-label={I18N.nav.admin}
            title={isAdmin ? I18N.auth.loggedInAsAdmin : I18N.auth.loginTitle}
          >
            {isAdmin ? '🛡️ Admin' : '🔒'}
          </button>
        </div>
      </header>

      {/* Contenuto Principale della Pagina */}
      <main style={{ flex: 1 }}>{children}</main>

      {/* Bottom Navigation Bar Fissa per Mobile */}
      <nav className="bottom-nav" aria-label="Navigazione principale">
        {navItems.map((item) => {
          const isActive = route === item.id;
          return (
            <a
              key={item.id}
              href={`#/${item.id === 'home' ? '' : item.id}`}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.id);
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-item-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* Modale Login Admin */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          setIsLoginModalOpen(false);
          navigate('admin');
        }}
      />
    </>
  );
}
