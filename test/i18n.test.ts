import { describe, it, expect } from 'vitest';
import { I18N } from '../src/lib/i18n';

describe('Dizionario di Internazionalizzazione (I18N)', () => {
  it('contiene le sezioni obbligatorie di navigazione', () => {
    expect(I18N.nav.home).toBe('Home');
    expect(I18N.nav.giochi).toBe('Giochi');
    expect(I18N.nav.bans).toBe('Bans');
    expect(I18N.nav.canti).toBe('Canti');
    expect(I18N.nav.calendario).toBe('Calendario');
    expect(I18N.nav.stampa).toBe('Stampa');
    expect(I18N.nav.admin).toBe('Admin');
  });

  it('ha stringhe per le 4 opzioni di ordinamento richieste', () => {
    expect(I18N.sort.az).toBe('A → Z');
    expect(I18N.sort.za).toBe('Z → A');
    expect(I18N.sort.newest).toBe('Più recenti');
    expect(I18N.sort.oldest).toBe('Più vecchi');
  });

  it('ha messaggi di stato offline e PWA conformi alle specifiche', () => {
    const formattedOffline = I18N.status.offlineBanner('14/10 alle 12:00');
    expect(formattedOffline).toContain('Sei offline - dati aggiornati al 14/10 alle 12:00');
    expect(I18N.status.pwaUpdateAvailable).toBe('Nuova versione disponibile!');
  });
});
