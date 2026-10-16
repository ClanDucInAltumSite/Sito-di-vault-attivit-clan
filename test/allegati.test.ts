// test/allegati.test.ts
// Test unitari completi per la FASE 5 (Allegati):
// - Validazione MIME e limite 10 MB
// - Generazione percorso Storage sicuro e univoco
// - Compressione WebP client-side
// - Calcolo spazio storage su limite 1 GB Supabase
// - Soft delete e nascondimento gerarchico figli
// - Rilevamento e pulizia file orfani
// - Risoluzione sorgenti Cache API offline/online

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAttachmentFile,
  generateSafeStoragePath,
  compressImageToWebp,
  getStorageUsageInfo,
  findOrphanStorageFiles,
  softDeleteAttachment,
  restoreAttachment,
  hardDeleteAttachment,
  MAX_FILE_SIZE_BYTES,
  SUPABASE_FREE_TIER_STORAGE_BYTES,
} from '../src/lib/attachments';
import {
  resolveAttachmentSource,
  removeAttachmentFromCache,
  enforceAttachmentsCacheCap,
  onAttachmentsCacheQuotaExceeded,
  MAX_ATTACHMENTS_CACHE_BYTES,
} from '../src/lib/storage-cache';
import { supabase } from '../src/lib/supabase';
import {
  getDb,
  resetDbInstanceForTesting,
  upsertRecords,
  getAllegati,
  Allegato,
} from '../src/lib/db';
import 'fake-indexeddb/auto';

