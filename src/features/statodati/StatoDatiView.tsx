import { useState, useEffect } from 'preact/hooks';
import { HeaderBanner } from '../../ui/HeaderBanner';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { CompassSync } from '../../ui/ScoutMotifs';
import { SectionIcon } from '../../ui/SectionIcon';
import { Icon } from '../../ui/Icon';
import {
  getDetailedCounts,
  getSyncMeta,
  ContentTableName,
  CONTENT_TABLES,
} from '../../lib/db';
import {
  syncNow,
  subscribeSyncState,
  SyncState,
  getSyncState,
} from '../../lib/sync';

export function StatoDatiView() {
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());
  const [counts, setCounts] = useState<Record<ContentTableName, { active: number; deleted: number; total: number }> | null>(null);
  const [cursors, setCursors] = useState<Record<string, string>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refreshLocalData = async () => {
    setIsLoadingCounts(true);
    try {
      const [detailed, meta] = await Promise.all([
        getDetailedCounts(),
        getSyncMeta(),
      ]);
      setCounts(detailed);
      setCursors(meta.table_cursors || {});
    } catch (err: any) {
      console.error('Errore lettura stato locale:', err);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeSyncState((state) => {
      setSyncState(state);
      refreshLocalData();
    });
    refreshLocalData();
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    setActionMessage('Avvio sincronizzazione incrementale...');
    await syncNow({ forceFull: false, trigger: 'stato_dati_manual' });
    await refreshLocalData();
    setActionMessage('Sincronizzazione completata.');
    setTimeout(() => setActionMessage(null), 3500);
  };

  const handleForceFullResync = async () => {
    setActionMessage('Avvio Full Resync Atomico (download completo in buffer temporaneo)...');
    await syncNow({ forceFull: true, trigger: 'stato_dati_force_full' });
    await refreshLocalData();
    setActionMessage('Full Resync atomico completato.');
    setTimeout(() => setActionMessage(null), 3500);
  };

  return (
    <div>
      <HeaderBanner
        photoId="home"
        title="Stato Dati e Sincronizzazione"
        section="neutral"
      />

      <div className="container">
        {/* MESSAGGIO FEEDBACK AZIONE */}
        {actionMessage ? (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-interactive-tenue)',
              color: 'var(--color-interactive)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Icon name="check" size={18} />
            <span>{actionMessage}</span>
          </div>
        ) : null}

        {/* STATO RETE E MOTORE SYNC */}
        <GroupedList header="STATO DELLA CONNESSIONE E SINCRONIZZAZIONE">
          <GroupedRow
            leading={<Icon name={syncState.isOnline ? 'check' : 'wifi-off'} size={20} />}
            title="Connettività di Rete"
            subtitle={syncState.isOnline ? 'Dispositivo online' : 'Dispositivo offline (sola lettura da IndexedDB)'}
            trailing={
              <Badge variant={syncState.isOnline ? 'azzurro' : 'rosso'} size="sm">
                {syncState.isOnline ? 'Online' : 'Offline'}
              </Badge>
            }
          />
          <GroupedRow
            leading={<CompassSync isSyncing={syncState.status === 'syncing'} size={24} />}
            title="Stato del Motore di Sync"
            subtitle={
              syncState.status === 'syncing'
                ? `Sincronizzazione in corso (Trigger: ${syncState.activeTrigger || 'sconosciuto'})`
                : syncState.status === 'error'
                ? `Errore: ${syncState.lastError}`
                : 'Inattivo (in attesa di segnale)'
            }
            trailing={
              <Badge
                variant={
                  syncState.status === 'syncing'
                    ? 'azzurro'
                    : syncState.status === 'error'
                    ? 'rosso'
                    : 'neutral'
                }
                size="sm"
              >
                {syncState.status === 'syncing' ? 'In corso…' : syncState.status === 'error' ? 'Errore' : 'Inattivo'}
              </Badge>
            }
          />
          <GroupedRow
            leading={<Icon name="clock" size={20} />}
            title="Ultimo Orario Server Sincronizzato"
            subtitle={syncState.lastSyncServerTime ? new Date(syncState.lastSyncServerTime).toLocaleString('it-IT') : 'Nessuna sincronizzazione effettuata'}
            trailing={
              <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {syncState.lastSyncServerTime ? syncState.lastSyncServerTime.slice(11, 19) : '—'}
              </span>
            }
          />
          <GroupedRow
            leading={<Icon name="refresh" size={20} />}
            title="Ultimo Completamento Locale"
            subtitle={syncState.lastSyncCompletedAt ? new Date(syncState.lastSyncCompletedAt).toLocaleString('it-IT') : 'N/D'}
          />
        </GroupedList>

        {/* CONTEGGI DETTAGLIATI INDEXEDDB */}
        <GroupedList header="RECORD LOCALI IN INDEXEDDB (ATTIVI / TOMBSTONES)">
          {CONTENT_TABLES.map((table) => {
            const tableData = counts ? counts[table] : null;
            return (
              <GroupedRow
                key={table}
                leading={
                  <SectionIcon
                    section={
                      table === 'giochi'
                        ? 'giochi'
                        : table === 'bans'
                        ? 'bans'
                        : table === 'canti'
                        ? 'canti'
                        : table === 'eventi'
                        ? 'calendario'
                        : 'admin'
                    }
                    size="sm"
                  />
                }
                title={`Tabella '${table}'`}
                subtitle={
                  isLoadingCounts
                    ? 'Conteggio in corso...'
                    : tableData
                    ? `Attivi: ${tableData.active} • Eliminati (tombstone): ${tableData.deleted}`
                    : 'Dato non disponibile'
                }
                trailing={
                  <span className="tabular-nums" style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                    {tableData ? `${tableData.active} / ${tableData.total}` : '—'}
                  </span>
                }
              />
            );
          })}
        </GroupedList>

        {/* CURSORI PER TABELLA */}
        <GroupedList header="CURSORI DI SINCRONIZZAZIONE PER TABELLA">
          {CONTENT_TABLES.map((table) => (
            <GroupedRow
              key={table}
              leading={<Icon name="chevron-right" size={16} />}
              title={table}
              subtitle={cursors[table] ? `Cursore: ${cursors[table]}` : 'Nessun cursore (utilizza ultimo orario globale)'}
              trailing={
                <span className="tabular-nums" style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                  {cursors[table] ? cursors[table].slice(0, 10) : '—'}
                </span>
              }
            />
          ))}
        </GroupedList>

        {/* PULSANTI DI COMANDO */}
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Button
            variant="primary"
            onClick={handleManualSync}
            disabled={syncState.status === 'syncing' || !syncState.isOnline}
          >
            Sincronizza Ora (Incrementale 4s)
          </Button>

          <Button
            variant="secondary"
            onClick={handleForceFullResync}
            disabled={syncState.status === 'syncing' || !syncState.isOnline}
          >
            Forza Full Resync Atomico (25s)
          </Button>

          <Button
            variant="ghost"
            onClick={refreshLocalData}
            disabled={isLoadingCounts}
          >
            Ricarica Dati da IndexedDB Locale
          </Button>
        </div>
      </div>
    </div>
  );
}
