// src/lib/attachments.ts
// Modulo per la gestione degli Allegati (Immagini JPG/PNG/WebP e Documenti PDF)
// Compressione automatica client-side in WebP, validazione, storage upload e pulizia orfani.

import { supabase } from './supabase';
import { getDb, Allegato, upsertRecords } from './db';
import { I18N } from './i18n';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const SUPABASE_FREE_TIER_STORAGE_BYTES = 1024 * 1024 * 1024; // 1 GB (1,073,741,824 bytes)
export const AUTO_CACHE_SIZE_LIMIT_BYTES = 500 * 1024; // 500 KB per auto-download offline
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export type AttachmentParent =
  | { type: 'gioco'; id: string }
  | { type: 'ban'; id: string }
  | { type: 'canto'; id: string }
  | { type: 'evento'; id: string };

/**
 * Valida il file selezionato (tipo MIME e limite 10 MB).
 */
export function validateAttachmentFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Il file supera la dimensione massima consentita di 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  const mime = file.type.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mime as AllowedMimeType)) {
    return {
      valid: false,
      error: 'Formato non supportato. Sono consentiti solo immagini (JPG, PNG, WebP) e documenti PDF.',
    };
  }

  return { valid: true };
}

/**
 * Genera un percorso univoco e sicuro per lo Storage (mai il nome originale dell'utente).
 * Esempio: "giochi/3fa85f64-5717-4562-b3fc-2c963f66afa6/a1b2c3d4-e5f6-7890.webp"
 */
export function generateSafeStoragePath(
  parentType: 'giochi' | 'bans' | 'canti' | 'eventi',
  parentId: string,
  extension: string
): string {
  const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const cleanExt = extension.replace(/^\./, '').toLowerCase();
  return `${parentType}/${parentId}/${uniqueId}.${cleanExt}`;
}

/**
 * Comprime e ridimensiona un'immagine lato client in formato WebP (max 1600x1600px).
 * Se il file è già un PDF o se Canvas non è disponibile (es. SSR/test), restituisce il file originale.
 */
export async function compressImageToWebp(file: File): Promise<{ blob: Blob; mime: string; extension: string }> {
  // Se è un PDF, non va compresso con Canvas
  if (file.type === 'application/pdf') {
    return { blob: file, mime: 'application/pdf', extension: 'pdf' };
  }

  // Verifica se siamo in ambiente browser con supporto a Image e Canvas
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { blob: file, mime: file.type || 'image/jpeg', extension: file.name.split('.').pop() || 'jpg' };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 1600;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return resolve({ blob: file, mime: file.type, extension: file.name.split('.').pop() || 'jpg' });
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve({ blob, mime: 'image/webp', extension: 'webp' });
          } else {
            // Se WebP compresso è più grande dell'originale, mantieni l'originale
            resolve({ blob: file, mime: file.type, extension: file.name.split('.').pop() || 'jpg' });
          }
        },
        'image/webp',
        0.82
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ blob: file, mime: file.type, extension: file.name.split('.').pop() || 'jpg' });
    };

    img.src = url;
  });
}

/**
 * Restituisce l'URL pubblico assoluto dell'oggetto nello Storage di Supabase.
 */
export function getAttachmentPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from('allegati').getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Caricamento completo di un allegato (solo admin, solo online):
 * 1. Validazione tipo e dimensione
 * 2. Compressione in WebP (se immagine)
 * 3. Upload nel bucket Storage 'allegati'
 * 4. Inserimento record in public.allegati
 * 5. Aggiornamento locale IndexedDB
 */
