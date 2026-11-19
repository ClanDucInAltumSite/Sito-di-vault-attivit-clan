import { useState, useEffect } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { I18N } from '../lib/i18n';
import { useRoute, navigate, RouteName } from './router';
import { useAdmin } from '../lib/auth';
import { Icon, IconName } from '../ui/Icon';
import { Toast } from '../ui/Toast';
import { shareWebApp } from '../lib/share';
import { BrandLogo } from '../ui/BrandLogo';
import { TopographicBackground } from '../ui/TopographicBackground';
import { CompassSync } from '../ui/ScoutMotifs';
import { NotificationBell } from '../ui/NotificationBell';

const AdminLoginModal = lazy(() =>
  import('../features/admin/AdminLoginModal').then((m) => ({ default: m.AdminLoginModal }))
);
const ProposteReviewSheet = lazy(() =>
  import('../features/admin/ProposteReviewSheet').then((m) => ({ default: m.ProposteReviewSheet }))
);
const NotificationCenterSheet = lazy(() =>
  import('../features/notifications/NotificationCenterSheet').then((m) => ({ default: m.NotificationCenterSheet }))
);

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Stato Centro Notifiche e Moderazione Proposte
  const [isNotifSheetOpen, setIsNotifSheetOpen] = useState(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [hasAdminAlert, setHasAdminAlert] = useState(false);
  const [pendingProposteCount, setPendingProposteCount] = useState(0);
  const [isProposteSheetOpen, setIsProposteSheetOpen] = useState(false);

  useEffect(() => {
    let cleanupNotifs: (() => void) | undefined;
    let unsubscribeNotifs: (() => void) | undefined;
    let isMounted = true;

    import('../lib/notifications').then(({ initNotificationEngine, subscribeNotifications }) => {
      if (!isMounted) return;
      cleanupNotifs = initNotificationEngine({ isAdmin });
      unsubscribeNotifs = subscribeNotifications((notifs, unread) => {
        if (!isMounted) return;
        setUnreadNotifsCount(unread);
        const hasPendingAdmin = notifs.some((n) => n.type === 'proposta_nuova' && !n.read);
        setHasAdminAlert(hasPendingAdmin);
      });
    });

    if (isAdmin) {
      import('../lib/proposte').then(({ getProposteAdmin }) => {
        if (!isMounted) return;
        getProposteAdmin()
          .then((list) => {
            if (!isMounted) return;
            setPendingProposteCount(list.length);
            if (list.length > 0) {
              setHasAdminAlert(true);
            }
          })
          .catch(() => {});
      });
    } else {
      setPendingProposteCount(0);
    }

    return () => {
      isMounted = false;
      cleanupNotifs?.();
      unsubscribeNotifs?.();
    };
  }, [isAdmin]);

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
          {/* Su Desktop (>= 768px): Pulsanti completi orizzontali */}
          <div className="ios-top-bar-trailing-desktop">
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

            {/* Centro Notifiche Desktop */}
            <NotificationBell
              unreadCount={unreadNotifsCount}
              hasAdminAlert={hasAdminAlert}
              onClick={() => setIsNotifSheetOpen(true)}
            />

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
              style={{ padding: '0 10px', position: 'relative' }}
            >
              <Icon name="admin" size={18} />
              <span style={{ fontSize: '13px', marginLeft: '4px' }}>
                {isAdmin ? 'Admin' : 'Accedi'}
              </span>
              {isAdmin && pendingProposteCount > 0 && (
                <span
                  style={{
                    marginLeft: '6px',
                    background: 'var(--color-bans, #FF9800)',
                    color: '#000000',
                    fontWeight: 700,
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    lineHeight: '14px',
                  }}
                  title={`${pendingProposteCount} proposte in attesa`}
                >
                  {pendingProposteCount}
                </span>
              )}
            </button>
          </div>

          {/* Su Mobile (< 768px): Campanella Notifiche e Pulsante Hamburger */}
          <div className="ios-top-bar-trailing-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <NotificationBell
              unreadCount={unreadNotifsCount}
              hasAdminAlert={hasAdminAlert}
              onClick={() => setIsNotifSheetOpen(true)}
            />
            <button
              type="button"
              className={`ios-btn ios-btn-sm ${isMobileMenuOpen ? 'ios-btn-primary' : 'ios-btn-ghost'}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Chiudi menu' : 'Menu azioni'}
              title="Menu azioni"
              style={{
                width: '38px',
                height: '36px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={isMobileMenuOpen ? 'x' : 'menu'} size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer Menu Mobile (Visibile al tocco dell'Hamburger su schermi piccoli) */}
      {isMobileMenuOpen && (
        <>
          <div
            className="ios-mobile-drawer-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="ios-mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu rapido">
            {/* Header del Drawer */}
            <div className="ios-mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BrandLogo variant="emblema" size={24} />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-ink)' }}>
                  Menu e Azioni
                </span>
              </div>
              <button
                type="button"
                className="ios-btn ios-btn-ghost ios-btn-sm"
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ padding: '4px 8px' }}
                aria-label="Chiudi menu"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Card Sincronizzazione Dati */}
            <div className="ios-mobile-drawer-sync-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CompassSync isSyncing={isSyncing} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                    {isSyncing ? 'Sincronizzazione in corso…' : 'Archivio Sincronizzato'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {!isOnline
                      ? 'Dispositivo non connesso'
                      : lastSyncTime
                      ? `Ultimo sync: ${formattedSyncTime}`
                      : 'Nessun sync effettuato'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                <button
                  type="button"
                  className="ios-btn ios-btn-sm ios-btn-secondary"
                  style={{ flex: 1, fontSize: '0.78rem' }}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (onManualSync) {
                      onManualSync();
                    } else {
                      navigate('stato-dati');
                    }
                  }}
                  disabled={!isOnline || isSyncing}
                >
                  <Icon name="refresh" size={14} />
                  <span style={{ marginLeft: '4px' }}>Sincronizza ora</span>
                </button>
                <button
                  type="button"
                  className="ios-btn ios-btn-sm ios-btn-ghost"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('stato-dati');
                  }}
                >
                  Dettagli
                </button>
              </div>
            </div>

            {/* Voci di Azione Rapida */}
            <div className="ios-mobile-drawer-items">
              {/* Centro Notifiche Mobile */}
              <button
                type="button"
                className="ios-mobile-drawer-item"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsNotifSheetOpen(true);
                }}
              >
                <div
                  className="ios-mobile-drawer-icon"
                  style={{
                    background: hasAdminAlert ? 'var(--color-bans-tenue, #FFF9C4)' : 'var(--color-interactive-tenue)',
                    color: hasAdminAlert ? 'var(--color-rosso, #E53935)' : 'var(--color-interactive, #462679)',
                  }}
                >
                  <Icon name="bell" size={20} />
                </div>
                <div className="ios-mobile-drawer-text">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="ios-mobile-drawer-title">Centro Notifiche</span>
                    {unreadNotifsCount > 0 && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          background: hasAdminAlert ? 'var(--color-rosso, #E53935)' : 'var(--color-primary, #462679)',
                          color: '#FFFFFF',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontWeight: 700,
                        }}
                      >
                        {unreadNotifsCount}
                      </span>
                    )}
                  </div>
                  <span className="ios-mobile-drawer-desc">Promemoria uscite, eventi e avvisi</span>
                </div>
              </button>

              {/* Condividi */}
              <button
                type="button"
                className="ios-mobile-drawer-item"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleShare();
                }}
              >
                <div className="ios-mobile-drawer-icon" style={{ background: 'var(--color-interactive-tenue)', color: 'var(--color-interactive)' }}>
                  <Icon name="share" size={20} />
                </div>
                <div className="ios-mobile-drawer-text">
                  <span className="ios-mobile-drawer-title">{I18N.app.shareBtn}</span>
                  <span className="ios-mobile-drawer-desc">Invia link o copia negli appunti</span>
                </div>
              </button>

              {/* Centro Stampa */}
              <button
                type="button"
                className="ios-mobile-drawer-item"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate('stampa');
                }}
              >
                <div className="ios-mobile-drawer-icon" style={{ background: 'var(--color-surface-hover)', color: 'var(--color-ink)' }}>
                  <Icon name="stampa" size={20} />
                </div>
                <div className="ios-mobile-drawer-text">
                  <span className="ios-mobile-drawer-title">{I18N.stampa.title}</span>
                  <span className="ios-mobile-drawer-desc">Stampa libretti e schede A4</span>
                </div>
              </button>

              {/* Amministrazione */}
              <button
                type="button"
                className="ios-mobile-drawer-item"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (isAdmin) {
                    navigate('admin');
                  } else {
                    setIsLoginModalOpen(true);
                  }
                }}
              >
                <div
                  className="ios-mobile-drawer-icon"
                  style={{
                    background: isAdmin ? 'var(--color-giochi-tenue)' : 'var(--color-surface-hover)',
                    color: isAdmin ? 'var(--color-giochi-badge-text)' : 'var(--color-ink)',
                  }}
                >
                  <Icon name="admin" size={20} />
                </div>
                <div className="ios-mobile-drawer-text">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="ios-mobile-drawer-title">
                      {isAdmin ? 'Pannello Amministrazione' : 'Accedi come Responsabile'}
                    </span>
                    {isAdmin && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          background: pendingProposteCount > 0 ? 'var(--color-bans, #FF9800)' : 'var(--color-giochi-tenue)',
                          color: pendingProposteCount > 0 ? '#000000' : 'var(--color-giochi-badge-text)',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontWeight: 700,
                        }}
                      >
                        {pendingProposteCount > 0 ? `${pendingProposteCount} da approvare` : 'Attivo'}
                      </span>
                    )}
                  </div>
                  <span className="ios-mobile-drawer-desc">
                    {isAdmin ? 'Gestisci canti, giochi e calendario' : 'Modifica contenuti e database'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

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

      {/* Centro Notifiche BottomSheet */}
      {isNotifSheetOpen && (
        <Suspense fallback={null}>
          <NotificationCenterSheet
            isOpen={isNotifSheetOpen}
            onClose={() => setIsNotifSheetOpen(false)}
            isAdmin={isAdmin}
            onOpenProposteReview={() => {
              setIsNotifSheetOpen(false);
              setIsProposteSheetOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* Modale Revisione Proposte per l'Admin */}
      {isAdmin && isProposteSheetOpen && (
        <Suspense fallback={null}>
          <ProposteReviewSheet
            isOpen={isProposteSheetOpen}
            onClose={() => {
              setIsProposteSheetOpen(false);
              if (isAdmin) {
                import('../lib/proposte').then(({ getProposteAdmin }) => {
                  getProposteAdmin()
                    .then((list) => {
                      setPendingProposteCount(list.length);
                      setHasAdminAlert(list.length > 0);
                    })
                    .catch(() => {});
                });
              }
            }}
            onItemsChanged={() => {
              if (isAdmin) {
                import('../lib/proposte').then(({ getProposteAdmin }) => {
                  getProposteAdmin()
                    .then((list) => {
                      setPendingProposteCount(list.length);
                      setHasAdminAlert(list.length > 0);
                    })
                    .catch(() => {});
                });
              }
            }}
          />
        </Suspense>
      )}

      {/* Modale BottomSheet Login Admin */}
      {isLoginModalOpen && (
        <Suspense fallback={null}>
          <AdminLoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            onSuccess={() => {
              setIsLoginModalOpen(false);
              navigate('admin');
            }}
          />
        </Suspense>
      )}

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
