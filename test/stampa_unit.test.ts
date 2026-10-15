import { describe, it, expect, beforeEach } from 'vitest';
import {
  splitSongIntoPages,
  estimatePageOverflow,
  moveItemInArray,
  getItemCharLength,
  loadStampaConfig,
  saveStampaConfig,
  DEFAULT_STAMPA_CONFIG,
  SESSION_STORAGE_SELECTION_KEY,
} from '../src/lib/stampa';
import { Gioco, Ban } from '../src/lib/db';

describe('FASE 6 — Stampa A4: Logica di Paginazione, Overflow e Configurazione', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('1. splitSongIntoPages: divide correttamente il testo ChordPro con varie direttive di salto pagina', () => {
    const singleSong = `{title: Canto Semplice}\n[Re]Questo è un canto di una [Sol]pagina sola`;
    expect(splitSongIntoPages(singleSong)).toHaveLength(1);

    const multiSong = `{title: Canto Lungo}\n[Re]Strofa 1\n{nuova_pagina}\n[Sol]Ritornello pagina 2\n{NP}\n[La]Strofa 3 pagina 3`;
    const pages = splitSongIntoPages(multiSong);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toContain('Strofa 1');
    expect(pages[1]).toContain('Ritornello pagina 2');
    expect(pages[2]).toContain('Strofa 3 pagina 3');

    // Case-insensibile e con spazi
    const variantSong = `Parte A\n   {NuOva_PaGiNa}   \nParte B\n{page_break}\nParte C`;
    expect(splitSongIntoPages(variantSong)).toHaveLength(3);
  });

  it('2. estimatePageOverflow: calcola il font step-down e rileva overflow su pagina A4', () => {
    // Canto breve (10 righe): entra perfettamente a 12pt
    const shortText = Array(10).fill('[Re]Camminiamo sulla [Sol]strada maestra').join('\n');
    const shortRes = estimatePageOverflow(shortText, true, 12);
    expect(shortRes.hasOverflow).toBe(false);
    expect(shortRes.fontSizePt).toBe(12);

    // Canto medio-lungo (28 righe): supera 750pt a 12pt, deve ridurre il font ma entrare
    const medText = Array(28).fill('[Re]Camminiamo sulla [Sol]strada maestra').join('\n');
    const medRes = estimatePageOverflow(medText, true, 12);
    expect(medRes.hasOverflow).toBe(false);
    expect(medRes.fontSizePt).toBeLessThan(12);
    expect(medRes.fontSizePt).toBeGreaterThanOrEqual(9.5);

    // Canto lunghissimo (50 righe su una sola pagina): eccede anche a 9.5pt -> hasOverflow: true
    const overflowText = Array(50).fill('[Re]Camminiamo sulla [Sol]strada maestra con tante parole').join('\n');
    const overflowRes = estimatePageOverflow(overflowText, true, 12);
    expect(overflowRes.hasOverflow).toBe(true);
    expect(overflowRes.fontSizePt).toBe(9.5);
  });

  it('3. moveItemInArray: riordina gli elementi in modo sicuro rispettando i limiti', () => {
    const ids = ['id-1', 'id-2', 'id-3'];

    // Sposta 'id-2' in su (indice 1 -> 0)
    const movedUp = moveItemInArray(ids, 1, 'up');
    expect(movedUp).toEqual(['id-2', 'id-1', 'id-3']);

    // Sposta 'id-2' in giù (indice 1 -> 2)
    const movedDown = moveItemInArray(ids, 1, 'down');
    expect(movedDown).toEqual(['id-1', 'id-3', 'id-2']);

    // Limiti: sposta primo elemento in su non altera l'array
    const boundaryUp = moveItemInArray(ids, 0, 'up');
    expect(boundaryUp).toEqual(ids);

    // Limiti: sposta ultimo elemento in giù non altera l'array
    const boundaryDown = moveItemInArray(ids, 2, 'down');
    expect(boundaryDown).toEqual(ids);
  });

  it('4. getItemCharLength: calcola la lunghezza e distingue elementi brevi (<600) e lunghi (>=600)', () => {
    const shortGioco: Gioco = {
      id: 'g1',
      nome: 'Roverino',
      materiali: '1 cerchio di corda',
      regole: 'Passarsi il cerchio senza farlo cadere.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    const shortLen = getItemCharLength(shortGioco);
    expect(shortLen).toBeLessThan(600);

    const longGioco: Gioco = {
      id: 'g2',
      nome: 'Grande Gioco Notturno delle Squadriglie e dei Clan',
      materiali: 'Mappe, torce, lanterne, indizi su pergamena, cartelli di orientamento',
      regole: 'A'.repeat(650),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    const longLen = getItemCharLength(longGioco);
    expect(longLen).toBeGreaterThanOrEqual(600);

    const ban: Ban = {
      id: 'b1',
      nome: 'Ciunga ciunga',
      note_gesti: 'Battere le mani sul petto e gridare',
      testo: 'Testo del ban ritmato e divertente',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    expect(getItemCharLength(ban)).toBeLessThan(600);
  });

  it('5. loadStampaConfig e saveStampaConfig: persistono le selezioni in sessionStorage', () => {
    // Default se sessionStorage vuoto
    const initial = loadStampaConfig();
    expect(initial).toEqual(DEFAULT_STAMPA_CONFIG);

    const customConfig = {
      selectedGiochiIds: ['g-1', 'g-2'],
      selectedBansIds: ['b-1'],
      selectedCantiIds: ['c-1', 'c-2', 'c-3'],
      includeImages: true,
      includeCoverAndIndex: true,
    };
    saveStampaConfig(customConfig);

    const loaded = loadStampaConfig();
    expect(loaded).toEqual(customConfig);
    expect(sessionStorage.getItem(SESSION_STORAGE_SELECTION_KEY)).toBeTruthy();
  });
});
