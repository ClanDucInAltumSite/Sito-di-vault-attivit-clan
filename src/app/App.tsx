import { useState, useEffect } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { useRoute } from './router';
import { Shell } from './Shell';
import { HomeView } from '../features/home/HomeView';
import {
  initSyncEngine,
  subscribeSyncState,
  syncNow,
  SyncState,
  getSyncState,
} from '../lib/sync';

const GiochiView = lazy(() => import('../features/giochi/GiochiView').then((m) => ({ default: m.GiochiView })));
const BansView = lazy(() => import('../features/bans/BansView').then((m) => ({ default: m.BansView })));
const CantiView = lazy(() => import('../features/canti/CantiView').then((m) => ({ default: m.CantiView })));
const CalendarioView = lazy(() => import('../features/calendario/CalendarioView').then((m) => ({ default: m.CalendarioView })));
const StampaView = lazy(() => import('../features/stampa/StampaView').then((m) => ({ default: m.StampaView })));
const AdminView = lazy(() => import('../features/admin/AdminView').then((m) => ({ default: m.AdminView })));
const DesignSystemView = lazy(() => import('../features/design/DesignSystemView').then((m) => ({ default: m.DesignSystemView })));
const StatoDatiView = lazy(() => import('../features/statodati/StatoDatiView').then((m) => ({ default: m.StatoDatiView })));

export function App() {
  const { route } = useRoute();
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());
  const [pwaNeedRefresh, setPwaNeedRefresh] = useState(false);
  const [updateSWFunction, setUpdateSWFunction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    // 1. Inizializzazione del motore di sincronizzazione offline/online e Realtime
    const cleanupSync = initSyncEngine();
    const unsubscribeSync = subscribeSyncState(setSyncState);

    // 2. Registrazione Service Worker controllata (PWA) differita a window.load per non impattare FCP/LCP
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      const registerServiceWorker = () => {
        import('virtual:pwa-register')
          .then(({ registerSW }) => {
            const updateSW = registerSW({
              onNeedRefresh() {
                setPwaNeedRefresh(true);
              },
              onOfflineReady() {
                console.log('App pronta per l\'uso offline (precache completata).');
              },
            });
            setUpdateSWFunction(() => updateSW);
          })
          .catch((err) => {
            console.warn('Registrazione PWA non supportata o in dev mode:', err);
          });
      };

      if (document.readyState === 'complete') {
        registerServiceWorker();
      } else {
        window.addEventListener('load', registerServiceWorker, { once: true });
      }
    }

    // 3. Richiesta persistenza storage su browser supportati (evita eliminazione cache da iOS/Android)
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage
        .persist()
        .then((isPersisted) => {
          if (isPersisted) {
            console.log('Storage persistente (IndexedDB) accordato con successo dal browser.');
          }
        })
        .catch((e) => console.warn('Richiesta storage.persist fallita:', e));
    }

    return () => {
      cleanupSync();
      unsubscribeSync();
    };
  }, []);

  const handlePwaUpdate = () => {
    if (updateSWFunction) {
      updateSWFunction();
    }
  };

  const handleManualSync = () => {
    syncNow({ trigger: 'shell_topbar_manual' });
  };

  // Rendering della vista basata sull'hash routing
  let CurrentView = HomeView;
  if (route === 'giochi') CurrentView = GiochiView;
  else if (route === 'bans') CurrentView = BansView;
  else if (route === 'canti') CurrentView = CantiView;
  else if (route === 'calendario') CurrentView = CalendarioView;
  else if (route === 'stampa') CurrentView = StampaView;
  else if (route === 'admin') CurrentView = AdminView;
  else if (route === 'design') CurrentView = DesignSystemView;
  else if (route === 'stato-dati') CurrentView = StatoDatiView;

  return (
    <Shell
      isOnline={syncState.isOnline}
      isSyncing={syncState.status === 'syncing'}
      lastSyncTime={syncState.lastSyncCompletedAt || syncState.lastSyncServerTime}
      pwaNeedRefresh={pwaNeedRefresh}
      onPwaUpdate={handlePwaUpdate}
      onManualSync={handleManualSync}
    >
      <Suspense
        fallback={
          <div
            className="container"
            style={{
              minHeight: '40vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="caption text-secondary" role="status">Caricamento sezione...</span>
          </div>
        }
      >
        <CurrentView />
      </Suspense>
    </Shell>
  );
}
