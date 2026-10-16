// test/calendario_odg.test.ts
// Test unitari completi per la logica del Calendario Clan e Ordine del Giorno (ODG)
// Include test per mesi da 28, 29, 30, 31 gg, ora legale (marzo/ottobre), multi-day,
// riporto ODG con riportato_da, ordinamento su/giù e soft-delete gerarchica.

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDaysInMonth,
  buildMonthGrid,
  isEventOnDate,
  formatDateKey,
  parseDateOnly,
  getWallCalendarDate,
  getEventCountdownText,
  formatEventDateTimeRange,
  getEventTypeInfo,
  countOpenOdgPoints,
} from '../src/lib/calendario';
import { Evento, OdgPunto, getDb, resetDbInstanceForTesting, getOdgPunti, upsertRecords } from '../src/lib/db';
import { saveEvento, forwardUnfinishedOdgPunti, findNextFutureMeeting } from '../src/lib/admin_actions';
import { supabase } from '../src/lib/supabase';

describe('Calendario & ODG - Test Logica di Dominio', () => {
  beforeEach(async () => {
    resetDbInstanceForTesting();
    const db = await getDb();
    await db.clear('eventi');
    await db.clear('odg_punti');
    vi.restoreAllMocks();
  });

  describe('1. Calcolo Mesi e Generazione Griglia (28, 29, 30, 31 giorni)', () => {
    it('calcola correttamente i giorni per febbraio bisestile (29) e non bisestile (28)', () => {
      // 2024 è bisestile -> Febbraio ha 29 giorni
      expect(getDaysInMonth(2024, 1)).toBe(29);
      // 2023 non è bisestile -> Febbraio ha 28 giorni
      expect(getDaysInMonth(2023, 1)).toBe(28);
      // 2000 è bisestile (secolare divisibile per 400) -> 29
      expect(getDaysInMonth(2000, 1)).toBe(29);
      // 2100 non è bisestile (secolare non divisibile per 400) -> 28
      expect(getDaysInMonth(2100, 1)).toBe(28);
    });

    it('calcola correttamente i mesi da 30 e 31 giorni', () => {
      expect(getDaysInMonth(2026, 3)).toBe(30); // Aprile
      expect(getDaysInMonth(2026, 5)).toBe(30); // Giugno
      expect(getDaysInMonth(2026, 8)).toBe(30); // Settembre
      expect(getDaysInMonth(2026, 10)).toBe(30); // Novembre

      expect(getDaysInMonth(2026, 0)).toBe(31); // Gennaio
      expect(getDaysInMonth(2026, 2)).toBe(31); // Marzo
      expect(getDaysInMonth(2026, 4)).toBe(31); // Maggio
      expect(getDaysInMonth(2026, 6)).toBe(31); // Luglio
      expect(getDaysInMonth(2026, 7)).toBe(31); // Agosto
      expect(getDaysInMonth(2026, 9)).toBe(31); // Ottobre
      expect(getDaysInMonth(2026, 11)).toBe(31); // Dicembre
    });

    it('genera griglia con inizio settimana rigorosamente Lunedì e settimane complete da 7 celle', () => {
      // Ottobre 2026: 1 Ottobre 2026 è Giovedì
      // Settimana 1: Lunedì 28 Set, Martedì 29 Set, Mercoledì 30 Set, Giovedì 1 Ott ... Domenica 4 Ott
      const grid = buildMonthGrid(2026, 9, []); // Ottobre = mese 9
      expect(grid.monthName).toBe('Ottobre');
      expect(grid.weeks.length).toBeGreaterThanOrEqual(4);

      for (const week of grid.weeks) {
        expect(week.length).toBe(7);
        // Primo giorno della settimana deve essere Lunedì (getDay() === 1)
        expect(week[0]!.date.getDay()).toBe(1);
        // Ultimo giorno della settimana deve essere Domenica (getDay() === 0)
        expect(week[6]!.date.getDay()).toBe(0);
      }

      // Verifica che la prima cella della prima settimana sia 28 Settembre
      expect(grid.weeks[0]![0]!.dayNumber).toBe(28);
      expect(grid.weeks[0]![0]!.isCurrentMonth).toBe(false);

      // Cella 3 (Giovedì) deve essere 1 Ottobre
      expect(grid.weeks[0]![3]!.dayNumber).toBe(1);
      expect(grid.weeks[0]![3]!.isCurrentMonth).toBe(true);
    });
  });

  describe('2. Gestione Transizioni Ora Legale (Marzo e Ottobre)', () => {
    it('non sfasano le date solari durante la transizione di fine Marzo (CET -> CEST, 23 ore)', () => {
      // In Italia a fine Marzo c'è il cambio ora legale (la notte perde 1 ora)
      const grid = buildMonthGrid(2026, 2, []); // Marzo 2026
      const flatCells = grid.weeks.flat();

      // Trova le celle dal 28 al 31 Marzo
      const marchCells = flatCells.filter((c) => c.isCurrentMonth && c.dayNumber >= 28);
      expect(marchCells.length).toBe(4);
      expect(marchCells.map((c) => c.dayNumber)).toEqual([28, 29, 30, 31]);
      // I dateString devono essere perfettamente progressivi
      expect(marchCells.map((c) => c.dateString)).toEqual([
        '2026-03-28',
        '2026-03-29',
        '2026-03-30',
        '2026-03-31',
      ]);
    });

    it('non sfasano le date solari durante la transizione di fine Ottobre (CEST -> CET, 25 ore)', () => {
      // In Italia a fine Ottobre c'è il ritorno all'ora solare (la notte guadagna 1 ora)
      const grid = buildMonthGrid(2026, 9, []); // Ottobre 2026
      const flatCells = grid.weeks.flat();

      const octCells = flatCells.filter((c) => c.isCurrentMonth && c.dayNumber >= 24 && c.dayNumber <= 27);
      expect(octCells.map((c) => c.dayNumber)).toEqual([24, 25, 26, 27]);
      expect(octCells.map((c) => c.dateString)).toEqual([
        '2026-10-24',
        '2026-10-25',
        '2026-10-26',
        '2026-10-27',
      ]);
    });
  });

  describe('3. Eventi Multi-Day e Tutto il Giorno', () => {
    const multiDayEvent: Evento = {
      id: 'ev_uscita_sibillini',
      titolo: 'Uscita dei Passaggi',
      tipo: 'uscita',
      inizio: '2026-10-18T08:00:00.000Z',
      fine: '2026-10-20T17:00:00.000Z',
      tutto_il_giorno: false,
      luogo: 'Monte Vettore',
      descrizione: 'Trekking di 3 giorni',
      responsabile: 'Capi Clan',
      cosa_portare: 'Tenda, sacco a pelo',
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
      deleted_at: null,
    };

    it('isEventOnDate restituisce true per tutti i giorni dell\'intervallo e false per quelli fuori', () => {
      expect(isEventOnDate(multiDayEvent, '2026-10-17')).toBe(false);
      expect(isEventOnDate(multiDayEvent, '2026-10-18')).toBe(true); // giorno 1
      expect(isEventOnDate(multiDayEvent, '2026-10-19')).toBe(true); // giorno 2
      expect(isEventOnDate(multiDayEvent, '2026-10-20')).toBe(true); // giorno 3
      expect(isEventOnDate(multiDayEvent, '2026-10-21')).toBe(false);
    });

    it('gestisce correttamente eventi a cavallo di due mesi', () => {
      const crossMonthEvent: Evento = {
        ...multiDayEvent,
        inizio: '2026-10-30T10:00:00.000Z',
        fine: '2026-11-02T16:00:00.000Z',
      };

      expect(isEventOnDate(crossMonthEvent, '2026-10-29')).toBe(false);
      expect(isEventOnDate(crossMonthEvent, '2026-10-30')).toBe(true);
      expect(isEventOnDate(crossMonthEvent, '2026-10-31')).toBe(true);
      expect(isEventOnDate(crossMonthEvent, '2026-11-01')).toBe(true);
      expect(isEventOnDate(crossMonthEvent, '2026-11-02')).toBe(true);
      expect(isEventOnDate(crossMonthEvent, '2026-11-03')).toBe(false);
    });

    it('formatEventDateTimeRange gestisce correttamente tutto_il_giorno', () => {
      const allDaySingle: Evento = {
        ...multiDayEvent,
        fine: null,
        tutto_il_giorno: true,
      };
      const textSingle = formatEventDateTimeRange(allDaySingle);
      expect(textSingle).toContain('Tutto il giorno');

      const allDayMulti: Evento = {
        ...multiDayEvent,
        tutto_il_giorno: true,
      };
      const textMulti = formatEventDateTimeRange(allDayMulti);
      expect(textMulti).toContain('Tutto il giorno');
      expect(textMulti).toContain('–');
    });

    it('CORREZIONE 6: buildMonthGrid include l\'evento multi-day in tutte le rispettive celle giornaliere', () => {
      const grid = buildMonthGrid(2026, 9, [multiDayEvent]); // Ottobre 2026
      const flatCells = grid.weeks.flat();
      const cell18 = flatCells.find((c) => c.dateString === '2026-10-18');
      const cell19 = flatCells.find((c) => c.dateString === '2026-10-19');
      const cell20 = flatCells.find((c) => c.dateString === '2026-10-20');
      const cell21 = flatCells.find((c) => c.dateString === '2026-10-21');

      expect(cell18?.events.length).toBe(1);
      expect(cell19?.events.length).toBe(1);
      expect(cell20?.events.length).toBe(1);
      expect(cell21?.events.length).toBe(0);
    });
  });

  describe('4. Logica ODG: Conteggio Punti Aperti e Spunta Animata', () => {
    it('countOpenOdgPoints conta solo i punti non completati e non eliminati', () => {
      const punti: OdgPunto[] = [
        { id: '1', evento_id: 'e1', testo: 'Punto 1', ordine: 0, completato: true, riportato_da: null, created_at: '', updated_at: '', deleted_at: null },
        { id: '2', evento_id: 'e1', testo: 'Punto 2', ordine: 1, completato: false, riportato_da: null, created_at: '', updated_at: '', deleted_at: null },
        { id: '3', evento_id: 'e1', testo: 'Punto 3', ordine: 2, completato: false, riportato_da: null, created_at: '', updated_at: '', deleted_at: '2026-10-15T00:00:00Z' },
        { id: '4', evento_id: 'e1', testo: 'Punto 4', ordine: 3, completato: false, riportato_da: null, created_at: '', updated_at: '', deleted_at: null },
      ];

      // Punto 1 è completato; punto 3 è eliminato -> aperti sono solo punto 2 e punto 4 (2 punti)
      expect(countOpenOdgPoints(punti)).toBe(2);
    });
  });

  describe('5. Validazione Date Evento', () => {
    it('rifiuta salvataggio di un evento con fine antecedente all\'inizio', async () => {
      await expect(
        saveEvento({
          titolo: 'Evento con date errate',
          tipo: 'riunione',
          inizio: '2026-10-20T18:00:00.000Z',
          fine: '2026-10-20T17:00:00.000Z', // 1 ora prima dell'inizio!
        })
      ).rejects.toThrow();
    });
  });

  describe('6. Riporto Punti ODG Non Conclusi e Vincolo riportato_da', () => {
    it('trova la prossima riunione futura corretta', async () => {
      const now = new Date();

      const pastMeeting: Evento = {
        id: 'r_past',
        titolo: 'Riunione Passata',
        tipo: 'riunione',
        inizio: new Date(now.getTime() - 86400000).toISOString(),
        fine: null,
        tutto_il_giorno: false,
        luogo: 'Sede',
        descrizione: null,
        responsabile: null,
        cosa_portare: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        deleted_at: null,
      };

      const nextMeeting: Evento = {
        id: 'r_next',
        titolo: 'Riunione Futura Immediata',
        tipo: 'riunione',
        inizio: new Date(now.getTime() + 86400000).toISOString(),
        fine: null,
        tutto_il_giorno: false,
        luogo: 'Sede',
        descrizione: null,
        responsabile: null,
        cosa_portare: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        deleted_at: null,
      };

      const futureEventNonMeeting: Evento = {
        id: 'e_future_uscita',
        titolo: 'Uscita Futura',
        tipo: 'uscita', // Non riunione!
        inizio: new Date(now.getTime() + 40000000).toISOString(),
        fine: null,
        tutto_il_giorno: false,
        luogo: 'Bosco',
        descrizione: null,
        responsabile: null,
        cosa_portare: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        deleted_at: null,
      };

      await upsertRecords('eventi', [pastMeeting, nextMeeting, futureEventNonMeeting]);

      const found = await findNextFutureMeeting(pastMeeting.inizio);
      expect(found).not.toBeNull();
      expect(found?.id).toBe('r_next');
    });

    it('clona i punti non completati con riportato_da impostato sul punto originario', async () => {
      // Mock Supabase per inserimento isolato
      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'odg_punti') {
          return {
            insert: (payload: any) => ({
              select: () => ({
                single: async () => ({ data: payload, error: null }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const e1Id = 'ev_riunione_1';
      const e2Id = 'ev_riunione_2';

      const ev1: Evento = {
        id: e1Id,
        titolo: 'Prima Riunione',
        tipo: 'riunione',
        inizio: '2026-10-10T18:00:00Z',
        fine: null,
        tutto_il_giorno: false,
        luogo: null,
        descrizione: null,
        responsabile: null,
        cosa_portare: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const ev2: Evento = {
        id: e2Id,
        titolo: 'Seconda Riunione',
        tipo: 'riunione',
        inizio: '2026-10-17T18:00:00Z',
        fine: null,
        tutto_il_giorno: false,
        luogo: null,
        descrizione: null,
        responsabile: null,
        cosa_portare: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      await upsertRecords('eventi', [ev1, ev2]);

      const p1: OdgPunto = {
        id: 'p1_fatto',
        evento_id: e1Id,
        testo: 'Verifica cassa (Completato)',
        ordine: 0,
        completato: true,
        riportato_da: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const p2: OdgPunto = {
        id: 'p2_aperto',
        evento_id: e1Id,
        testo: 'Scelta argomento capitolo (Da concludere)',
        ordine: 1,
        completato: false,
        riportato_da: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const p3Existing: OdgPunto = {
        id: 'p3_existing_target',
        evento_id: e2Id,
        testo: 'Preghiera iniziale',
        ordine: 0,
        completato: false,
        riportato_da: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      await upsertRecords('odg_punti', [p1, p2, p3Existing]);

      const countForwarded = await forwardUnfinishedOdgPunti(e1Id, e2Id);
      expect(countForwarded).toBe(1); // Solo p2 doveva essere riportato!

      const targetPoints = await getOdgPunti(e2Id, false);
      expect(targetPoints.length).toBe(2);

      const forwardedPoint = targetPoints.find((p) => p.testo === p2.testo);
      expect(forwardedPoint).toBeDefined();
      expect(forwardedPoint?.riportato_da).toBe(p2.id); // Vincolo riportato_da rispettato!
      expect(forwardedPoint?.completato).toBe(false);
      expect(forwardedPoint?.ordine).toBeGreaterThan(p3Existing.ordine);

      // CORREZIONE 3: Secondo riporto consecutivo (o doppio click) è IDEMPOTENTE!
      const countSecondForward = await forwardUnfinishedOdgPunti(e1Id, e2Id);
      expect(countSecondForward).toBe(0); // Nessun duplicato creato!

      const targetPointsAfterSecond = await getOdgPunti(e2Id, false);
      expect(targetPointsAfterSecond.length).toBe(2); // Invariato!
    });

    it('CORREZIONE 3: findNextFutureMeeting restituisce null se non esistono riunioni future', async () => {
      // Data nel futuro lontano per cui non esiste alcuna riunione successiva
      const currentInizio = '2030-12-31T20:00:00Z';
      const next = await findNextFutureMeeting(currentInizio);
      expect(next).toBeNull();
    });
  });

  describe('7. Soft-Delete Gerarchica per Eventi e ODG', () => {
    it('nasconde automaticamente i punti ODG quando l\'evento genitore ha deleted_at != null', async () => {
      const evento: Evento = {
        id: 'ev_del_test',
        titolo: 'Evento Eliminato',
        tipo: 'riunione',
        inizio: '2026-10-15T18:00:00Z',
        fine: null,
        tutto_il_giorno: false,
        luogo: null,
        descrizione: null,
        responsabile: null,
        cosa_portare: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const punto: OdgPunto = {
        id: 'odg_child_test',
        evento_id: evento.id,
        testo: 'Punto figlio',
        ordine: 0,
        completato: false,
        riportato_da: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      await upsertRecords('eventi', [evento]);
      await upsertRecords('odg_punti', [punto]);

      // 1. Con genitore attivo, il punto è visibile
      const initialPoints = await getOdgPunti(evento.id, false);
      expect(initialPoints.length).toBe(1);
      expect(initialPoints[0]?.id).toBe('odg_child_test');

      // 2. Soft-delete del genitore
      evento.deleted_at = new Date().toISOString();
      await upsertRecords('eventi', [evento]);

      // 3. Il punto ODG scompare dalla query UI (soft-delete gerarchica)
      const pointsAfterParentDelete = await getOdgPunti(evento.id, false);
      expect(pointsAfterParentDelete.length).toBe(0);

      // 4. Ripristino del genitore
      evento.deleted_at = null;
      await upsertRecords('eventi', [evento]);

      // 5. Il punto ODG ricompare
      const pointsAfterRestore = await getOdgPunti(evento.id, false);
      expect(pointsAfterRestore.length).toBe(1);
      expect(pointsAfterRestore[0]?.id).toBe('odg_child_test');
    });
  });
});
