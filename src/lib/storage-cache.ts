// src/lib/storage-cache.ts
// Gestione della Cache API per gli allegati offline (scout-attachments-v1)
// Auto-download degli allegati < 500 KB e download completo manuale con barra di progresso a sentiero.

import { getDb, Allegato } from './db';
import { getAttachmentPublicUrl, AUTO_CACHE_SIZE_LIMIT_BYTES } from './attachments';

export const ATTACHMENTS_CACHE_NAME = 'scout-attachments-v1';

/**
 * Verifica se l'ambiente supporta Cache API (browser o test con mock).
 */
function isCacheSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Memorizza un singolo allegato nella cache dedicata.
 */
export async function cacheAttachment(url: string): Promise<boolean> {
  if (!isCacheSupported() || !url) return false;

  try {
    const cache = await caches.open(ATTACHMENTS_CACHE_NAME);
    const existing = await cache.match(url);
    if (existing) return true; // Già in cache

    const response = await fetch(url, { mode: 'cors' });
    if (response.ok && response.status === 200) {
      await cache.put(url, response.clone());
      return true;
    }
  } catch (err) {
    console.warn(`[StorageCache] Impossibile memorizzare in cache ${url}:`, err);
  }
  return false;
}

/**
 * Verifica se un allegato è già presente nella cache locale.
 */
export async function isAttachmentCached(url: string): Promise<boolean> {
  if (!isCacheSupported() || !url) return false;

  try {
    const cache = await caches.open(ATTACHMENTS_CACHE_NAME);
    const match = await cache.match(url);
    return Boolean(match);
  } catch (_err) {
    return false;
  }
}

/**
 * Ottiene la risorsa per la visualizzazione:
 * - Se presente in Cache, restituisce un Object URL creato dal blob cached
 * - Se online e non in Cache, restituisce l'URL pubblico originale
 * - Se offline e non in Cache, restituisce null
 */
export async function resolveAttachmentSource(url: string): Promise<{
  src: string | null;
  isOfflineFallback: boolean;
}> {
  if (!url) return { src: null, isOfflineFallback: false };

  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  if (isCacheSupported()) {
    try {
      const cache = await caches.open(ATTACHMENTS_CACHE_NAME);
      const match = await cache.match(url);
      if (match) {
        const blob = await match.blob();
        const blobUrl = URL.createObjectURL(blob);
        return { src: blobUrl, isOfflineFallback: false };
      }
    } catch (_err) {
      // Ignora errori di match cache
    }
  }

  if (isOnline) {
    return { src: url, isOfflineFallback: false };
  }

  // Offline e risorsa non in cache
  return { src: null, isOfflineFallback: true };
}

/**
 * Auto-download in background degli allegati leggeri (< 500 KB) dopo la sincronizzazione dati.
 */
export async function autoCacheSmallAttachments(): Promise<number> {
  if (!isCacheSupported()) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  try {
    const db = await getDb();
    const all = (await db.getAll('allegati')) as Allegato[];
    const smallActive = all.filter(
      (a) => a.deleted_at === null && a.dimensione > 0 && a.dimensione < AUTO_CACHE_SIZE_LIMIT_BYTES
    );

    let cachedCount = 0;
    for (const item of smallActive) {
      const publicUrl = getAttachmentPublicUrl(item.storage_path);
      const ok = await cacheAttachment(publicUrl);
      if (ok) cachedCount++;
    }
    return cachedCount;
  } catch (err) {
    console.warn('[StorageCache] Errore auto-cache allegati:', err);
    return 0;
  }
}

/**
 * Download manuale completo di TUTTI gli allegati per l'uso offline.
 * Notifica il progresso per alimentare l'indicatore visuale a "sentiero".
 */
export async function downloadAllAttachmentsForOffline(
  onProgress?: (current: number, total: number, percent: number) => void
): Promise<{ downloaded: number; total: number; failed: number }> {
  if (!isCacheSupported()) {
    throw new Error('Cache Storage API non supportata da questo dispositivo');
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Impossibile scaricare: dispositivo offline');
  }

  const db = await getDb();
  const all = (await db.getAll('allegati')) as Allegato[];
  const active = all.filter((a) => a.deleted_at === null && Boolean(a.storage_path));

  const total = active.length;
  if (total === 0) {
    if (onProgress) onProgress(0, 0, 100);
    return { downloaded: 0, total: 0, failed: 0 };
  }

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const item = active[i];
    if (!item) continue;
    const url = getAttachmentPublicUrl(item.storage_path);
    const success = await cacheAttachment(url);
    if (success) {
      downloaded++;
    } else {
      failed++;
    }

    if (onProgress) {
      const current = i + 1;
      const pct = Math.round((current / total) * 100);
      onProgress(current, total, pct);
    }
  }

  return { downloaded, total, failed };
}

/**
 * Calcola il numero di allegati già memorizzati in cache rispetto al totale attivo.
 */
export async function getOfflineAttachmentStats(): Promise<{
  cached: number;
  total: number;
}> {
  if (!isCacheSupported()) return { cached: 0, total: 0 };

  try {
    const db = await getDb();
    const all = (await db.getAll('allegati')) as Allegato[];
    const active = all.filter((a) => a.deleted_at === null && Boolean(a.storage_path));

    const cache = await caches.open(ATTACHMENTS_CACHE_NAME);
    let cached = 0;

    for (const item of active) {
      const url = getAttachmentPublicUrl(item.storage_path);
      const match = await cache.match(url);
      if (match) cached++;
    }

    return { cached, total: active.length };
  } catch (_err) {
    return { cached: 0, total: 0 };
  }
}
