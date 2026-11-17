// test/vademecum.test.ts
// Test per il modulo Vademecum: Carta di Clan, Regole del Clan e Canovacci per Pattuglie

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  getVademecumItems,
  getVademecumItem,
  saveVademecumItem,
  deleteVademecumItem,
} from '../src/lib/vademecum';

describe('Vademecum e Regole del Clan (Carta, Regole, Canovacci)', () => {
  it('Carica i documenti predefiniti con Carta di Clan, Regole e Canovacci', async () => {
    const items = await getVademecumItems();
    expect(items.length).toBeGreaterThanOrEqual(3);

    const carta = items.find((d) => d.section === 'carta_clan');
    expect(carta).toBeDefined();
    expect(carta?.titolo).toBe('Carta di Clan');
    expect(carta?.descrizioneBreve).toContain('valori');
    expect(carta?.contenuto).toContain('STRADA');

    const regole = items.find((d) => d.section === 'regole_clan');
    expect(regole).toBeDefined();
    expect(regole?.titolo).toBe('Regole del Clan');
    expect(regole?.contenuto).toContain('PUNTUALITÀ');

    const canovacci = items.filter((d) => d.section === 'canovaccio');
    expect(canovacci.length).toBeGreaterThanOrEqual(1);
  });

  it('Recupera un singolo elemento per ID', async () => {
    const carta = await getVademecumItem('carta_clan');
    expect(carta).not.toBeNull();
    expect(carta?.id).toBe('carta_clan');
    expect(carta?.titolo).toBe('Carta di Clan');
  });

  it('Consente la modifica della Carta di Clan da parte dell\'admin', async () => {
    const updated = await saveVademecumItem({
      id: 'carta_clan',
      section: 'carta_clan',
      titolo: 'Carta di Clan 2026-2027',
      descrizioneBreve: 'Patto comunitario rinnovato ad Assisi',
      contenuto: 'Nuovo testo della Carta approvato dalla Comunità.',
    });

    expect(updated.titolo).toBe('Carta di Clan 2026-2027');
    expect(updated.descrizioneBreve).toBe('Patto comunitario rinnovato ad Assisi');

    const retrieved = await getVademecumItem('carta_clan');
    expect(retrieved?.titolo).toBe('Carta di Clan 2026-2027');
    expect(retrieved?.contenuto).toBe('Nuovo testo della Carta approvato dalla Comunità.');
  });

  it('Consente di allegare un PDF a un Canovaccio (es. PowerPoint esportato in PDF)', async () => {
    const newCanovaccio = await saveVademecumItem({
      section: 'canovaccio',
      titolo: 'Presentazione Hike Majella',
      descrizioneBreve: 'Slide per l\'uscita invernale di pattuglia',
      contenuto: 'Traccia e punti di sosta.',
      pdfNome: 'Hike_Majella_2026.pdf',
      pdfDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...',
      pdfSize: 1048576, // 1 MB
    });

    expect(newCanovaccio.id).toContain('canovaccio_');
    expect(newCanovaccio.pdfNome).toBe('Hike_Majella_2026.pdf');
    expect(newCanovaccio.pdfSize).toBe(1048576);

    const items = await getVademecumItems();
    const found = items.find((d) => d.id === newCanovaccio.id);
    expect(found).toBeDefined();
    expect(found?.pdfNome).toBe('Hike_Majella_2026.pdf');
  });

  it('Consente l\'eliminazione di un canovaccio', async () => {
    const toDelete = await saveVademecumItem({
      section: 'canovaccio',
      titolo: 'Canovaccio Temporaneo',
      descrizioneBreve: 'Da rimuovere',
      contenuto: 'Test.',
    });

    await deleteVademecumItem(toDelete.id);

    const items = await getVademecumItems();
    const found = items.find((d) => d.id === toDelete.id);
    expect(found).toBeUndefined();
  });

  it('Consente di impostare e rimuovere la foto di copertina per la Carta di Clan', async () => {
    const updated = await saveVademecumItem({
      id: 'carta_clan',
      section: 'carta_clan',
      titolo: 'Carta di Clan',
      descrizioneBreve: 'Con foto personalizzata',
      contenuto: 'Testo',
      fotoCopertinaUrl: 'data:image/webp;base64,UklGR...',
    });

    expect(updated.fotoCopertinaUrl).toBe('data:image/webp;base64,UklGR...');

    const retrieved = await getVademecumItem('carta_clan');
    expect(retrieved?.fotoCopertinaUrl).toBe('data:image/webp;base64,UklGR...');

    // Rimozione foto copertina (ripristino predefinita)
    const reset = await saveVademecumItem({
      id: 'carta_clan',
      section: 'carta_clan',
      titolo: 'Carta di Clan',
      descrizioneBreve: 'Con foto personalizzata',
      contenuto: 'Testo',
      fotoCopertinaUrl: null,
    });
    expect(reset.fotoCopertinaUrl).toBeNull();
  });
});