describe('FASE 5 — Allegati: Validazione, Storage, Cache e Resilienza', () => {
  beforeEach(async () => {
    resetDbInstanceForTesting();
    const db = await getDb();
    await db.clear('allegati');
    await db.clear('giochi');
  });

  // 1. Validazione MIME e Limite Dimensione
  it('1. Validazione: accetta formati validi (JPG, PNG, WebP, PDF) entro 10 MB', () => {
    const validPng = new File(['mock content'], 'mappa.png', { type: 'image/png' });
    const validJpg = new File(['mock content'], 'foto.jpg', { type: 'image/jpeg' });
    const validWebp = new File(['mock content'], 'schema.webp', { type: 'image/webp' });
    const validPdf = new File(['mock content'], 'regole.pdf', { type: 'application/pdf' });

    expect(validateAttachmentFile(validPng).valid).toBe(true);
    expect(validateAttachmentFile(validJpg).valid).toBe(true);
    expect(validateAttachmentFile(validWebp).valid).toBe(true);
    expect(validateAttachmentFile(validPdf).valid).toBe(true);
  });

  it('2. Validazione: rifiuta file oltre 10 MB', () => {
    const hugeBuffer = new Uint8Array(MAX_FILE_SIZE_BYTES + 1024);
    const hugeFile = new File([hugeBuffer], 'pesante.pdf', { type: 'application/pdf' });

    const result = validateAttachmentFile(hugeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10 MB');
  });

  it('3. Validazione: rifiuta formati non consentiti (HTML, EXE, MP3 audio)', () => {
    const htmlFile = new File(['<h1>ciao</h1>'], 'pagina.html', { type: 'text/html' });
    const exeFile = new File(['malicious'], 'virus.exe', { type: 'application/x-msdownload' });
    const audioFile = new File(['audio data'], 'canto.mp3', { type: 'audio/mpeg' });

    expect(validateAttachmentFile(htmlFile).valid).toBe(false);
    expect(validateAttachmentFile(exeFile).valid).toBe(false);
    expect(validateAttachmentFile(audioFile).valid).toBe(false);
  });

  // 4. Generazione Percorso Storage Sicuro e Univoco
  it('4. Percorso Storage Sicuro: genera percorsi isolati senza caratteri pericolosi né nome originale', () => {
    const parentId = '00000000-0000-0000-0000-000000000001';
    const path1 = generateSafeStoragePath('giochi', parentId, 'webp');
    const path2 = generateSafeStoragePath('giochi', parentId, 'webp');

    expect(path1).toMatch(/^giochi\/00000000-0000-0000-0000-000000000001\/[a-zA-Z0-9_-]+\.webp$/);
    // Due chiamate devono produrre percorsi diversi (univocità)
    expect(path1).not.toBe(path2);
    // Nessun path traversal
    expect(path1.includes('..')).toBe(false);
    expect(path1.includes(' ')).toBe(false);
  });

  // 5. Compressione Client-side: PDF non alterato
  it('5. Compressione: un file PDF viene restituito integro senza tentativi di conversione Canvas', async () => {
    const pdfFile = new File(['mock pdf content'], 'documento.pdf', { type: 'application/pdf' });
    const result = await compressImageToWebp(pdfFile);

    expect(result.mime).toBe('application/pdf');
    expect(result.extension).toBe('pdf');
    expect(result.blob).toBe(pdfFile);
  });

  // 6. Calcolo Occupazione Storage rispetto a 1 GB
  it('6. Metriche Storage: calcola la somma dei byte degli allegati attivi rispetto al limite di 1 GB', async () => {
    await upsertRecords('allegati', [
      {
        id: 'att-1',
        gioco_id: 'g-1',
        ban_id: null,
        canto_id: null,
        evento_id: null,
        storage_path: 'giochi/g-1/1.webp',
        nome_file: 'Schema 1.webp',
        mime: 'image/webp',
        dimensione: 500 * 1024, // 500 KB
        ordine: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      {
        id: 'att-2',
        gioco_id: 'g-1',
        ban_id: null,
        canto_id: null,
        evento_id: null,
        storage_path: 'giochi/g-1/2.pdf',
        nome_file: 'Regole.pdf',
        mime: 'application/pdf',
        dimensione: 1500 * 1024, // 1.5 MB
        ordine: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      {
        id: 'att-3-deleted',
        gioco_id: 'g-1',
        ban_id: null,
        canto_id: null,
        evento_id: null,
        storage_path: 'giochi/g-1/old.webp',
        nome_file: 'Vecchio.webp',
        mime: 'image/webp',
        dimensione: 10 * 1024 * 1024, // 10 MB (cancellato, non deve contare)
        ordine: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
      },
    ]);

    const usage = await getStorageUsageInfo();
    expect(usage.totalBytes).toBe(SUPABASE_FREE_TIER_STORAGE_BYTES);
    expect(usage.usedBytes).toBe(2000 * 1024); // 2 MB
    expect(usage.attachmentCount).toBe(2);
    expect(usage.usedFormatted).toContain('2.0 MB');
  });

  // 7. Nascondimento Gerarchico Figli
  it('7. Nascondimento gerarchico: se il gioco genitore è cancellato, gli allegati collegati sono nascosti', async () => {
    // 1. Crea gioco e allegato
    await upsertRecords('giochi', [
      {
        id: 'gioco-test-parent',
        nome: 'Alce Rossa',
        regole: 'Regola...',
        materiali: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ]);

    await upsertRecords('allegati', [
      {
        id: 'att-figlio',
        gioco_id: 'gioco-test-parent',
        ban_id: null,
        canto_id: null,
        evento_id: null,
        storage_path: 'giochi/gioco-test-parent/figlio.webp',
        nome_file: 'Figlio.webp',
        mime: 'image/webp',
        dimensione: 100 * 1024,
        ordine: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ]);

    // Gioco attivo -> allegato visibile
    let allegati = await getAllegati('gioco', 'gioco-test-parent', false);
    expect(allegati.length).toBe(1);
    expect(allegati[0].id).toBe('att-figlio');

    // 2. Soft-delete del gioco genitore
    await upsertRecords('giochi', [
      {
        id: 'gioco-test-parent',
        nome: 'Alce Rossa',
        regole: 'Regola...',
        materiali: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
      },
    ]);

    // Gioco eliminato -> getAllegati() restituisce array vuoto
    allegati = await getAllegati('gioco', 'gioco-test-parent', false);
    expect(allegati.length).toBe(0);

    // Con includeDeleted = true l'amministratore può ancora vederlo nel cestino
    allegati = await getAllegati('gioco', 'gioco-test-parent', true);
    expect(allegati.length).toBe(1);
  });

  // 8. Risoluzione Cache API Offline
  it('8. Cache API offline: quando offline e la risorsa non è in cache, restituisce fallback senza errori', async () => {
    const testUrl = 'https://lpeiyzwccedtqjbficjo.supabase.co/storage/v1/object/public/allegati/giochi/1/test.webp';

    // In ambiente Node/Test con navigator.onLine mockato a false
    const origOnLine = (globalThis as any).navigator?.onLine;
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });

    try {
      const res = await resolveAttachmentSource(testUrl);
      expect(res.isOfflineFallback).toBe(true);
      expect(res.src).toBeNull();
    } finally {
      Object.defineProperty(globalThis.navigator, 'onLine', { value: origOnLine ?? true, configurable: true });
    }
  });

  // 9. CORREZIONE 1: Pulizia File Orfani Sicura (> 24h e NESSUNA riga nemmeno nel cestino)
  it('9. CORREZIONE 1: File appena caricato (<24h) o con riga nel cestino NON viene toccato; file vecchio (>24h) senza riga viene segnalato', async () => {
    // Inserisci un record nel cestino (deleted_at != null)
    await upsertRecords('allegati', [
      {
        id: 'att-in-trash',
        gioco_id: 'g-1',
        ban_id: null,
        canto_id: null,
        evento_id: null,
        storage_path: 'giochi/g-1/file_in_trash.webp',
        nome_file: 'Nel Cestino.webp',
        mime: 'image/webp',
        dimensione: 300 * 1024,
        ordine: 0,
        created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 48 * 3600000).toISOString(),
        deleted_at: new Date().toISOString(), // Nel cestino!
      },
    ]);

    // Mock della list di Supabase Storage
    const origStorage = supabase.storage;
    (supabase as any).storage = {
      from: () => ({
        list: async (folder: string) => {
          if (folder === 'giochi') {
            return { data: [{ id: null, name: 'g-1' }], error: null };
          }
          if (folder === 'giochi/g-1') {
            return {
              data: [
                // 1. File appena caricato (2 ore fa) SENZA riga (es. upload in corso o interrotto)
                {
                  id: 'f1',
                  name: 'file_recent_no_row.webp',
                  created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
                  metadata: { size: 120 * 1024 },
                },
                // 2. File vecchio (48 ore fa) MA con riga nel cestino
                {
                  id: 'f2',
                  name: 'file_in_trash.webp',
                  created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
                  metadata: { size: 300 * 1024 },
                },
                // 3. File vecchio (72 ore fa) SENZA alcuna riga nel database
                {
                  id: 'f3',
                  name: 'file_old_orphan.webp',
                  created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
                  metadata: { size: 450 * 1024 },
                },
              ],
              error: null,
            };
          }
          return { data: [], error: null };
        },
      }),
    };

    try {
      const orphans = await findOrphanStorageFiles();
      // Solo il file 3 (vecchio >24h e senza riga) deve essere segnalato
      expect(orphans.length).toBe(1);
      expect(orphans[0].name).toBe('file_old_orphan.webp');
      expect(orphans[0].path).toBe('giochi/g-1/file_old_orphan.webp');
      expect(orphans[0].ageHours).toBeGreaterThanOrEqual(24);
    } finally {
      (supabase as any).storage = origStorage;
    }
  });

  // 10. CORREZIONE 2: Semantica Ciclo Elimina -> Ripristina -> Elimina Definitivamente
  it('10. CORREZIONE 2: Ciclo elimina (soft) -> ripristina -> elimina definitiva (con rimozione file da Storage)', async () => {
    // 1. Inserisci allegato attivo
    const testAttachment: Allegato = {
      id: 'att-cycle-test',
      gioco_id: 'g-1',
      ban_id: null,
      canto_id: null,
      evento_id: null,
      storage_path: 'giochi/g-1/cycle_photo.webp',
      nome_file: 'Cycle Photo.webp',
      mime: 'image/webp',
      dimensione: 200 * 1024,
      ordine: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    await upsertRecords('allegati', [testAttachment]);

    let storageRemovedPaths: string[] = [];
    const origStorage = supabase.storage;
    (supabase as any).storage = {
      from: () => ({
        remove: async (paths: string[]) => {
          storageRemovedPaths.push(...paths);
          return { data: paths, error: null };
        },
      }),
    };

    const origFrom = supabase.from;
    (supabase as any).from = () => ({
      update: () => ({
        eq: () => ({
          select: async () => ({ data: [{ id: 'mock' }], error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          select: async () => ({ data: [{ id: 'mock' }], error: null }),
        }),
      }),
      rpc: async () => ({ data: 2, error: null }),
    });

    try {
      // A. Soft Delete: deleted_at != null, file FISICO NON rimosso da Storage
      await softDeleteAttachment('att-cycle-test');
      const db = await getDb();
      let row = await db.get('allegati', 'att-cycle-test');
      expect(row.deleted_at).not.toBeNull();
      expect(storageRemovedPaths.length).toBe(0); // File ancora integro in Storage!

      // B. Ripristino dal cestino: deleted_at torna null
      await restoreAttachment('att-cycle-test');
      row = await db.get('allegati', 'att-cycle-test');
      expect(row.deleted_at).toBeNull();
      expect(storageRemovedPaths.length).toBe(0);

      // C. Hard Delete definitivo: file FISICO rimosso da Storage e riga rimossa dal DB
      await hardDeleteAttachment(row);
      expect(storageRemovedPaths).toContain('giochi/g-1/cycle_photo.webp');
      const deletedRow = await db.get('allegati', 'att-cycle-test');
      expect(deletedRow).toBeUndefined();
    } finally {
      (supabase as any).storage = origStorage;
      (supabase as any).from = origFrom;
    }
  });

  // 11. CORREZIONE 3: Cache Offline rimozione per tombstones
  it('11. CORREZIONE 3: removeAttachmentFromCache elimina il file da scout-attachments-v1', async () => {
    let deletedUrl: string | null = null;
    const mockCache = {
      delete: async (url: string) => {
        deletedUrl = url;
        return true;
      },
    };

    (globalThis as any).caches = {
      open: async () => mockCache,
    };

    const removed = await removeAttachmentFromCache('giochi/g-1/test_photo.webp');
    expect(removed).toBe(true);
    expect(deletedUrl).toContain('giochi/g-1/test_photo.webp');
  });

  // 12. CORREZIONE 3: Tetto 150 MB Cache API con rimozione elementi meno recenti e listener quota
  it('12. CORREZIONE 3: enforceAttachmentsCacheCap rimuove i file meno recenti se si supera il tetto di 150 MB e notifica', async () => {
    let quotaAlertFired = false;
    const unsub = onAttachmentsCacheQuotaExceeded(() => {
      quotaAlertFired = true;
    });

    // Mock cache con 2 file: 1 vecchio da 100 MB e 1 recente da 70 MB (totale 170 MB > 150 MB)
    const deletedRequests: any[] = [];
    const mockEntries = [
      {
        req: new Request('http://test/vecchio.webp'),
        size: 100 * 1024 * 1024, // 100 MB
        date: new Date('2026-01-01').toUTCString(),
      },
      {
        req: new Request('http://test/recente.webp'),
        size: 70 * 1024 * 1024, // 70 MB
        date: new Date('2026-10-01').toUTCString(),
      },
    ];

    const mockCache = {
      keys: async () => mockEntries.map((e) => e.req),
      match: async (req: Request) => {
        const found = mockEntries.find((e) => e.req.url === req.url);
        if (!found) return null;
        return {
          blob: async () => new Blob([new Uint8Array(found.size)]),
          headers: new Headers({ date: found.date }),
        };
      },
      delete: async (req: Request) => {
        deletedRequests.push(req.url);
        return true;
      },
    };

    (globalThis as any).caches = {
      open: async () => mockCache,
    };

    try {
      const result = await enforceAttachmentsCacheCap();
      expect(result.evictedCount).toBe(1);
      // Il file più vecchio (100 MB) deve essere stato rimosso
      expect(deletedRequests).toContain('http://test/vecchio.webp');
      expect(deletedRequests).not.toContain('http://test/recente.webp');
      expect(quotaAlertFired).toBe(true);
    } finally {
      unsub();
    }
  });
});
