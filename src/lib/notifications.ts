// src/lib/notifications.ts
// Modulo per il Sistema di Notifiche PWA (Web Push, Local Notifications,
// Promemoria Eventi Calendario e Avvisi Moderazione Modifiche Admin).
// Vault Scout - Duc In Altum

import { getEventi, Evento } from './db';
import { isEventoDataDaDefinire, parseDateOnly, formatDateKey, formatEventDateTimeRange } from './calendario';
import { getProposteAdmin, PropostaItem } from './proposte';
import { supabase } from './supabase';
import { RouteName } from '../app/router';

export type NotificationType =
  | 'evento_promemoria'
  | 'evento_nuovo'
  | 'proposta_nuova'
  | 'sistema';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string; // ISO 8601
  read: boolean;
  targetRoute?: RouteName;
  targetId?: string;
  metadata?: {
    tipoEvento?: string;
    sezione?: string;
    proponente?: string;
    dataEvento?: string;
  };
}

export interface NotificationPreferences {
  enabled: boolean;
  eventsToday: boolean;
  eventsDayBefore: boolean;
  newEvents: boolean;
  adminProposte: boolean;
  sound: boolean;
}

const STORAGE_KEY_PREFS = 'vault_scout_notification_prefs';
const STORAGE_KEY_NOTIFS = 'vault_scout_notifications';
const STORAGE_KEY_SENT_KEYS = 'vault_scout_notified_keys';

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  eventsToday: true,
  eventsDayBefore: true,
  newEvents: true,
  adminProposte: true,
  sound: true,
};

// Listeners per notifiche reattive
type NotificationsListener = (notifications: AppNotification[], unreadCount: number) => void;
const listeners = new Set<NotificationsListener>();

let memoryNotifications: AppNotification[] = [];
let memoryPrefs: NotificationPreferences = { ...DEFAULT_PREFS };
let notifiedKeys: Set<string> = new Set();
let isInitialized = false;

// 1. CARICAMENTO E SALVATAGGIO PREFERENZE
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_PREFS };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (raw) {
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Errore lettura preferenze notifiche:', err);
  }
  return { ...DEFAULT_PREFS };
}

export function saveNotificationPreferences(prefs: Partial<NotificationPreferences>): NotificationPreferences {
  memoryPrefs = { ...memoryPrefs, ...prefs };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(memoryPrefs));
    } catch (err) {
      console.warn('Errore salvataggio preferenze notifiche:', err);
    }
  }
  notifySubscribers();
  return { ...memoryPrefs };
}

export function resetNotificationPreferences(): void {
  memoryPrefs = { ...DEFAULT_PREFS };
  notifiedKeys.clear();
  memoryNotifications = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(STORAGE_KEY_PREFS);
      localStorage.removeItem(STORAGE_KEY_NOTIFS);
      localStorage.removeItem(STORAGE_KEY_SENT_KEYS);
    } catch (_err) {}
  }
  notifySubscribers();
}

// 2. CARICAMENTO E SALVATAGGIO NOTIFICHE IN-APP
function loadStoredNotifications(): AppNotification[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 50); // Mantiene le ultime 50 notifiche
      }
    }
  } catch (err) {
    console.warn('Errore lettura storico notifiche:', err);
  }
  return [];
}

function saveStoredNotifications(notifs: AppNotification[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifs.slice(0, 50)));
    } catch (err) {
      console.warn('Errore salvataggio storico notifiche:', err);
    }
  }
}

function loadSentKeys(): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SENT_KEYS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.slice(-200)); // Mantiene gli ultimi 200 id per deduplicazione
      }
    }
  } catch (err) {
    console.warn('Errore lettura chiavi notificate:', err);
  }
  return new Set();
}

function saveSentKeys(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const arr = Array.from(notifiedKeys).slice(-200);
      localStorage.setItem(STORAGE_KEY_SENT_KEYS, JSON.stringify(arr));
    } catch (err) {
      console.warn('Errore salvataggio chiavi notificate:', err);
    }
  }
}

function notifySubscribers(): void {
  const unreadCount = memoryNotifications.filter((n) => !n.read).length;
  for (const listener of listeners) {
    try {
      listener([...memoryNotifications], unreadCount);
    } catch (err) {
      console.error('Errore listener notifiche:', err);
    }
  }
}

