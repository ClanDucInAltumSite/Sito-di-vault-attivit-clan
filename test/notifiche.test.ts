// test/notifiche.test.ts
// Test suite per il sistema di Notifiche PWA (Eventi Calendario e Proposte Admin)
// Vault Scout - Duc In Altum

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getNotifications,
  getUnreadNotificationsCount,
  addAppNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAppNotification,
  clearAllNotifications,
  resetNotificationPreferences,
  checkEventReminders,
  checkAdminProposte,
  isNotificationSupported,
  getNotificationPermission,
  playNotificationSound,
} from '../src/lib/notifications';
import { formatDateKey } from '../src/lib/calendario';
import * as dbModule from '../src/lib/db';
import * as proposteModule from '../src/lib/proposte';

describe('Sistema di Notifiche PWA e Avvisi Admin', () => {
  beforeEach(() => {
    resetNotificationPreferences();
    vi.restoreAllMocks();
  });

  describe('1. Preferenze Notifiche', () => {
    it('restituisce i valori predefiniti se non configurate', () => {
      const prefs = getNotificationPreferences();
      expect(prefs.enabled).toBe(true);
      expect(prefs.eventsToday).toBe(true);
      expect(prefs.eventsDayBefore).toBe(true);
      expect(prefs.newEvents).toBe(true);
      expect(prefs.adminProposte).toBe(true);
      expect(prefs.sound).toBe(true);
    });

    it('permette di aggiornare selettivamente le preferenze', () => {
      const updated = saveNotificationPreferences({ sound: false, eventsToday: false });
      expect(updated.sound).toBe(false);
      expect(updated.eventsToday).toBe(false);
      expect(updated.eventsDayBefore).toBe(true);

      const reloaded = getNotificationPreferences();
      expect(reloaded.sound).toBe(false);
      expect(reloaded.eventsToday).toBe(false);
    });
  });

  describe('2. Gestione Notifiche In-App (Store locale)', () => {
    it('aggiunge notifiche e calcola correttamente il contatore delle non lette', () => {
      expect(getUnreadNotificationsCount()).toBe(0);

      addAppNotification({
        type: 'evento_promemoria',
        title: 'Promemoria Prova',
        body: 'Dettagli appuntamento',
        targetRoute: 'calendario',
      });

      expect(getUnreadNotificationsCount()).toBe(1);
      const list = getNotifications();
      expect(list.length).toBe(1);
      expect(list[0].title).toBe('Promemoria Prova');
      expect(list[0].read).toBe(false);
    });

    it('segna una singola notifica come letta', () => {
      const notif = addAppNotification({
        type: 'evento_promemoria',
        title: 'Test Lettura',
        body: 'Corpo notifica',
      });

      expect(getUnreadNotificationsCount()).toBe(1);
      markNotificationAsRead(notif.id);
      expect(getUnreadNotificationsCount()).toBe(0);
      expect(getNotifications()[0].read).toBe(true);
    });

    it('segna tutte le notifiche come lette', () => {
      addAppNotification({ type: 'evento_nuovo', title: 'N1', body: 'B1' });
      addAppNotification({ type: 'proposta_nuova', title: 'N2', body: 'B2' });
      expect(getUnreadNotificationsCount()).toBe(2);

      markAllNotificationsAsRead();
      expect(getUnreadNotificationsCount()).toBe(0);
    });

    it('elimina una notifica singola e svuota tutto', () => {
      const n1 = addAppNotification({ type: 'evento_nuovo', title: 'N1', body: 'B1' });
      addAppNotification({ type: 'proposta_nuova', title: 'N2', body: 'B2' });
      expect(getNotifications().length).toBe(2);

      deleteAppNotification(n1.id);
      expect(getNotifications().length).toBe(1);

      clearAllNotifications();
      expect(getNotifications().length).toBe(0);
    });
  });

  describe('3. Motore Promemoria Eventi Calendario (checkEventReminders)', () => {
    it('genera promemoria per gli eventi previsti per OGGI', async () => {
      const today = new Date();
      const todayStr = formatDateKey(today);

      const fakeEvents: any[] = [
        {
          id: 'ev-oggi-1',
          titolo: 'Uscita alle Gole del Sagittario',
          tipo: 'uscita',
          inizio: `${todayStr}T08:00:00.000Z`,
          fine: `${todayStr}T17:00:00.000Z`,
          luogo: 'Piazza Garibaldi',
          deleted_at: null,
        },
      ];

      vi.spyOn(dbModule, 'getEventi').mockResolvedValue(fakeEvents);

      await checkEventReminders();

      const notifs = getNotifications();
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe('evento_promemoria');
      expect(notifs[0].title).toContain('Oggi: Uscita alle Gole del Sagittario');
      expect(notifs[0].body).toContain('Piazza Garibaldi');
      expect(notifs[0].targetRoute).toBe('calendario');
    });

    it('genera promemoria per gli eventi previsti per DOMANI', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDateKey(tomorrow);

      const fakeEvents: any[] = [
        {
          id: 'ev-domani-1',
          titolo: 'Riunione di Clan',
          tipo: 'riunione',
          inizio: `${tomorrowStr}T20:30:00.000Z`,
          fine: `${tomorrowStr}T22:30:00.000Z`,
          luogo: 'Sede Scout',
          deleted_at: null,
        },
      ];

      vi.spyOn(dbModule, 'getEventi').mockResolvedValue(fakeEvents);

      await checkEventReminders();

      const notifs = getNotifications();
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe('evento_promemoria');
      expect(notifs[0].title).toContain('Domani: Riunione di Clan');
      expect(notifs[0].targetRoute).toBe('calendario');
    });

    it('ignora gli eventi eliminati o con data ancora da concordare ([DATA_DA_DEFINIRE])', async () => {
      const today = new Date();
      const todayStr = formatDateKey(today);

      const fakeEvents: any[] = [
        {
          id: 'ev-eliminato',
          titolo: 'Evento Annullato',
          tipo: 'altro',
          inizio: `${todayStr}T10:00:00.000Z`,
          deleted_at: new Date().toISOString(),
        },
        {
          id: 'ev-da-definire',
          titolo: 'Punto della Strada',
          tipo: 'riunione',
          inizio: '2099-12-31T20:45:00.000Z',
          descrizione: '[DATA_DA_DEFINIRE] Data ancora da concordare',
          deleted_at: null,
        },
      ];

      vi.spyOn(dbModule, 'getEventi').mockResolvedValue(fakeEvents);

      await checkEventReminders();
      expect(getNotifications().length).toBe(0);
    });

    it('deduplica ed evita di notificare lo stesso evento due volte nello stesso giorno', async () => {
      const today = new Date();
      const todayStr = formatDateKey(today);

      const fakeEvents: any[] = [
        {
          id: 'ev-oggi-dedup',
          titolo: 'Messa di Gruppo',
          tipo: 'evento',
          inizio: `${todayStr}T10:00:00.000Z`,
          deleted_at: null,
        },
      ];

      vi.spyOn(dbModule, 'getEventi').mockResolvedValue(fakeEvents);

      // Primo controllo: genera notifica
      await checkEventReminders();
      expect(getNotifications().length).toBe(1);

      // Secondo controllo successivo: NON deve duplicare la notifica
      await checkEventReminders();
      expect(getNotifications().length).toBe(1);
    });
  });

  describe('4. Motore Moderazione Proposte per l\'Admin (checkAdminProposte)', () => {
    it('non esegue notifiche e restituisce 0 se l\'utente non è admin', async () => {
      const count = await checkAdminProposte(false);
      expect(count).toBe(0);
      expect(getNotifications().length).toBe(0);
    });

    it('genera avvisi per l\'admin quando sono presenti proposte in attesa', async () => {
      const fakeProposte: any[] = [
        {
          id: 'prop-1',
          tabella: 'canti',
          titolo: 'Al Cader Della Giornata',
          dati: { titolo: 'Al Cader Della Giornata' },
          proponente_nome: 'Chiara',
          stato: 'in_attesa',
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(proposteModule, 'getProposteAdmin').mockResolvedValue(fakeProposte);

      const count = await checkAdminProposte(true);
      expect(count).toBe(1);

      const notifs = getNotifications();
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe('proposta_nuova');
      expect(notifs[0].title).toContain('️ Nuova proposta da approvare: "Al Cader Della Giornata"');
      expect(notifs[0].body).toContain('Canzoniere');
      expect(notifs[0].body).toContain('Chiara');
      expect(notifs[0].targetRoute).toBe('admin');
    });

    it('deduplica gli avvisi di moderazione admin per la stessa proposta', async () => {
      const fakeProposte: any[] = [
        {
          id: 'prop-dedup',
          tabella: 'giochi',
          titolo: 'Scalpo Notturno',
          dati: { nome: 'Scalpo Notturno' },
          stato: 'in_attesa',
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(proposteModule, 'getProposteAdmin').mockResolvedValue(fakeProposte);

      await checkAdminProposte(true);
      expect(getNotifications().length).toBe(1);

      await checkAdminProposte(true);
      expect(getNotifications().length).toBe(1);
    });
  });

  describe('5. Rilevamento e Supporto Notifiche Browser', () => {
    it('supporta la query di stato supporto notifiche', () => {
      const supported = isNotificationSupported();
      expect(typeof supported).toBe('boolean');
    });

    it('gestisce lo stato dei permessi senza lanciare eccezioni', () => {
      const perm = getNotificationPermission();
      expect(['granted', 'denied', 'default', 'unsupported']).toContain(perm);
    });

    it('non lancia errori quando viene eseguita la sintesi audio di notifica', () => {
      expect(() => playNotificationSound()).not.toThrow();
    });
  });
});
