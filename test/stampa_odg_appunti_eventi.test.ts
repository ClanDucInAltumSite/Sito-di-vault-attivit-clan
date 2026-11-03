// test/stampa_odg_appunti_eventi.test.ts
// Test per la sezione Stampa ODG, Appunti ed Eventi:
// 1. Divisione delle categorie (ODG, Appunti, Eventi)
// 2. Persistenza configurazione e caricamento dati con quaderno e appunti
// 3. Regole CSS per nascondere i contenitori di anteprima a schermo
// 4. Regola di eliminazione automatica degli eventi e ODG passati da più di 30 giorni
// 5. Verifica assenza di switch rumorosi e assenza di barre inferiori duplicate

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_STAMPA_ODG_CONFIG,
  loadStampaOdgConfig,
  saveStampaOdgConfig,
  loadPrintableODGData,
  isEventOlderThan30Days,
} from '../src/lib/stampa_odg';
import { getDb, Evento, QuadernoPagina } from '../src/lib/db';

describe('Stampa ODG, Appunti ed Eventi — Test Unitari', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  it('1. loadStampaOdgConfig restituisce i default con activeSubTab odg e array separati', () => {
    const config = loadStampaOdgConfig();
    expect(config.activeSubTab).toBe('odg');
    expect(config.selectedOdgIds).toEqual([]);
    expect(config.selectedQuadernoIds).toEqual([]);
    expect(config.selectedEventiIds).toEqual([]);
  });

  it('2. saveStampaOdgConfig e loadStampaOdgConfig persistono la configurazione isolata in sessionStorage', () => {
    const customConfig = {
      ...DEFAULT_STAMPA_ODG_CONFIG,
      selectedOdgIds: ['riunione_1'],
      selectedQuadernoIds: ['quad_1'],
      selectedEventiIds: ['uscita_1'],
      activeSubTab: 'quaderno' as const,
    };
    saveStampaOdgConfig(customConfig);

    const loaded = loadStampaOdgConfig();
    expect(loaded.selectedOdgIds).toEqual(['riunione_1']);
    expect(loaded.selectedQuadernoIds).toEqual(['quad_1']);
    expect(loaded.selectedEventiIds).toEqual(['uscita_1']);
    expect(loaded.activeSubTab).toBe('quaderno');
  });

  it('3. isEventOlderThan30Days filtra correttamente gli eventi passati da più di 30 giorni', () => {
    const now = new Date();

    // Evento di 35 giorni fa -> eliminato (true)
    const d35DaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(isEventOlderThan30Days(d35DaysAgo)).toBe(true);

    // Evento di 10 giorni fa -> mantenuto (false)
    const d10DaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(isEventOlderThan30Days(d10DaysAgo)).toBe(false);

    // Evento futuro (tra 5 giorni) -> mantenuto (false)
    const dFuture = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(isEventOlderThan30Days(dFuture)).toBe(false);

    // Data nulla o indefinita -> false
    expect(isEventOlderThan30Days(null)).toBe(false);
    expect(isEventOlderThan30Days('')).toBe(false);
  });

  it('4. loadPrintableODGData popola appunti, cosaPortare e carica le pagine del quaderno per activeSubTab', async () => {
    const db = await getDb();

    const evUscita: Evento = {
      id: 'ev_uscita_test',
      titolo: 'Route Estiva Dolomiti',
      tipo: 'uscita',
      inizio: '2026-08-10T08:00:00.000Z',
      fine: '2026-08-17T18:00:00.000Z',
      tutto_il_giorno: false,
      luogo: 'Val di Fassa',
      descrizione: 'Itinerario in quota',
      responsabile: 'Akela e Bagheera',
      cosa_portare: 'Scarponi, zaino 60L, sacco a pelo pesante',
      appunti: 'Verbale accordi logistici presi in staff',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };
    await db.put('eventi', evUscita);

    const quadPagina: QuadernoPagina = {
      id: 'quad_pagina_test',
      data: '2026-08-11',
      titolo: 'Verifica del Cammino',
      categoria: 'verifica',
      contenuto: 'Riflessioni sulla prima tappa: condivisione e fatica.',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };
    await db.put('quaderno', quadPagina);

    // Test tab quaderno
    const datasetQuaderno = await loadPrintableODGData({
      selectedEventiIds: [],
      selectedQuadernoIds: ['quad_pagina_test'],
      activeSubTab: 'quaderno',
    });

    expect(datasetQuaderno.quadernoPagine.length).toBe(1);
    expect(datasetQuaderno.quadernoPagine[0]!.titolo).toBe('Verifica del Cammino');
    expect(datasetQuaderno.totalSelected).toBe(1);

    // Test tab eventi
    const datasetEventi = await loadPrintableODGData({
      selectedEventiIds: ['ev_uscita_test'],
      activeSubTab: 'eventi',
    });

    expect(datasetEventi.eventi.length).toBe(1);
    expect(datasetEventi.eventi[0]!.cosaPortare).toBe('Scarponi, zaino 60L, sacco a pelo pesante');
    expect(datasetEventi.totalSelected).toBe(1);
  });

  it('5. Verifica regole CSS print.css: anteprime a schermo nascoste per tutti e 3 i flussi', () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/print.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Regola @media screen che nasconde i contenitori di stampa a schermo
    const screenMediaMatch = cssContent.match(/@media screen\s*\{([\s\S]*?)\}/);
    expect(screenMediaMatch).toBeTruthy();
    const screenBlock = screenMediaMatch![1]!;

    expect(screenBlock).toContain('.stampa-print-container-canzoni');
    expect(screenBlock).toContain('.stampa-print-container-giochibans');
    expect(screenBlock).toContain('.stampa-print-container-odg');
    expect(screenBlock).toMatch(/display:\s*none\s*!important/);

    // Regola @media print che invece li mostra a tutta larghezza
    expect(cssContent).toMatch(
      /\.stampa-print-container-giochibans,\s*\.stampa-print-container-odg\s*\{[^}]*display:\s*block\s*!important/
    );
  });

  it('6. Verifica rimozione switch rumorosi e rimozione barra inferiore duplicata', () => {
    const odgTsxPath = path.resolve(process.cwd(), 'src/features/stampa/StampaOdg.tsx');
    const odgContent = fs.readFileSync(odgTsxPath, 'utf-8');

    // Nessun ToggleSwitch deve essere presente in StampaOdg
    expect(odgContent).not.toContain('<ToggleSwitch');
    expect(odgContent).not.toContain('ToggleSwitch');

    // Nessuna sticky bottom bar duplicata in StampaOdg
    expect(odgContent).not.toContain('stampa-sticky-bottom-bar');

    const giochiTsxPath = path.resolve(process.cwd(), 'src/features/stampa/StampaGiochiBans.tsx');
    const giochiContent = fs.readFileSync(giochiTsxPath, 'utf-8');

    // Nessuna sticky bottom bar duplicata in StampaGiochiBans (il tasto è solo sopra)
    expect(giochiContent).not.toContain('stampa-sticky-bottom-bar');
  });

  it('7. loadPrintableODGData in modalità generale supporta la stampa combinata di ODG, Quaderno ed Eventi insieme', async () => {
    const db = await getDb();

    const evRiunione: Evento = {
      id: 'ev_riunione_combo',
      titolo: 'Consiglio di Clan',
      tipo: 'riunione',
      inizio: '2026-11-25T20:30:00.000Z',
      fine: null,
      tutto_il_giorno: false,
      luogo: 'Sede Scout',
      descrizione: 'ODG preparatorio per il campo invernale',
      responsabile: 'Capo Clan',
      cosa_portare: null,
      appunti: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };
    await db.put('eventi', evRiunione);

    const quadPaginaCombo: QuadernoPagina = {
      id: 'quad_combo_test',
      data: '2026-11-26',
      titolo: 'Carta di Clan e Regole',
      categoria: 'veglia',
      contenuto: 'Valori fondamentali del clan e stile di strada.',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };
    await db.put('quaderno', quadPaginaCombo);

    const evUscitaCombo: Evento = {
      id: 'ev_uscita_combo',
      titolo: 'Uscita di Natale',
      tipo: 'uscita',
      inizio: '2026-12-20T08:00:00.000Z',
      fine: '2026-12-21T16:00:00.000Z',
      tutto_il_giorno: false,
      luogo: 'Rifugio Pomilio',
      descrizione: 'Pernotto e veglia di Natale',
      responsabile: 'Staff',
      cosa_portare: 'Sacco a pelo, torcia, tazza',
      appunti: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };
    await db.put('eventi', evUscitaCombo);

    // Stampa combinata: 1 ODG + 1 Pagina Quaderno di Clan + 1 Evento
    const comboDataset = await loadPrintableODGData({
      selectedOdgIds: ['ev_riunione_combo'],
      selectedQuadernoIds: ['quad_combo_test'],
      selectedEventiIds: ['ev_uscita_combo'],
    });

    expect(comboDataset.odgItems.length).toBe(1);
    expect(comboDataset.odgItems[0]!.evento.titolo).toBe('Consiglio di Clan');

    expect(comboDataset.quadernoPagine.length).toBe(1);
    expect(comboDataset.quadernoPagine[0]!.titolo).toBe('Carta di Clan e Regole');

    expect(comboDataset.eventiItems.length).toBe(1);
    expect(comboDataset.eventiItems[0]!.cosaPortare).toBe('Sacco a pelo, torcia, tazza');

    // Totale elementi selezionati combinati = 3
    expect(comboDataset.totalSelected).toBe(3);
  });

  it('8. Verifica che il bottone di stampa sia posizionato a destra del titolo con flexWrap nowrap e tab Quaderno di Clan', () => {
    // 1. StampaOdg
    const odgContent = fs.readFileSync(path.resolve(process.cwd(), 'src/features/stampa/StampaOdg.tsx'), 'utf-8');
    expect(odgContent).toContain("flexWrap: 'nowrap'");
    expect(odgContent).toContain("style={{ flexShrink: 0 }}");
    expect(odgContent).toContain("ODG delle riunioni");
    expect(odgContent).toContain("Quaderno di Clan");

    // 2. StampaView
    const viewContent = fs.readFileSync(path.resolve(process.cwd(), 'src/features/stampa/StampaView.tsx'), 'utf-8');
    expect(viewContent).toContain("ODG, Quaderno ed Eventi");

    // 3. StampaCanzoni (spostato accanto al titolo "Canzoniere A4")
    const canzoniContent = fs.readFileSync(path.resolve(process.cwd(), 'src/features/stampa/StampaCanzoni.tsx'), 'utf-8');
    expect(canzoniContent).toContain("flexWrap: 'nowrap'");
    expect(canzoniContent).toContain("style={{ flexShrink: 0 }}");

    // 4. StampaGiochiBans
    const giochiContent = fs.readFileSync(path.resolve(process.cwd(), 'src/features/stampa/StampaGiochiBans.tsx'), 'utf-8');
    expect(giochiContent).toContain("flexWrap: 'nowrap'");
    expect(giochiContent).toContain("style={{ flexShrink: 0 }}");
  });
});

