import { useState, useEffect } from 'preact/hooks';
import { useRoute } from './router';
import { Shell } from './Shell';
import { HomeView } from '../features/home/HomeView';
import { GiochiView } from '../features/giochi/GiochiView';
import { BansView } from '../features/bans/BansView';
import { CantiView } from '../features/canti/CantiView';
import { CalendarioView } from '../features/calendario/CalendarioView';
import { StampaView } from '../features/stampa/StampaView';
import { AdminView } from '../features/admin/AdminView';
import { DesignSystemView } from '../features/design/DesignSystemView';

export function App() {
  const { route } = useRoute();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastSyncTime] = useState<string | null>(null);
  const [pwaNeedRefresh, setPwaNeedRefresh] = useState(false);
  const [updateSWFunction, setUpdateSWFunction] = useState<(() => Promise<void>) | null>(null);

  // Monitoraggio connessione di rete
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Registrazione Service Worker controllata
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      import('virtual:pwa-register').then(({ registerSW }) => {
        const updateSW = registerSW({
          onNeedRefresh() {
            setPwaNeedRefresh(true);
          },
          onOfflineReady() {
            console.log('App pronta per l\'uso offline.');
          },
        });
        setUpdateSWFunction(() => updateSW);
      }).catch((err) => {
        console.warn('Registrazione PWA non supportata o in dev mode:', err);
      });
    }

    // Richiesta persistenza storage su browser supportati
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((isPersisted) => {
        if (isPersisted) {
          console.log('Storage persistente accordato con successo.');
        }
      }).catch((e) => console.warn('Richiesta storage.persist fallita:', e));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handlePwaUpdate = () => {
    if (updateSWFunction) {
      updateSWFunction();
    }
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

  return (
    <Shell
      isOnline={isOnline}
      lastSyncTime={lastSyncTime}
      pwaNeedRefresh={pwaNeedRefresh}
      onPwaUpdate={handlePwaUpdate}
    >
      <CurrentView />
    </Shell>
  );
}