export async function uploadAttachment(
  file: File,
  parent: AttachmentParent,
  ordine = 0,
  onProgress?: (pct: number) => void
): Promise<Allegato> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  // 1. Validazione
  const val = validateAttachmentFile(file);
  if (!val.valid) {
    throw new Error(val.error);
  }

  if (onProgress) onProgress(15);

  // 2. Compressione client-side
  const { blob, mime, extension } = await compressImageToWebp(file);
  if (onProgress) onProgress(40);

  // 3. Generazione percorso sicuro univoco
  const parentFolder =
    parent.type === 'gioco'
      ? 'giochi'
      : parent.type === 'ban'
      ? 'bans'
      : parent.type === 'canto'
      ? 'canti'
      : 'eventi';

  const storagePath = generateSafeStoragePath(parentFolder, parent.id, extension);

  // 4. Upload in Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from('allegati')
    .upload(storagePath, blob, {
      contentType: mime,
      upsert: false,
    });

  if (uploadErr) {
    throw new Error(`Errore durante il caricamento file in Storage: ${uploadErr.message}`);
  }
  if (onProgress) onProgress(75);

  // 5. Inserimento riga in tabella Postgres
  const now = new Date().toISOString();
  const attachmentId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `att_${Date.now()}`;

  const rowPayload: any = {
    id: attachmentId,
    storage_path: storagePath,
    nome_file: file.name.slice(0, 200), // Preserva il nome originale leggibile
    mime,
    dimensione: blob.size,
    ordine,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    gioco_id: parent.type === 'gioco' ? parent.id : null,
    ban_id: parent.type === 'ban' ? parent.id : null,
    canto_id: parent.type === 'canto' ? parent.id : null,
    evento_id: parent.type === 'evento' ? parent.id : null,
  };

  try {
    const { data: insertedRow, error: insertErr } = await supabase
      .from('allegati')
      .insert([rowPayload])
      .select()
      .single();

    if (insertErr) {
      throw insertErr;
    }

    if (onProgress) onProgress(100);

    // 6. Scrittura locale immediata in IndexedDB
    await upsertRecords('allegati', [insertedRow]);
    return insertedRow as Allegato;
  } catch (err: any) {
    // Se l'INSERT della riga fallisce dopo l'upload, rimuovi subito il file appena caricato e segnala l'errore
    try {
      await supabase.storage.from('allegati').remove([storagePath]);
    } catch (cleanupErr) {
      console.warn('[Storage] Fallita rimozione file orfano post-errore insert:', cleanupErr);
    }
    throw new Error(`Errore salvataggio metadati allegato: ${err.message || err}`);
  }
}

/**
 * Soft delete di un allegato (online-only).
 * Il file FISICO rimane in Storage per permettere il ripristino dal cestino.
 */
export async function softDeleteAttachment(attachmentId: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('allegati')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', attachmentId)
    .select();

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Operazione non autorizzata: permessi di amministratore mancanti.');
  }

  const db = await getDb();
  const existing = (await db.get('allegati', attachmentId)) as Allegato | undefined;
  if (existing) {
    existing.deleted_at = now;
    existing.updated_at = now;
    await db.put('allegati', existing);
  }
}

/**
 * Ripristino di un allegato dal cestino (online-only).
 */
export async function restoreAttachment(attachmentId: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('allegati')
    .update({ deleted_at: null, updated_at: now })
    .eq('id', attachmentId)
    .select();

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Operazione non autorizzata: permessi di amministratore mancanti.');
  }

  const db = await getDb();
  const existing = (await db.get('allegati', attachmentId)) as Allegato | undefined;
  if (existing) {
    existing.deleted_at = null;
    existing.updated_at = now;
    await db.put('allegati', existing);
  }
}

/**
 * Hard delete definitivo di un allegato:
 * 1. Rimuove il file fisico da Supabase Storage tramite API Storage
 * 2. Rimuove la riga dal database
 * 3. Rimuove da IndexedDB
 */
export async function hardDeleteAttachment(attachment: Allegato): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  // 1. Rimuovi prima da Storage
  if (attachment.storage_path) {
    try {
      await supabase.storage.from('allegati').remove([attachment.storage_path]);
    } catch (err) {
      console.warn('[Storage] Errore eliminazione file fisico storage:', err);
    }
  }

  // 2. Rimuovi la riga dalla tabella
  const { data, error } = await supabase.from('allegati').delete().eq('id', attachment.id).select();
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Operazione non autorizzata: permessi di amministratore mancanti.');
  }

  // 3. Rimuovi da IndexedDB
  const db = await getDb();
  await db.delete('allegati', attachment.id);
}

/**
 * Informazioni sull'occupazione dello spazio di Storage.
 * Calcola la somma dei byte dei file attivi e confronta con il limite del Free Tier (1 GB).
 */
