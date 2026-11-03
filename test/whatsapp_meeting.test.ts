// test/whatsapp_meeting.test.ts
// Test unitari completi per il modulo di formattazione e condivisione WhatsApp delle riunioni di Clan.

import { describe, it, expect, vi } from 'vitest';
import {
  buildMeetingWhatsAppMessage,
  getWhatsAppShareUrl,
  openWhatsApp,
  EMOJI_FLEUR_DE_LIS,
  EMOJI_PIN,
  EMOJI_CALENDAR,
  EMOJI_SPIRAL_CALENDAR,
  EMOJI_MEMO,
  EMOJI_LOCATION,
  EMOJI_CLIPBOARD,
} from '../src/lib/whatsapp';
import { Evento, OdgPunto } from '../src/lib/db';
import { SENTINEL_DATA_DA_DEFINIRE } from '../src/lib/calendario';

describe('Generatore Messaggio WhatsApp Riunioni Clan (whatsapp.ts)', () => {
  const currentMeeting: Evento = {
    id: 'meet-1',
    titolo: 'Riunione di Apertura Anno Scout',
    tipo: 'riunione',
    inizio: '2026-10-15T20:45:00.000Z',
    fine: '2026-10-15T22:30:00.000Z',
    tutto_il_giorno: false,
    luogo: 'Sede Scout Clan',
    descrizione: 'Prima riunione dell\'anno per programmazione',
    responsabile: null,
    cosa_portare: 'Quaderno di caccia e penna',
    appunti: 'Deciso il tema del Capitolo: Diritti umani e impegno civico.',
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    deleted_at: null,
  };

  const nextMeetingFixed: Evento = {
    id: 'meet-2',
    titolo: 'Riunione Capitolo - Fase Lancio',
    tipo: 'riunione',
    inizio: '2026-10-22T20:45:00.000Z',
    fine: '2026-10-22T22:30:00.000Z',
    tutto_il_giorno: false,
    luogo: 'Sede Scout - Sala Fuoco',
    descrizione: null,
    responsabile: null,
    cosa_portare: null,
    appunti: null,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    deleted_at: null,
  };

  const nextMeetingTbd: Evento = {
    id: 'meet-tbd',
    titolo: 'Prossima Riunione Clan',
    tipo: 'riunione',
    inizio: SENTINEL_DATA_DA_DEFINIRE,
    fine: null,
    tutto_il_giorno: false,
    luogo: 'Da decidere',
    descrizione: '[DATA_DA_DEFINIRE] Data aperta',
    responsabile: null,
    cosa_portare: null,
    appunti: null,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    deleted_at: null,
  };

  const sampleOdgPunti: OdgPunto[] = [
    {
      id: 'odg-1',
      evento_id: 'meet-2',
      testo: 'Verifica incarichi e pattuglie',
      ordine: 0,
      completato: false,
      riportato_da: null,
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
      deleted_at: null,
    },
    {
      id: 'odg-2',
      evento_id: 'meet-2',
      testo: 'Lancio piste per esperti esterni',
      ordine: 1,
      completato: false,
      riportato_da: null,
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
      deleted_at: null,
    },
    {
      id: 'odg-del',
      evento_id: 'meet-2',
      testo: 'Punto cancellato non visibile',
      ordine: 2,
      completato: false,
      riportato_da: null,
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
      deleted_at: '2026-10-02T10:00:00.000Z',
    },
  ];

  it('compone correttamente il messaggio con riunione corrente, appunti e prossima riunione con ODG', () => {
    const text = buildMeetingWhatsAppMessage({
      currentMeeting,
      currentAppunti: 'Accettata all\'unanimità la proposta di route invernale.',
      nextMeeting: nextMeetingFixed,
      nextOdgPunti: sampleOdgPunti,
    });

    // Intestazione scout
    expect(text).toContain(`${EMOJI_FLEUR_DE_LIS} *CLAN DUC IN ALTUM* ${EMOJI_FLEUR_DE_LIS}`);
    expect(text).toContain(`${EMOJI_PIN} *Riunione:* Riunione di Apertura Anno Scout`);
    expect(text).toContain(`${EMOJI_LOCATION} *Luogo:* Sede Scout Clan`);

    // Appunti riunione
    expect(text).toContain(`${EMOJI_MEMO} *APPUNTI DELLA RIUNIONE:*`);
    expect(text).toContain('Accettata all\'unanimità la proposta di route invernale.');

    // Prossima riunione con data e luogo
    expect(text).toContain(`${EMOJI_SPIRAL_CALENDAR} *PROSSIMA RIUNIONE:*`);
    expect(text).toContain('Sede Scout - Sala Fuoco');

    // Ordine del giorno numerato, senza punti cancellati
    expect(text).toContain(`${EMOJI_CLIPBOARD} *ORDINE DEL GIORNO (ODG):*`);
    expect(text).toContain('1. Verifica incarichi e pattuglie');
    expect(text).toContain('2. Lancio piste per esperti esterni');
    expect(text).not.toContain('Punto cancellato');

    // Firma finale
    expect(text).toContain('_Vault Scout — Duc In Altum_');
  });

  it('requisito utente esplicito: per riunione con data da confermare genera "📅 Data: Da concordare insieme"', () => {
    const text = buildMeetingWhatsAppMessage({
      currentMeeting,
      currentAppunti: 'Discussione organizzativa.',
      nextMeeting: nextMeetingTbd,
      nextOdgPunti: sampleOdgPunti,
    });

    // Verifica stringa esatta richiesta dall'utente
    expect(text).toContain(`${EMOJI_CALENDAR} Data: Da concordare insieme`);
  });

  it('gestisce correttamente l\'assenza di appunti inseriti', () => {
    const emptyAppuntiMeeting = { ...currentMeeting, appunti: null };
    const text = buildMeetingWhatsAppMessage({
      currentMeeting: emptyAppuntiMeeting,
      currentAppunti: '',
      nextMeeting: nextMeetingFixed,
    });

    expect(text).toContain('_Nessun appunto inserito per questa riunione._');
  });

  it('gestisce correttamente l\'assenza di riunione futura nel calendario', () => {
    const text = buildMeetingWhatsAppMessage({
      currentMeeting,
      currentAppunti: 'Verbale della riunione',
      nextMeeting: null,
    });

    expect(text).toContain(`${EMOJI_SPIRAL_CALENDAR} *PROSSIMA RIUNIONE:*`);
    expect(text).toContain('_Da programmare_');
    expect(text).not.toContain('ORDINE DEL GIORNO');
  });

  it('gestisce prossima riunione senza punti ODG inseriti', () => {
    const text = buildMeetingWhatsAppMessage({
      currentMeeting,
      currentAppunti: 'Note di prova',
      nextMeeting: nextMeetingFixed,
      nextOdgPunti: [],
    });

    expect(text).toContain(`${EMOJI_CLIPBOARD} *ORDINE DEL GIORNO (ODG):*`);
    expect(text).toContain('_In fase di definizione_');
  });

  it('genera URL per WhatsApp Web/API codificato correttamente in URI', () => {
    const sample = '⚜️ *CLAN* & Riunione #1?';
    const url = getWhatsAppShareUrl(sample);

    expect(url.startsWith('https://api.whatsapp.com/send?text=')).toBe(true);
    expect(url).toContain(encodeURIComponent(sample));
  });

  it('openWhatsApp invoca window.open con l\'URL formattato e opzioni di sicurezza', () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);

    openWhatsApp('Test invio WhatsApp');

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://api.whatsapp.com/send?text=Test%20invio%20WhatsApp'),
      '_blank',
      'noopener,noreferrer'
    );

    vi.unstubAllGlobals();
  });
});
