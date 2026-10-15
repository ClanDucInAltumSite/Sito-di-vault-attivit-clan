import { useState, useEffect } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { Button } from '../../ui/Button';
import { SectionIcon } from '../../ui/SectionIcon';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { useAdmin, logoutAdmin } from '../../lib/auth';
import { getTrashItems, exportBackupJson } from '../../lib/admin_actions';
import { getStorageUsageInfo, findOrphanStorageFiles, purgeOrphanStorageFiles, OrphanFileInfo } from '../../lib/attachments';
import { downloadAllAttachmentsForOffline, getOfflineAttachmentStats } from '../../lib/storage-cache';
import { AdminLoginModal } from './AdminLoginModal';
import { TrashSheet } from './TrashSheet';

export function AdminView() {
  const { isAdmin, userEmail } = useAdmin();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [trashCount, setTrashCount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);

  // Stato Storage e Allegati
  const [storageInfo, setStorageInfo] = useState<{
    usedFormatted: string;
    totalFormatted: string;
    percent: number;
    attachmentCount: number;
  }>({ usedFormatted: '0 B', totalFormatted: '1 GB', percent: 0, attachmentCount: 0 });

  const [orphanFiles, setOrphanFiles] = useState<OrphanFileInfo[]>([]);
  const [isScanningOrphans, setIsScanningOrphans] = useState(false);
  const [isPurgingOrphans, setIsPurgingOrphans] = useState(false);

  // Stato Download Offline Allegati
  const [offlineStats, setOfflineStats] = useState<{ cached: number; total: number }>({ cached: 0, total: 0 });
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const loadData = async () => {
    if (isAdmin) {
      try {
        const items = await getTrashItems();
        setTrashCount(items.length);

        const storage = await getStorageUsageInfo();
        setStorageInfo(storage);

        const offline = await getOfflineAttachmentStats();
        setOfflineStats(offline);
      } catch (_err) {
        // Fallback silenzioso
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const handleScanOrphans = async () => {
    setIsScanningOrphans(true);
    try {
      const orphans = await findOrphanStorageFiles();
      setOrphanFiles(orphans);
      if (orphans.length === 0) {
        alert('Nessun file orfano rilevato nel bucket Storage!\n(Nota: i file appena caricati da meno di 24 ore o con riga nel cestino sono protetti).');
      }
    } catch (err: any) {
      alert(err.message || 'Errore scansione file orfani');
    } finally {
      setIsScanningOrphans(false);
    }
  };

  const handlePurgeOrphans = async () => {
    if (orphanFiles.length === 0) return;
    const fileListText = orphanFiles.map((f) => `- ${f.name} (${f.sizeFormatted}, caricato ${f.ageHours} ore fa)`).join('\n');
    if (
      !confirm(
        `ATTENZIONE: Stai per eliminare DEFINITIVAMENTE i seguenti ${orphanFiles.length} file orfani (> 24 ore senza record):\n\n${fileListText}\n\nConfermi l'eliminazione definitiva dallo Storage?`
      )
    ) {
      return;
    }

    setIsPurgingOrphans(true);
    try {
      const paths = orphanFiles.map((f) => f.path);
      await purgeOrphanStorageFiles(paths);
      setOrphanFiles([]);
      await loadData();
      alert('File orfani rimossi con successo dallo Storage!');
    } catch (err: any) {
      alert(err.message || 'Errore durante la pulizia dei file orfani');
    } finally {
      setIsPurgingOrphans(false);
    }
  };

  const handleDownloadAllOffline = async () => {
    setIsDownloadingOffline(true);
    setDownloadProgress(0);
    try {
      await downloadAllAttachmentsForOffline((_curr, _tot, pct) => {
        setDownloadProgress(pct);
      });
      await loadData();
      alert('Tutti gli allegati sono stati scaricati nella cache offline con successo!');
    } catch (err: any) {
      alert(err.message || 'Errore durante il download degli allegati');
    } finally {
      setIsDownloadingOffline(false);
      setDownloadProgress(0);
    }
  };

  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      await exportBackupJson();
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'esportazione del backup');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
      {/* Intestazione Sezione */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <SectionIcon section="admin" size="md" />
          <div>
            <h1
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 700,
                color: 'var(--color-ink)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {I18N.admin.title}
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                margin: '2px 0 0',
              }}
            >
              Area riservata per capi e amministratori del clan
            </p>
          </div>
        </div>
        {isAdmin ? (
          <Button variant="secondary" size="sm" onClick={() => logoutAdmin()}>
            {I18N.auth.logoutButton}
          </Button>
        ) : null}
      </div>

      {!isAdmin ? (
        <GroupedList header="AUTENTICAZIONE RICHIESTA">
          <div style={{ padding: 'var(--space-6) var(--space-4)', textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-border-subtle)',
                color: 'var(--color-interactive)',
                marginBottom: 'var(--space-3)',
              }}
            >
              <Icon name="admin" size={32} />
            </div>
            <h2
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                color: 'var(--color-ink)',
                marginBottom: 'var(--space-1)',
              }}
            >
              {I18N.auth.loginTitle}
            </h2>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
                maxWidth: '400px',
                margin: '0 auto var(--space-4)',
              }}
            >
              {I18N.auth.loginDescription}
            </p>
            <Button variant="primary" onClick={() => setIsLoginOpen(true)}>
              {I18N.auth.loginButton}
            </Button>
          </div>
        </GroupedList>
      ) : (
        <>
          {/* Stato Sessione Admin */}
          <GroupedList header="STATO SESSIONE">
            <GroupedRow
              leading={<Icon name="check" size={20} />}
              title={I18N.auth.loggedInAsAdmin}
              subtitle={userEmail || 'admin@clan.scout'}
              trailing={<Badge variant="azzurro" size="sm">Attiva</Badge>}
            />
          </GroupedList>

          {/* Manutenzione e Cestino */}
          <GroupedList
            header="GESTIONE DATI E CESTINO"
            footer="Gli elementi eliminati restano nel cestino per 180 giorni prima della pulizia definitiva."
          >
            <GroupedRow
              leading={<Icon name="trash" size={20} />}
              title={I18N.admin.cestino}
              subtitle={
                trashCount === 0
                  ? I18N.admin.cestinoVuoto
                  : `${trashCount} ${trashCount === 1 ? 'elemento nel cestino' : 'elementi nel cestino'}`
              }
              trailing={
                <Badge variant={trashCount > 0 ? 'giallo' : 'neutral'} size="sm">
                  {trashCount} {trashCount === 1 ? 'elemento' : 'elementi'}
                </Badge>
              }
              chevron
              onClick={() => setIsTrashOpen(true)}
            />
            <GroupedRow
              leading={<Icon name="download" size={20} />}
              title={I18N.admin.backupJson}
              subtitle="Esporta l'intero archivio in un file JSON scaricabile localmente"
              trailing={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportJson}
                  isLoading={isExporting}
                >
                  <Icon name="download" size={14} />
                  <span>Esporta</span>
                </Button>
              }
            />
          </GroupedList>

          {/* Sistema & Infrastruttura Storage (Fase 5) */}
          <GroupedList
            header="INFRASTRUTTURA SUPABASE E ALLEGATI"
            footer="Supabase Free Tier: 1 GB di storage per allegati. La Cache API memorizza localmente i file per la consultazione offline."
          >
            <GroupedRow
              leading={<Icon name="settings" size={20} />}
              title={I18N.admin.spazioStorage}
              subtitle={`${storageInfo.attachmentCount} allegati attivi • ${storageInfo.usedFormatted} di ${storageInfo.totalFormatted} (${storageInfo.percent}%)`}
              trailing={
                <Badge variant={storageInfo.percent > 85 ? 'rosso' : 'azzurro'} size="sm">
                  {storageInfo.percent}%
                </Badge>
              }
            />

            {/* Gestione File Orfani */}
            <GroupedRow
              leading={<Icon name="file" size={20} />}
              title="File Orfani in Storage"
              subtitle={
                orphanFiles.length > 0
                  ? `${orphanFiles.length} file orfani individuati nel bucket (> 24h senza record)`
                  : 'Nessun file orfano rilevato (protetti file < 24h o nel cestino)'
              }
              trailing={
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleScanOrphans}
                    isLoading={isScanningOrphans}
                  >
                    <span>Scansiona</span>
                  </Button>
                  {orphanFiles.length > 0 && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handlePurgeOrphans}
                      isLoading={isPurgingOrphans}
                      style={{ backgroundColor: 'var(--color-bans)' }}
                    >
                      <span>Ripulisci</span>
                    </Button>
                  )}
                </div>
              }
            />

            {/* Elenco Dettagliato File Orfani (mostrato solo dopo scansione) */}
            {orphanFiles.length > 0 && (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-surface)',
                  borderTop: '0.5px solid var(--color-border-subtle)',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    color: 'var(--color-ink)',
                    marginBottom: 'var(--space-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Dettaglio File Orfani Rilevati ({orphanFiles.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {orphanFiles.map((f) => (
                    <div
                      key={f.path}
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                        borderBottom: '0.5px solid var(--color-border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '70%' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-all' }}>
                          {f.name}
                        </span>
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                          {f.path}
                        </span>
                      </div>
                      <span style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {f.sizeFormatted} • {f.ageHours}h fa
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download Offline Allegati */}
            <GroupedRow
              leading={<Icon name="download" size={20} />}
              title="Archivio Offline Allegati"
              subtitle={`${offlineStats.cached} di ${offlineStats.total} allegati disponibili offline`}
              trailing={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadAllOffline}
                  isLoading={isDownloadingOffline}
                >
                  <Icon name="download" size={14} />
                  <span>
                    {isDownloadingOffline
                      ? `${downloadProgress}%`
                      : offlineStats.cached >= offlineStats.total && offlineStats.total > 0
                      ? 'Aggiorna'
                      : 'Scarica tutto'}
                  </span>
                </Button>
              }
            />

            <GroupedRow
              leading={<Icon name="refresh" size={20} />}
              title={I18N.admin.statoKeepalive}
              subtitle="Database attivo • Prossimo heartbeat automatico programmato"
              trailing={<Badge variant="azzurro" size="sm">OK</Badge>}
            />
          </GroupedList>
        </>
      )}

      {/* Modale BottomSheet Login */}
      <AdminLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => {
          setIsLoginOpen(false);
          loadData();
        }}
      />

      {/* Sheet Gestione Cestino */}
      <TrashSheet
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        onItemsChanged={loadData}
      />
    </div>
  );
}
