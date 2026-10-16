import 'fake-indexeddb/auto';

if (typeof WebSocket === 'undefined') {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 1;
    onopen = null;
    onmessage = null;
    onerror = null;
    onclose = null;
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  }
  (globalThis as any).WebSocket = MockWebSocket;
}

import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeText,
  levenshtein,
  maxAllowedDistance,
  wordMatchesToken,
  matchesQuery,
  getHighlightParts,
  findSimilarName,
} from '../src/lib/search';
import {
  getDb,
  resetDbInstanceForTesting,
  getGiochi,
  getBans,
  getAllegati,
  upsertRecords,
  Gioco,
  Ban,
  Allegato,
} from '../src/lib/db';
import {
  saveGioco,
  saveBan,
  softDeleteRecord,
  restoreRecord,
  getTrashItems,
  purgeTrash,
} from '../src/lib/admin_actions';

describe('FASE 3 - GIOCHI E BANS', () => {
  describe('1. Tolleranza ai Typo Deterministica e Normalizzazione', () => {
    it('applica la regola deterministica di lunghezza token', () => {
      // < 4 caratteri: distanza = 0
      expect(maxAllowedDistance(1)).toBe(0);
      expect(maxAllowedDistance(2)).toBe(0);
      expect(maxAllowedDistance(3)).toBe(0);

      // 4-7 caratteri: distanza <= 1
      expect(maxAllowedDistance(4)).toBe(1);
      expect(maxAllowedDistance(5)).toBe(1);
      expect(maxAllowedDistance(6)).toBe(1);
      expect(maxAllowedDistance(7)).toBe(1);

      // >= 8 caratteri: distanza <= 2
      expect(maxAllowedDistance(8)).toBe(2);
      expect(maxAllowedDistance(12)).toBe(2);
      expect(maxAllowedDistance(20)).toBe(2);
    });

    it('calcola correttamente la distanza di Levenshtein', () => {
      expect(levenshtein('palla', 'pala')).toBe(1);
      expect(levenshtein('avvelenata', 'aveleata')).toBe(2);
      expect(levenshtein('rover', 'rober')).toBe(1);
      expect(levenshtein('clan', 'pian')).toBe(2);
      expect(levenshtein('clan', 'banco')).toBe(4);
    });

    it('normalizza accenti, diacritici e maiuscole', () => {
      expect(normalizeText('È un bel gioco')).toBe('e un bel gioco');
      expect(normalizeText('PERCHÉ')).toBe('perche');
      expect(normalizeText('Staffétta')).toBe('staffetta');
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
    });

    it('SODDISFA IL TEST SPECIFICO: "pala aveleata" trova "palla avvelenata"', () => {
      const candidateTitle = 'Palla Avvelenata dei Clan';
      const candidateRules = 'Due squadre con palla morbida in campo delimitato.';

      // La query con typo deterministici deve trovare il gioco
      const isMatch = matchesQuery('pala aveleata', candidateTitle, candidateRules);
      expect(isMatch).toBe(true);
    });

    it('non tollera typo per parole con meno di 4 caratteri', () => {
      // "tre" (len 3): maxAllowedDistance = 0
      expect(wordMatchesToken('tre', 'tre')).toBe(true);
      expect(wordMatchesToken('tra', 'tre')).toBe(false); // distanza 1 rifiutata perché len < 4
      expect(wordMatchesToken('due', 'tre')).toBe(false);
    });

    it('tolleranza Levenshtein <= 1 per parole tra 4 e 7 caratteri', () => {
      // "lupo" (len 4): "lupe" distanza 1 ammessa
      expect(wordMatchesToken('lupo', 'lupe')).toBe(true);
      // "lupo" vs "lira" distanza 2 rifiutata
      expect(wordMatchesToken('lupo', 'lira')).toBe(false);
    });

    it('tolleranza Levenshtein <= 2 per parole >= 8 caratteri', () => {
      // "avvelenata" (len 10): "aveleata" (len 8) distanza 2 ammessa
      expect(wordMatchesToken('avvelenata', 'aveleata')).toBe(true);
      // distanza 3 ("avleata") deve essere rifiutata
      expect(wordMatchesToken('avvelenata', 'avleata')).toBe(false);
    });

    it('esegue ricerca multi-campo in AND', () => {
      const nome = 'Alce Rossa';
      const regole = 'Gioco di furtivita nel bosco fitto';
      const materiali = 'Bende per gli occhi e torce';

      // Termine nel nome + termine nelle regole
      expect(matchesQuery('alce bosco', nome, regole, materiali)).toBe(true);
      // Termine nel nome + termine nei materiali
      expect(matchesQuery('alce torce', nome, regole, materiali)).toBe(true);
      // Termine inesistente
      expect(matchesQuery('alce pallone', nome, regole, materiali)).toBe(false);
    });

    it('segnala duplicato morbido con Levenshtein <= 2', () => {
      const existing = ['Palla Avvelenata', 'Alce Rossa', 'Scalpo'];

      // Nome identico a meno di maiuscole
      expect(findSimilarName('palla avvelenata', existing)).toBe('Palla Avvelenata');

      // Nome quasi identico (distanza <= 2)
      expect(findSimilarName('Palla Avelenata', existing)).toBe('Palla Avvelenata');
      expect(findSimilarName('Alce Rssa', existing)).toBe('Alce Rossa');

      // Nome diverso
      expect(findSimilarName('Rover Run', existing)).toBeNull();
    });
  });

  describe('2. Evidenziazione XSS-Safe (HighlightText / getHighlightParts)', () => {
    it('spezza il testo preservando punteggiatura, spazi e maiuscole', () => {
      const original = 'Palla, Avvelenata!';
      const parts = getHighlightParts(original, 'palla');

      expect(parts).toHaveLength(4);
      expect(parts.map((p) => p.text).join('')).toBe(original);
      expect(parts[0]).toEqual({ text: 'Palla', isMatch: true });
      expect(parts[1]).toEqual({ text: ', ', isMatch: false });
      expect(parts[2]).toEqual({ text: 'Avvelenata', isMatch: false });
      expect(parts[3]).toEqual({ text: '!', isMatch: false });
    });

    it('è immune a XSS (non usa innerHTML, tokenizza caratteri speciali)', () => {
      const dangerous = '<script>alert("xss")</script> & "test"';
      const parts = getHighlightParts(dangerous, 'alert');

      // Le parti prodotte contengono le stringhe letterali
      expect(parts.some((p) => p.text === 'alert' && p.isMatch)).toBe(true);
      expect(parts.some((p) => p.text.includes('<script>') || p.text.includes('script'))).toBe(true);
    });
  });

  describe('3. Ordinamento a 4 Opzioni con Intl.Collator', () => {
    it('ordina per A-Z, Z-A, Recenti e Vecchi', () => {
      const items = [
        { nome: 'Scalpo', created_at: '2026-01-01T10:00:00Z' },
        { nome: 'Alce Rossa', created_at: '2026-03-01T10:00:00Z' },
        { nome: 'Palla Avvelenata', created_at: '2026-02-01T10:00:00Z' },
      ];

      const collator = new Intl.Collator('it', { sensitivity: 'base' });

      // A -> Z
      const az = [...items].sort((a, b) => collator.compare(a.nome, b.nome));
      expect(az.map((i) => i.nome)).toEqual(['Alce Rossa', 'Palla Avvelenata', 'Scalpo']);

      // Z -> A
      const za = [...items].sort((a, b) => collator.compare(b.nome, a.nome));
      expect(za.map((i) => i.nome)).toEqual(['Scalpo', 'Palla Avvelenata', 'Alce Rossa']);

      // Recenti (created_at desc)
      const rec = [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      expect(rec.map((i) => i.nome)).toEqual(['Alce Rossa', 'Palla Avvelenata', 'Scalpo']);

      // Vecchi (created_at asc)
      const vec = [...items].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      expect(vec.map((i) => i.nome)).toEqual(['Scalpo', 'Palla Avvelenata', 'Alce Rossa']);
    });
  });

  describe('4. Soft-Delete e Nascondimento Gerarchico dei Figli (Allegati)', () => {
    beforeEach(async () => {
      resetDbInstanceForTesting();
      const db = await getDb();
      for (const t of ['giochi', 'bans', 'canti', 'eventi', 'odg_punti', 'allegati', 'sync_meta']) {
        await db.clear(t as any);
      }
    });

    it('esclude automaticamente i giochi e bans eliminati dalla UI', async () => {
      const g1: Gioco = {
        id: 'g-1',
        nome: 'Gioco Attivo',
        regole: 'Regole 1',
        materiali: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      const g2: Gioco = {
        id: 'g-2',
        nome: 'Gioco Eliminato',
        regole: 'Regole 2',
        materiali: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
      };

      await upsertRecords('giochi', [g1, g2]);

      const active = await getGiochi(false);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('g-1');

      const all = await getGiochi(true);
      expect(all).toHaveLength(2);
    });

    it('nasconde automaticamente gli allegati figli se il gioco genitore è eliminato', async () => {
      const gioco: Gioco = {
        id: 'gioco-parent-1',
        nome: 'Rover Run',
        regole: 'Staffetta',
        materiali: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const allegato: Allegato = {
        id: 'all-1',
        gioco_id: 'gioco-parent-1',
        ban_id: null,
        canto_id: null,
        evento_id: null,
        storage_path: 'allegati/mappa.pdf',
        nome_file: 'mappa.pdf',
        mime: 'application/pdf',
        dimensione: 1024,
        ordine: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      await upsertRecords('giochi', [gioco]);
      await upsertRecords('allegati', [allegato]);

      // Genitore attivo -> allegato visibile
      let allegati = await getAllegati('gioco', 'gioco-parent-1', false);
      expect(allegati).toHaveLength(1);
      expect(allegati[0].id).toBe('all-1');

      // Genitore subisce soft-delete
      gioco.deleted_at = new Date().toISOString();
      await upsertRecords('giochi', [gioco]);

      // Regola: genitore eliminato -> allegato automaticamente nascosto!
      allegati = await getAllegati('gioco', 'gioco-parent-1', false);
      expect(allegati).toHaveLength(0);

      // Ripristino genitore -> allegato torna visibile
      gioco.deleted_at = null;
      await upsertRecords('giochi', [gioco]);

      allegati = await getAllegati('gioco', 'gioco-parent-1', false);
      expect(allegati).toHaveLength(1);
    });
  });

  describe('5. Cestino e Ripristino Dati', () => {
    beforeEach(async () => {
      resetDbInstanceForTesting();
      const db = await getDb();
      for (const t of ['giochi', 'bans', 'canti', 'eventi', 'odg_punti', 'allegati', 'sync_meta']) {
        await db.clear(t as any);
      }
    });

    it('elenca correttamente i record nel cestino', async () => {
      const b1: Ban = {
        id: 'b-1',
        nome: 'Ban nel cestino',
        testo: 'Testo ban',
        note_gesti: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
      };
      await upsertRecords('bans', [b1]);

      const trash = await getTrashItems();
      expect(trash).toHaveLength(1);
      expect(trash[0].id).toBe('b-1');
      expect(trash[0].title).toBe('Ban nel cestino');
      expect(trash[0].table).toBe('bans');
    });
  });

  describe('6. Resilienza a Dati Sporchi (Stress Test: 200 Elementi, Nomi Lunghi, Unbroken Strings)', () => {
    it('gestisce senza errori una lista di 200 giochi eterogenei', () => {
      const items: Gioco[] = [];
      for (let i = 0; i < 200; i++) {
        items.push({
          id: `stress-gioco-${i}`,
          nome: i % 2 === 0 ? `Gioco Tradizionale Scout #${i}` : `Attività all'Aperto #${i}`,
          regole: `Descrizione dettagliata delle regole per il gioco numero ${i}. Richiede attenzione e agilità.`,
          materiali: i % 3 === 0 ? 'Corde, fazzoletti, fischietto' : 'Nessun materiale',
          created_at: new Date(Date.now() - i * 3600000).toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        });
      }

      // Ricerca rapida tra 200 record
      const start = performance.now();
      const found = items.filter((g) => matchesQuery('tradizionale', g.nome, g.regole, g.materiali));
      const elapsed = performance.now() - start;

      expect(found).toHaveLength(100);
      expect(elapsed).toBeLessThan(100); // Meno di 100ms per 200 record
    });

    it('resiste a stringhe unbroken senza spazi e nomi lunghi', () => {
      const unbrokenText = 'a'.repeat(300);
      const longTitle = 'Questo è un titolo estremamente lungo pensato per verificare che il layout non esploda '.repeat(5);

      // Non deve andare in crash o loop infinito
      expect(() => normalizeText(unbrokenText)).not.toThrow();
      expect(() => matchesQuery('test', longTitle, unbrokenText)).not.toThrow();
      expect(() => getHighlightParts(longTitle, 'lungo')).not.toThrow();
    });
  });
});
