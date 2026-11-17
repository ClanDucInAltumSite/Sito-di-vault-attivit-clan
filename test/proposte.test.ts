// test/proposte.test.ts
// Test di unità per il modulo proposte, feedback ottimistico locale,
// circuit breaker anti-flood (20 req / 2s), e moderazione admin

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { supabase } from '../src/lib/supabase';
import {
  getDeviceId,
  inviaProposta,
  getProposteLocali,
  ritiraPropostaLocale,
  approvaPropostaAdmin,
  rifiutaPropostaAdmin,
  bloccaProponente,
  getPropostePerVisualizzazione,
  getBlockedIps,
  unblockIp,
  isLocalCircuitBreakerBlocked,
  unblockLocalCircuitBreaker,
  PropostaItem,
} from '../src/lib/proposte';
import { getGiochi, getBans } from '../src/lib/db';

describe('Sistema Proposte Utenti e Circuit Breaker Anti-Flood', () => {
  beforeEach(() => {
    localStorage.clear();
    unblockLocalCircuitBreaker();

    // Mock chiamate Supabase in modo da operare senza latenza di rete e senza errori RLS
    const createQueryBuilder = () => {
      const qb: any = {
        eq: vi.fn(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      qb.eq.mockReturnValue(qb);
      return qb;
    };

    vi.spyOn(supabase, 'from').mockImplementation(() => {
      const qb = createQueryBuilder();
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnValue(qb),
        update: vi.fn().mockReturnValue(qb),
        delete: vi.fn().mockReturnValue(qb),
      } as any;
    });

    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: [], error: null } as any);
  });

  it('1. Genera e memorizza un deviceId univoco su localStorage', () => {
    const devId1 = getDeviceId();
    expect(devId1).toBeTruthy();
    const devId2 = getDeviceId();
    expect(devId2).toBe(devId1);
  });

  it('2. Permette a utenti non-admin di inviare proposte senza parole d\'ordine o password', async () => {
    const prop = await inviaProposta(
      'giochi',
      'Rover Flag',
      {
        nome: 'Rover Flag',
        regole: 'Gioco di squadra con bandiere ed esplorazione...',
        materiali: '2 bandiere scout, cordini',
      },
      'Pattuglia Aquile'
    );

    expect(prop.id).toBeTruthy();
    expect(prop.titolo).toBe('Rover Flag');
    expect(prop.stato).toBe('in_attesa');
    expect(prop.proponente_nome).toBe('Pattuglia Aquile');
    expect(prop.device_id).toBe(getDeviceId());

    // Verifica presenza nelle proposte locali in attesa
    const locali = await getProposteLocali('giochi');
    expect(locali.some((p) => p.id === prop.id)).toBe(true);
  });

  it('3. Supporta contenuti lunghi e flessibili senza blocchi arbitrari di dimensione', async () => {
    const testoLungo = 'Strofa con accordi e testo ripetuto... '.repeat(300);
    const propCanto = await inviaProposta(
      'canti',
      'Canto della Strada Lungo',
      {
        titolo: 'Canto della Strada Lungo',
        autore: 'Clan Majella',
        categoria: 'scout',
        testo_chordpro: testoLungo,
      }
    );

    expect(propCanto.dati.testo_chordpro.length).toBeGreaterThan(5000);
    const locali = await getProposteLocali('canti');
    expect(locali.some((p) => p.id === propCanto.id)).toBe(true);
  });

  it('4. Permette all\'utente di ritirare la propria proposta locale prima dell\'approvazione', async () => {
    const prop = await inviaProposta(
      'bans',
      'Ban di Prova',
      {
        nome: 'Ban di Prova',
        testo: 'Testo ban di prova...',
        note_gesti: 'Battere le mani',
      }
    );

    let locali = await getProposteLocali('bans');
    expect(locali.some((p) => p.id === prop.id)).toBe(true);

    await ritiraPropostaLocale(prop.id);

    locali = await getProposteLocali('bans');
    expect(locali.some((p) => p.id === prop.id)).toBe(false);
  });

  it('5. Circuit Breaker Anti-Flood: scatta al raggiungimento di 20 richieste in 2 secondi', async () => {
    expect(isLocalCircuitBreakerBlocked()).toBe(false);

    // Invia 19 richieste in rapida sequenza (sotto soglia 20)
    for (let i = 0; i < 19; i++) {
      await inviaProposta('giochi', `Gioco Rapido ${i}`, {
        nome: `Gioco Rapido ${i}`,
        regole: 'Regola veloce',
        materiali: 'Nessuno',
      });
    }

    expect(isLocalCircuitBreakerBlocked()).toBe(false);

    // La 20-esima richiesta entro 2 secondi deve far scattare il Circuit Breaker
    await expect(
      inviaProposta('giochi', 'Gioco Flood 20', {
        nome: 'Gioco Flood 20',
        regole: 'Flood',
        materiali: 'Nessuno',
      })
    ).rejects.toThrow(/anomala|bloccato/i);

    expect(isLocalCircuitBreakerBlocked()).toBe(true);

    // Qualsiasi ulteriore richiesta viene bloccata a monte
    await expect(
      inviaProposta('giochi', 'Gioco Flood 21', {
        nome: 'Gioco Flood 21',
        regole: 'Flood',
        materiali: 'Nessuno',
      })
    ).rejects.toThrow(/sospeso|bloccato/i);
  });

  it('6. Sblocco IP/Dispositivo: ripristinabile solo via azione unblock da menu admin', async () => {
    // Forziamo il blocco simulando l'attivazione del circuit breaker
    localStorage.setItem('vault_scout_ip_blocked', 'true');
    expect(isLocalCircuitBreakerBlocked()).toBe(true);

    // Elenco IP bloccati mostra il dispositivo corrente
    const blockedList = await getBlockedIps();
    expect(blockedList.length).toBeGreaterThanOrEqual(1);
    expect(blockedList.some((item) => item.ip.includes('questo dispositivo'))).toBe(true);

    // Sblocco amministratore
    const unblocked = await unblockIp('127.0.0.1 (questo dispositivo)');
    expect(unblocked).toBe(true);
    expect(isLocalCircuitBreakerBlocked()).toBe(false);

    // Ora l'invio torna a funzionare regolarmente
    const newProp = await inviaProposta('giochi', 'Gioco Post Sblocco', {
      nome: 'Gioco Post Sblocco',
      regole: 'Ok',
      materiali: '',
    });
    expect(newProp.titolo).toBe('Gioco Post Sblocco');
  });

  it('7. Moderazione Admin: approvazione e rifiuto proposte', async () => {
    const propGioco = await inviaProposta(
      'giochi',
      'Alce Rossa Ufficiale',
      {
        nome: 'Alce Rossa Ufficiale',
        regole: 'Regole complete del gioco Alce Rossa...',
        materiali: 'Fazzolettoni scout',
      },
      'Scolta Chiara'
    );

    // Approvazione da parte dell'admin
    await approvaPropostaAdmin(propGioco);

    // Verifica che il gioco sia ora nel catalogo ufficiale
    const giochiUfficiali = await getGiochi(false);
    expect(giochiUfficiali.some((g) => g.nome === 'Alce Rossa Ufficiale')).toBe(true);

    // Verifica che non sia piu tra le proposte locali pendenti
    const locali = await getProposteLocali('giochi');
    expect(locali.some((p) => p.id === propGioco.id)).toBe(false);

    // Test Rifiuto proposta
    const propBan = await inviaProposta(
      'bans',
      'Ban Rifiutabile',
      {
        nome: 'Ban Rifiutabile',
        testo: 'Testo non conforme...',
        note_gesti: 'Nessuno',
      }
    );

    await rifiutaPropostaAdmin(propBan.id, 'Contenuto non idoneo alle attivita scout');
    const localiBans = await getProposteLocali('bans');
    expect(localiBans.some((b) => b.id === propBan.id)).toBe(false);
  });

  it('8. Visualizzazione proposte: non-admin vede solo locali, admin interroga anche remote', async () => {
    const propLocal = await inviaProposta('canti', 'Canto Locale In Attesa', {
      titolo: 'Canto Locale In Attesa',
      categoria: 'scout',
      testo_chordpro: 'Accordi...',
    });

    // Utente normale (isAdmin = false): ottiene solo proposte locali
    const userView = await getPropostePerVisualizzazione('canti', false);
    expect(userView.some((p) => p.id === propLocal.id)).toBe(true);

    // Utente admin (isAdmin = true): ottiene sia proposte locali sia da Supabase
    const adminView = await getPropostePerVisualizzazione('canti', true);
    expect(adminView.some((p) => p.id === propLocal.id)).toBe(true);
  });

  it('9. Blocco utente spammer: inserisce blocco IP/device e blocca futuri invii', async () => {
    const propSpam = await inviaProposta('giochi', 'Spam Non Serio', {
      nome: 'Spam Non Serio',
      regole: 'nonsense',
      materiali: '',
    });

    // Admin rifiuta e blocca l'utente
    await bloccaProponente(propSpam, 'Proposte non serie ripetute');

    // Se l'utente era su questo stesso dispositivo, il circuit breaker locale scatta
    expect(isLocalCircuitBreakerBlocked()).toBe(true);

    // Tentativo di nuovo invio fallisce per blocco
    await expect(
      inviaProposta('giochi', 'Altra Proposta Non Seria', {
        nome: 'Altra Proposta Non Seria',
        regole: '',
        materiali: '',
      })
    ).rejects.toThrow(/bloccato|sospeso/i);
  });
});
