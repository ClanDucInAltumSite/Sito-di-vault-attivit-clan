// src/features/notifications/NotificationCenterSheet.tsx
// Centro Notifiche PWA: consultazione avvisi, promemoria eventi e moderazione proposte admin.
// Vault Scout - Duc In Altum

import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import {
  AppNotification,
  NotificationPreferences,
  getNotifications,
  subscribeNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAppNotification,
  clearAllNotifications,
  getNotificationPreferences,
  saveNotificationPreferences,
  getNotificationPermission,
  requestNotificationPermission,
  sendBrowserNotification,
  playNotificationSound,
} from '../../lib/notifications';
import { navigate } from '../../app/router';

export interface NotificationCenterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onOpenProposteReview?: () => void;
}

export function NotificationCenterSheet({
  isOpen,
  onClose,
  isAdmin,
  onOpenProposteReview,
}: NotificationCenterSheetProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<'all' | 'eventi' | 'admin'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(getNotificationPreferences());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (isOpen) {
      setNotifications(getNotifications());
      setPrefs(getNotificationPreferences());
      setPermission(getNotificationPermission());

      const unsubscribe = subscribeNotifications((notifs, count) => {
        setNotifications(notifs);
        setUnreadCount(count);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen]);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    if (granted) {
      setPrefs(getNotificationPreferences());
    }
  };

  const handleUpdatePref = (key: keyof NotificationPreferences, value: boolean) => {
    const updated = saveNotificationPreferences({ [key]: value });
    setPrefs(updated);
  };

  const handleTestNotification = async () => {
    playNotificationSound();
    await sendBrowserNotification('Notifica di Prova Vault Scout', {
      body: 'Il sistema di notifiche funziona perfettamente sul tuo dispositivo!',
      tag: 'test-notification',
      url: '#/',
    });
  };

  const handleItemClick = (notif: AppNotification) => {
    markNotificationAsRead(notif.id);

    if (notif.type === 'proposta_nuova') {
      onClose();
      if (onOpenProposteReview) {
        onOpenProposteReview();
      } else {
        navigate('admin');
      }
      return;
    }

    if (notif.targetRoute) {
      onClose();
      navigate(notif.targetRoute);
    }
  };

  // Filtraggio notifiche
  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'eventi') {
      return n.type === 'evento_promemoria' || n.type === 'evento_nuovo';
    }
    if (filter === 'admin') {
      return n.type === 'proposta_nuova';
    }
    return true;
  });

  const countAdmin = notifications.filter((n) => n.type === 'proposta_nuova' && !n.read).length;
  const countEventi = notifications.filter((n) => (n.type === 'evento_promemoria' || n.type === 'evento_nuovo') && !n.read).length;

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return `Oggi, ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
      }
      return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (_e) {
      return '';
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={showSettings ? 'Preferenze Notifiche' : 'Centro Notifiche'}
      subtitle={showSettings ? 'Configura promemoria e avvisi' : `${unreadCount} non lette`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* VISTA IMPOSTAZIONI PREFERENZE */}
        {showSettings ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Pulsante Torna alla Lista */}
            <button
              type="button"
              className="ios-btn ios-btn-ghost ios-btn-sm"
              onClick={() => setShowSettings(false)}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="chevron-left" size={18} />
              <span>Torna alle notifiche</span>
            </button>

            {/* Stato Permessi Browser */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: permission === 'granted' ? 'var(--color-giochi-tenue, #E8F5E9)' : 'var(--color-bans-tenue, #FFF8E1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                  {permission === 'granted'
                    ? 'Notifiche di sistema abilitate'
                    : permission === 'denied'
                    ? 'Notifiche bloccate nel browser'
                    : 'Notifiche non ancora attivate'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {permission === 'granted'
                    ? 'Il dispositivo riceverà avvisi sonori e popup per gli eventi.'
                    : permission === 'denied'
                    ? 'Sblocca i permessi dalle impostazioni del tuo browser per ricevere avvisi a schermo.'
                    : 'Attiva le notifiche push per non perdere uscite e scadenze.'}
                </div>
              </div>
              {permission !== 'granted' && permission !== 'unsupported' && (
                <button
                  type="button"
                  className="ios-btn ios-btn-primary ios-btn-sm"
                  onClick={handleRequestPermission}
                  style={{ flexShrink: 0 }}
                >
                  Abilita
                </button>
              )}
            </div>

            {/* Gruppo Toggle Preferenze */}
            <div
              style={{
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                borderRadius: '14px',
                border: '1px solid var(--color-border, #E0E0E0)',
                overflow: 'hidden',
              }}
            >
              {/* Toggle Generale */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border, #E0E0E0)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                    Attiva Notifiche
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Abilita il ricevitore di avvisi nell'app
                  </div>
                </div>
                <ToggleSwitch
                  checked={prefs.enabled}
                  onChange={(v) => handleUpdatePref('enabled', v)}
                  aria-label="Attiva Notifiche"
                />
              </div>

              {/* Promemoria Oggi */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border, #E0E0E0)',
                  opacity: prefs.enabled ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                    Promemoria Giorno dell'Evento
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Avviso la mattina dell'uscita o riunione
                  </div>
                </div>
                <ToggleSwitch
                  checked={prefs.eventsToday}
                  disabled={!prefs.enabled}
                  onChange={(v) => handleUpdatePref('eventsToday', v)}
                  aria-label="Promemoria Giorno dell'Evento"
                />
              </div>

              {/* Promemoria Giorno Prima */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border, #E0E0E0)',
                  opacity: prefs.enabled ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                    Promemoria 1 Giorno Prima
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Avviso 24 ore prima per preparare lo zaino
                  </div>
                </div>
                <ToggleSwitch
                  checked={prefs.eventsDayBefore}
                  disabled={!prefs.enabled}
                  onChange={(v) => handleUpdatePref('eventsDayBefore', v)}
                  aria-label="Promemoria 1 Giorno Prima"
                />
              </div>

              {/* Nuovi Eventi Aggiunti */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border, #E0E0E0)',
                  opacity: prefs.enabled ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                    Nuovi Appuntamenti
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Avvisa quando i Capi pubblicano un nuovo evento
                  </div>
                </div>
                <ToggleSwitch
                  checked={prefs.newEvents}
                  disabled={!prefs.enabled}
                  onChange={(v) => handleUpdatePref('newEvents', v)}
                  aria-label="Nuovi Appuntamenti"
                />
              </div>

              {/* Nuove Proposte Admin */}
              {isAdmin && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border, #E0E0E0)',
                    backgroundColor: 'var(--color-giochi-tenue, #F3E5F5)',
                    opacity: prefs.enabled ? 1 : 0.5,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                      ️ Proposte Modifiche da Approvare
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      Notifica immediata quando un membro propone canti, giochi o bans
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={prefs.adminProposte}
                    disabled={!prefs.enabled}
                    onChange={(v) => handleUpdatePref('adminProposte', v)}
                    aria-label="Proposte Modifiche da Approvare"
                  />
                </div>
              )}

              {/* Suono Notifiche */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  opacity: prefs.enabled ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                    Suono Discreto
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Doppio tocco armonico all'arrivo di avvisi
                  </div>
                </div>
                <ToggleSwitch
                  checked={prefs.sound}
                  disabled={!prefs.enabled}
                  onChange={(v) => handleUpdatePref('sound', v)}
                  aria-label="Suono Discreto"
                />
              </div>
            </div>

            {/* Test Notifica */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
              <button
                type="button"
                className="ios-btn ios-btn-secondary ios-btn-sm"
                onClick={handleTestNotification}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Icon name="bell" size={16} />
                <span>Invia notifica di prova con suono</span>
              </button>
            </div>
          </div>
        ) : (
          /* VISTA ELENCO NOTIFICHE */
          <>
            {/* Banner Richiesta Permessi (se non ancora concessi) */}
            {permission !== 'granted' && permission !== 'unsupported' && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-interactive-tenue, #EDE7F6)',
                  border: '1px solid var(--color-interactive, #462679)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon name="bell" size={24} className="text-primary" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-ink)' }}>
                      Non perdere uscite e riunioni
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      Attiva le notifiche del telefono per ricevere promemoria puntuali.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="ios-btn ios-btn-primary ios-btn-sm"
                  onClick={handleRequestPermission}
                  style={{ flexShrink: 0, padding: '6px 12px' }}
                >
                  Attiva
                </button>
              </div>
            )}

            {/* Segmented Control Filtri */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                className={`ios-btn ios-btn-sm ${filter === 'all' ? 'ios-btn-primary' : 'ios-btn-ghost'}`}
                onClick={() => setFilter('all')}
                style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '0.82rem' }}
              >
                Tutte ({notifications.length})
              </button>
              <button
                type="button"
                className={`ios-btn ios-btn-sm ${filter === 'eventi' ? 'ios-btn-primary' : 'ios-btn-ghost'}`}
                onClick={() => setFilter('eventi')}
                style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '0.82rem' }}
              >
                Eventi {countEventi > 0 && `(${countEventi})`}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className={`ios-btn ios-btn-sm ${filter === 'admin' ? 'ios-btn-primary' : 'ios-btn-ghost'}`}
                  onClick={() => setFilter('admin')}
                  style={{
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '0.82rem',
                    backgroundColor: filter === 'admin' ? undefined : countAdmin > 0 ? 'var(--color-bans-tenue, #FFF8E1)' : undefined,
                    color: filter === 'admin' ? undefined : countAdmin > 0 ? 'var(--color-bans-badge-text, #F57F17)' : undefined,
                  }}
                >
                  ️ Da Approvare {countAdmin > 0 && `(${countAdmin})`}
                </button>
              )}
            </div>

            {/* Lista Notifiche */}
            {filteredNotifications.length === 0 ? (
              <div
                style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-hover, #F5F5F5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="bell-off" size={24} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-ink)' }}>
                  Nessuna notifica presente
                </div>
                <div style={{ fontSize: '0.8rem', maxWidth: '280px' }}>
                  {filter === 'admin'
                    ? 'Non ci sono proposte in attesa di approvazione. Tutto in ordine!'
                    : 'I promemoria delle uscite e delle riunioni compariranno automaticamente qui.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '50vh', overflowY: 'auto' }}>
                {filteredNotifications.map((n) => {
                  const isProposal = n.type === 'proposta_nuova';
                  const isEvent = n.type === 'evento_promemoria' || n.type === 'evento_nuovo';

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleItemClick(n)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        backgroundColor: !n.read
                          ? isProposal
                            ? 'var(--color-bans-tenue, #FFF9C4)'
                            : 'var(--color-interactive-tenue, #F3E5F5)'
                          : 'var(--color-surface, #FFFFFF)',
                        border: `1px solid ${!n.read ? 'var(--color-interactive, #462679)' : 'var(--color-border, #E0E0E0)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      {/* Icona Tipo Notifica */}
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          backgroundColor: isProposal
                            ? 'var(--color-bans, #FF9800)'
                            : 'var(--color-primary, #462679)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon name={isProposal ? 'admin' : isEvent ? 'calendar' : 'bell'} size={18} />
                      </div>

                      {/* Contenuto Testuale */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span
                            style={{
                              fontWeight: !n.read ? 700 : 600,
                              fontSize: '0.88rem',
                              color: 'var(--color-ink)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {n.title}
                          </span>
                          {!n.read && (
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: isProposal ? 'var(--color-rosso, #E53935)' : 'var(--color-interactive, #462679)',
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </div>

                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-text-secondary)',
                            marginTop: '2px',
                            lineHeight: 1.35,
                          }}
                        >
                          {n.body}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: '8px',
                          }}
                        >
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted, #757575)' }}>
                            {formatTimestamp(n.timestamp)}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isProposal && (
                              <Badge variant="giallo" size="sm">
                                Revisiona
                              </Badge>
                            )}
                            {isEvent && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-interactive)' }}>
                                Apri calendario →
                              </span>
                            )}
                            <button
                              type="button"
                              className="ios-btn ios-btn-ghost ios-btn-sm"
                              style={{ padding: '2px 4px', height: '22px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAppNotification(n.id);
                              }}
                              aria-label="Elimina notifica"
                              title="Elimina notifica"
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Barra Azioni Inferiore */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--color-border, #E0E0E0)',
                paddingTop: '12px',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                className="ios-btn ios-btn-ghost ios-btn-sm"
                onClick={() => setShowSettings(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon name="settings" size={16} />
                <span>Preferenze</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="ios-btn ios-btn-ghost ios-btn-sm"
                    onClick={markAllNotificationsAsRead}
                    style={{ fontSize: '0.78rem' }}
                  >
                    Segna lette
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    className="ios-btn ios-btn-ghost ios-btn-sm"
                    onClick={clearAllNotifications}
                    style={{ fontSize: '0.78rem', color: 'var(--color-rosso, #E53935)' }}
                  >
                    Svuota
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
