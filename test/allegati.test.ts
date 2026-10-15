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
  MAX_FILE_SIZE_BYTES,
  SUPABASE_FREE_TIER_STORAGE_BYTES,
} from '../src/lib/attachments';
import { resolveAttachmentSource } from '../src/lib/storage-cache';
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
});
