/**
 * Helper per Screen Wake Lock API.
 * Mantiene lo schermo attivo durante la modalità lettura dei bans attorno al fuoco.
 * Include gestione del ripristino su visibilitychange e fallback silenzioso per browser non supportati.
 */

let wakeLockSentinel: any = null;
let isRequested = false;

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export async function requestWakeLock(): Promise<boolean> {
  isRequested = true;
  if (!isWakeLockSupported()) {
    return false;
  }

  try {
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      // Se il rilascio non era intenzionale (es. perdita focus), sentinel torna null
      wakeLockSentinel = null;
    });
    return true;
  } catch (_err) {
    // Fallback silenzioso (batteria quasi scarica, permessi negati dal browser)
    wakeLockSentinel = null;
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  isRequested = false;
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch (_err) {
      // Ignora errori di rilascio
    }
    wakeLockSentinel = null;
  }
}

// Ascolto cambio visibilità scheda: se l'utente torna sulla pagina e la modalità lettura era attiva, ripristina il lock
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isRequested && !wakeLockSentinel) {
      await requestWakeLock();
    }
  });
}