export async function getStorageUsageInfo(): Promise<{
  usedBytes: number;
  totalBytes: number;
  usedFormatted: string;
  totalFormatted: string;
  percent: number;
  attachmentCount: number;
}> {
  const db = await getDb();
  const allAllegati = (await db.getAll('allegati')) as Allegato[];
  const active = allAllegati.filter((a) => a.deleted_at === null);

  const usedBytes = active.reduce((acc, a) => acc + (a.dimensione || 0), 0);
  const totalBytes = SUPABASE_FREE_TIER_STORAGE_BYTES;
  const percent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return {
    usedBytes,
    totalBytes,
    usedFormatted: formatBytes(usedBytes),
    totalFormatted: formatBytes(totalBytes),
    percent: Math.min(100, Math.round(percent * 10) / 10),
    attachmentCount: active.length,
  };
}

export interface OrphanFileInfo {
  path: string;
  name: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  ageHours: number;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Scansione e individuazione file orfani in Supabase Storage.
 * REGOLA DI SICUREZZA:
 * Un file è orfano SOLO SE:
 * 1. Non esiste alcuna riga in 'allegati' che lo referenzi (nemmeno con deleted_at valorizzato).
 * 2. E il file ha più di 24 ore di età (created_at < now() - 24h).
 */
export async function findOrphanStorageFiles(): Promise<OrphanFileInfo[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return [];
  }

  const db = await getDb();
  const allAllegati = (await db.getAll('allegati')) as Allegato[];
  // Include QUALSIASI riga esistente in 'allegati', anche con deleted_at valorizzato (cestino)!
  const knownPaths = new Set(
    allAllegati.map((a) => a.storage_path).filter(Boolean)
  );

  // Se online, verifica anche su Supabase per avere la situazione server più aggiornata
  try {
    const { data: remoteRows } = await supabase.from('allegati').select('storage_path');
    if (remoteRows) {
      for (const r of remoteRows) {
        if (r.storage_path) knownPaths.add(r.storage_path);
      }
    }
  } catch (_e) {
    // Continua con il db locale
  }

  const folders = ['giochi', 'bans', 'canti', 'eventi'];
  const orphanFiles: OrphanFileInfo[] = [];
  const now = Date.now();

  for (const folder of folders) {
    try {
      const { data: subfolders, error: subErr } = await supabase.storage
        .from('allegati')
        .list(folder, { limit: 100 });

      if (subErr || !subfolders) continue;

      for (const sub of subfolders) {
        if (!sub.id) {
          // È una sottocartella (parentId)
          const subPath = `${folder}/${sub.name}`;
          const { data: files } = await supabase.storage
            .from('allegati')
            .list(subPath, { limit: 100 });

          if (files) {
            for (const f of files) {
              const fullFilePath = `${subPath}/${f.name}`;
              // 1. Se il file è referenziato da una riga (anche con deleted_at), NON è orfano
              if (knownPaths.has(fullFilePath)) {
                continue;
              }

              // 2. Un file senza riga è orfano SOLO SE ha più di 24 ore
              const fileCreatedAt = f.created_at ? new Date(f.created_at).getTime() : 0;
              const ageMs = now - fileCreatedAt;
              const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

              // Se ha meno di 24 ore (o appena caricato), NON è orfano
              if (ageHours < 24) {
                continue;
              }

              const size = f.metadata?.size || 0;
              orphanFiles.push({
                path: fullFilePath,
                name: f.name,
                size,
                sizeFormatted: formatBytes(size),
                createdAt: f.created_at || new Date(fileCreatedAt).toISOString(),
                ageHours,
              });
            }
          }
        } else {
          // File direttamente nella cartella di sezione
          const fullFilePath = `${folder}/${sub.name}`;
          if (knownPaths.has(fullFilePath)) {
            continue;
          }

          const fileCreatedAt = sub.created_at ? new Date(sub.created_at).getTime() : 0;
          const ageMs = now - fileCreatedAt;
          const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

          if (ageHours < 24) {
            continue;
          }

          const size = sub.metadata?.size || 0;
          orphanFiles.push({
            path: fullFilePath,
            name: sub.name,
            size,
            sizeFormatted: formatBytes(size),
            createdAt: sub.created_at || new Date(fileCreatedAt).toISOString(),
            ageHours,
          });
        }
      }
    } catch (_err) {
      // Ignora errori di listing se non admin
    }
  }

  return orphanFiles;
}

/**
 * Ripulisce i file orfani selezionati dopo conferma esplicita dell'utente.
 */
export async function purgeOrphanStorageFiles(orphanPaths: string[]): Promise<number> {
  if (orphanPaths.length === 0) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const { error } = await supabase.storage.from('allegati').remove(orphanPaths);
  if (error) throw new Error(error.message);
  return orphanPaths.length;
}