export function subscribeNotifications(listener: NotificationsListener): () => void {
  listeners.add(listener);
  const unreadCount = memoryNotifications.filter((n) => !n.read).length;
  listener([...memoryNotifications], unreadCount);
  return () => {
    listeners.delete(listener);
  };
}

export function getNotifications(): AppNotification[] {
  return [...memoryNotifications];
}

export function getUnreadNotificationsCount(): number {
  return memoryNotifications.filter((n) => !n.read).length;
}

// 3. SUONO DI NOTIFICA ARMONICO (Sintesi Web Audio API a zero byte esterni)
export function playNotificationSound(): void {
  if (!memoryPrefs.sound) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, gainLevel: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(gainLevel, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Doppio tocco elegante tipo carillon (E5: 659 Hz -> A5: 880 Hz)
    playTone(659.25, now, 0.22, 0.12);
    playTone(880.00, now + 0.11, 0.32, 0.14);
  } catch (_err) {
    // Silenzioso se l'audio non è autorizzato dall'interazione utente
  }
}

// 4. SUPPORTO E PERMESSI BROWSER / PWA
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Richiede il permesso per le notifiche di sistema del browser/OS.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      saveNotificationPreferences({ enabled: true });

      // Invia subito una notifica di conferma e benvenuto
      await sendBrowserNotification('Notifiche attivate!', {
        body: 'Riceverai promemoria per le uscite e le riunioni del Clan Duc In Altum.',
        tag: 'welcome-notification',
      });
      return true;
    }
  } catch (err) {
    console.warn('Richiesta permessi notifiche fallita:', err);
  }
  return false;
}

/**
 * Invia una notifica di sistema (tramite Service Worker se pronto, o fallback su new Notification).
 */
export async function sendBrowserNotification(
  title: string,
  options?: NotificationOptions & { url?: string; playSound?: boolean }
): Promise<void> {
  const perm = getNotificationPermission();
  if (perm !== 'granted' || !memoryPrefs.enabled) return;

  const playSound = options?.playSound !== false;
  if (playSound) {
    playNotificationSound();
  }

  // Tocco di vibrazione se disponibile
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([120, 80, 120]);
    } catch (_v) {}
  }

  const notificationOptions: NotificationOptions = {
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    ...options,
    data: {
      url: options?.url || './',
      ...options?.data,
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return;
      }
    }
  } catch (swErr) {
    console.warn('Notifica tramite Service Worker fallita, provo fallback:', swErr);
  }

  // Fallback con Notification API standard
  try {
    const notif = new Notification(title, notificationOptions);
    if (options?.url) {
      notif.onclick = () => {
        window.focus();
        window.location.hash = options.url || '#/';
      };
    }
  } catch (fallbackErr) {
    console.warn('Notifica di fallback fallita:', fallbackErr);
  }
}

// 5. REGISTRAZIONE DI UNA NOTIFICA NELL'APP
export function addAppNotification(notifData: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { id?: string }): AppNotification {
  const id = notifData.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const newNotif: AppNotification = {
    ...notifData,
    id,
    timestamp: nowIso,
    read: false,
  };

  // Evita duplicati identici se già presenti
  const existingIndex = memoryNotifications.findIndex((n) => n.id === id);
  if (existingIndex >= 0) {
    memoryNotifications[existingIndex] = newNotif;
  } else {
    memoryNotifications.unshift(newNotif);
  }

  saveStoredNotifications(memoryNotifications);
  notifySubscribers();
  return newNotif;
}

export function markNotificationAsRead(id: string): void {
  const notif = memoryNotifications.find((n) => n.id === id);
  if (notif && !notif.read) {
    notif.read = true;
    saveStoredNotifications(memoryNotifications);
    notifySubscribers();
  }
}

export function markAllNotificationsAsRead(): void {
  let changed = false;
  for (const n of memoryNotifications) {
    if (!n.read) {
      n.read = true;
      changed = true;
    }
  }
  if (changed) {
    saveStoredNotifications(memoryNotifications);
    notifySubscribers();
  }
}

export function deleteAppNotification(id: string): void {
  const prevLen = memoryNotifications.length;
  memoryNotifications = memoryNotifications.filter((n) => n.id !== id);
  if (memoryNotifications.length !== prevLen) {
    saveStoredNotifications(memoryNotifications);
    notifySubscribers();
  }
}

export function clearAllNotifications(): void {
  memoryNotifications = [];
  saveStoredNotifications(memoryNotifications);
  notifySubscribers();
}

// 6. MOTORE DI CONTROLLO EVENTI CALENDARIO
// Calcola gli eventi imminenti (oggi e domani) ed emette le relative notifiche
export async function checkEventReminders(): Promise<void> {
  if (!memoryPrefs.enabled) return;

  try {
    const eventi = await getEventi(false);
    const today = new Date();
    const todayKey = formatDateKey(today);

    for (const ev of eventi) {
      if (ev.deleted_at !== null) continue;
      if (isEventoDataDaDefinire(ev)) continue;

      const startDate = parseDateOnly(ev.inizio);
      const diffDays = Math.round((startDate.getTime() - parseDateOnly(todayKey).getTime()) / (1000 * 60 * 60 * 24));

      // A. Promemoria per OGGI
      if (diffDays === 0 && memoryPrefs.eventsToday) {
        const notifKey = `ev_today_${ev.id}_${todayKey}`;
        if (!notifiedKeys.has(notifKey)) {
          notifiedKeys.add(notifKey);
          saveSentKeys();

          const infoRange = formatEventDateTimeRange(ev);
          const luogoText = ev.luogo ? `${ev.luogo}` : '';
          const body = [infoRange, luogoText].filter(Boolean).join(' • ') || 'Oggi è in programma l\'attività!';

          addAppNotification({
            id: notifKey,
            type: 'evento_promemoria',
            title: `Oggi: ${ev.titolo}`,
            body,
            targetRoute: 'calendario',
            targetId: ev.id,
            metadata: {
              tipoEvento: ev.tipo,
              dataEvento: ev.inizio,
            },
          });

          sendBrowserNotification(`Oggi: ${ev.titolo}`, {
            body,
            tag: notifKey,
            url: '#/calendario',
          });
        }
      }

      // B. Promemoria per DOMANI
      if (diffDays === 1 && memoryPrefs.eventsDayBefore) {
        const notifKey = `ev_tomorrow_${ev.id}_${todayKey}`;
        if (!notifiedKeys.has(notifKey)) {
          notifiedKeys.add(notifKey);
          saveSentKeys();

          const infoRange = formatEventDateTimeRange(ev);
          const luogoText = ev.luogo ? `${ev.luogo}` : '';
          const body = `Domani c'è "${ev.titolo}" (${infoRange}). ${luogoText}`.trim();

          addAppNotification({
            id: notifKey,
            type: 'evento_promemoria',
            title: `Domani: ${ev.titolo}`,
            body,
            targetRoute: 'calendario',
            targetId: ev.id,
            metadata: {
              tipoEvento: ev.tipo,
              dataEvento: ev.inizio,
            },
          });

          sendBrowserNotification(`Domani: ${ev.titolo}`, {
            body,
            tag: notifKey,
            url: '#/calendario',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Controllo promemoria eventi fallito:', err);
  }
}

// 7. MOTORE DI CONTROLLO PROPOSTE PER L'ADMIN
// Monitora le nuove proposte in attesa di moderazione/approvazione
export async function checkAdminProposte(isAdmin: boolean): Promise<number> {
  if (!isAdmin || !memoryPrefs.adminProposte) return 0;

  try {
    const pendingList = await getProposteAdmin();
    const count = pendingList.length;

    for (const prop of pendingList) {
      const notifKey = `admin_prop_${prop.id}`;
      if (!notifiedKeys.has(notifKey)) {
        notifiedKeys.add(notifKey);
        saveSentKeys();

        const sezioneLabel =
          prop.tabella === 'canti' ? 'Canzoniere'
          : prop.tabella === 'giochi' ? 'Giochi'
          : prop.tabella === 'bans' ? 'Bans'
          : 'Canovacci';

        const proponente = prop.proponente_nome ? `da ${prop.proponente_nome}` : '';
        const body = `Nuovo contenuto proposto ${proponente} per la sezione ${sezioneLabel}. Tocca per approvare o rifiutare.`;

        addAppNotification({
          id: notifKey,
          type: 'proposta_nuova',
          title: `️ Nuova proposta da approvare: "${prop.titolo}"`,
          body,
          targetRoute: 'admin',
          targetId: prop.id,
          metadata: {
            sezione: prop.tabella,
            proponente: prop.proponente_nome || undefined,
          },
        });

        sendBrowserNotification(`️ Modifica da approvare: "${prop.titolo}"`, {
          body,
          tag: notifKey,
          url: '#/admin',
          playSound: true,
        });
      }
    }

    return count;
  } catch (err) {
    console.warn('Controllo proposte admin fallito:', err);
    return 0;
  }
}

// 8. INIZIALIZZAZIONE GLOBALE DEL MOTORE DI NOTIFICHE
let periodicTimer: any = null;
let realtimeNotifChannel: any = null;

export function initNotificationEngine(options?: {
  isAdmin?: boolean;
}): () => void {
  if (!isInitialized) {
    memoryPrefs = getNotificationPreferences();
    memoryNotifications = loadStoredNotifications();
    notifiedKeys = loadSentKeys();
    isInitialized = true;
    notifySubscribers();
  }

  const isAdmin = Boolean(options?.isAdmin);

  // Esegui controllo immediato
  checkEventReminders();
  if (isAdmin) {
    checkAdminProposte(isAdmin);
  }

  // Gestione visibilità scheda (quando l'utente ritorna all'app)
  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      checkEventReminders();
      if (isAdmin) {
        checkAdminProposte(isAdmin);
      }
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  // Timer periodico (ogni 30 minuti)
  if (periodicTimer) clearInterval(periodicTimer);
  periodicTimer = setInterval(() => {
    checkEventReminders();
    if (isAdmin) {
      checkAdminProposte(isAdmin);
    }
  }, 30 * 60 * 1000);

  // Connessione Supabase Realtime dedicata agli eventi notifica
  try {
    if (realtimeNotifChannel && supabase.removeChannel) {
      supabase.removeChannel(realtimeNotifChannel);
    }

    realtimeNotifChannel = supabase
      .channel('vault_scout_notifications_realtime')
      // Ascolto nuovi eventi in calendario
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'eventi' },
        (payload) => {
          const newEv = payload.new as Evento;
          if (newEv && !newEv.deleted_at && !isEventoDataDaDefinire(newEv)) {
            const notifKey = `new_event_${newEv.id}`;
            if (!notifiedKeys.has(notifKey)) {
              notifiedKeys.add(notifKey);
              saveSentKeys();

              const body = `Aggiunto: ${newEv.titolo} (${formatEventDateTimeRange(newEv)})`;
              addAppNotification({
                id: notifKey,
                type: 'evento_nuovo',
                title: 'Nuovo evento in calendario',
                body,
                targetRoute: 'calendario',
                targetId: newEv.id,
              });

              if (memoryPrefs.newEvents) {
                sendBrowserNotification('Nuovo evento in calendario', {
                  body,
                  tag: notifKey,
                  url: '#/calendario',
                });
              }
            }
          }
        }
      )
      // Ascolto nuove proposte per l'admin
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'proposte' },
        (payload) => {
          const newProp = payload.new as PropostaItem;
          if (isAdmin && newProp && newProp.stato === 'in_attesa') {
            const notifKey = `admin_prop_${newProp.id}`;
            if (!notifiedKeys.has(notifKey)) {
              notifiedKeys.add(notifKey);
              saveSentKeys();

              const body = `"${newProp.titolo}" (in ${newProp.tabella}) è in attesa di revisione. Tocca per moderare.`;
              addAppNotification({
                id: notifKey,
                type: 'proposta_nuova',
                title: `️ Nuova proposta da approvare: "${newProp.titolo}"`,
                body,
                targetRoute: 'admin',
                targetId: newProp.id,
              });

              sendBrowserNotification(`️ Nuova proposta da approvare: "${newProp.titolo}"`, {
                body,
                tag: notifKey,
                url: '#/admin',
                playSound: true,
              });
            }
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Realtime notifiche non avviato:', err);
  }

  return () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    if (periodicTimer) {
      clearInterval(periodicTimer);
      periodicTimer = null;
    }
    if (realtimeNotifChannel && supabase.removeChannel) {
      supabase.removeChannel(realtimeNotifChannel);
      realtimeNotifChannel = null;
    }
  };
}
