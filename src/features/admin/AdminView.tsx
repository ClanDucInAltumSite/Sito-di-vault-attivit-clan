import { useState, useEffect, useRef } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { navigate } from '../../app/router';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { Button } from '../../ui/Button';
import { SectionIcon } from '../../ui/SectionIcon';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { Modal } from '../../ui/Modal';
import { useAdmin, logoutAdmin } from '../../lib/auth';
import {
  getTrashItems,
  exportBackupJson,
  exportAttachmentsManifestJson,
  validateAndPreviewBackupJson,
  executeBackupImport,
  BackupPreviewDiff,
} from '../../lib/admin_actions';
import { getDetailedCounts } from '../../lib/db';
import { getStorageUsageInfo, findOrphanStorageFiles, purgeOrphanStorageFiles, OrphanFileInfo } from '../../lib/attachments';
import { downloadAllAttachmentsForOffline, getOfflineAttachmentStats } from '../../lib/storage-cache';
import { supabase } from '../../lib/supabase';
import { DEFAULT_PARSED_SONGS } from '../../data/parsed_songs';
import { AdminLoginModal } from './AdminLoginModal';
import { TrashSheet } from './TrashSheet';

export function AdminView() {
  const { isAdmin, userEmail } = useAdmin();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [trashCount, setTrashCount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingManifest, setIsExportingManifest] = useState(false);

  // Stato Import Backup JSON
  const [backupPreview, setBackupPreview] = useState<BackupPreviewDiff | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conteggi dettagliati sezioni
  const [detailedCounts, setDetailedCounts] = useState<Record<string, { active: number; deleted: number; total: number }> | null>(null);

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
  const [isSeedingCanti, setIsSeedingCanti] = useState(false);

  const loadData = async () => {
    if (isAdmin) {
      try {
        const items = await getTrashItems();
        setTrashCount(items.length);

        const storage = await getStorageUsageInfo();
        setStorageInfo(storage);

        const offline = await getOfflineAttachmentStats();
        setOfflineStats(offline);

        const counts = await getDetailedCounts();
        setDetailedCounts(counts);
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

  const handleExportManifest = async () => {
    setIsExportingManifest(true);
    try {
      await exportAttachmentsManifestJson();
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'esportazione del manifest allegati');
    } finally {
      setIsExportingManifest(false);
    }
  };

  const handleSeedCanti = async () => {
    if (!isAdmin) return;
    if (!confirm('Vuoi caricare o aggiornare i 21 canti completi del Canzoniere direttamente nel database remoto Supabase?')) return;
    setIsSeedingCanti(true);
    try {
      const now = new Date().toISOString();
      const payload = DEFAULT_PARSED_SONGS.map((s) => ({
        ...s,
        updated_at: now,
        deleted_at: null,
      }));
      const { error } = await supabase.from('canti').upsert(payload);
      if (error) throw new Error(error.message);
      try {
        await supabase.rpc('bump_sync_epoch');
      } catch {
        // bump_sync_epoch opzionale
      }
      alert('21 canti caricati e aggiornati con successo nel database Supabase!');
      await loadData();
    } catch (err: any) {
      alert(`Errore caricamento canti su Supabase: ${err.message}`);
    } finally {
      setIsSeedingCanti(false);
    }
  };

  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const diff = await validateAndPreviewBackupJson(text);
      if (!diff.valid) {
        alert(diff.error || 'File di backup non valido o danneggiato.');
        return;
      }
      setBackupPreview(diff);
    } catch (err: any) {
      alert(err.message || 'Errore lettura file di backup');
    } finally {
      input.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!backupPreview) return;
    setIsImporting(true);
    try {
      const result = await executeBackupImport(backupPreview);
      setBackupPreview(null);
      await loadData();
      alert(`Importazione completata con successo!\n- Inseriti: ${result.inserted}\n- Aggiornati: ${result.updated}\n- Ignorati (già aggiornati): ${result.skipped}`);
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'importazione del backup');
    } finally {
      setIsImporting(false);
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
              subtitle={userEmail || 'Staff Capi (Admin)'}
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
              subtitle="Esporta l'intero archivio in JSON (testi, canti, date, ODG). NOTA: non contiene i file fisici (foto/PDF) in Storage."
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
            <GroupedRow
              leading={<Icon name="file" size={20} />}
              title="Elenco File Allegati in Storage"
              subtitle="Esporta l'elenco JSON di tutti i file in Storage con percorsi e URL diretti di download"
              trailing={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportManifest}
                  isLoading={isExportingManifest}
                >
                  <Icon name="download" size={14} />
                  <span>Esporta Elenco</span>
                </Button>
              }
            />
            <GroupedRow
              leading={<Icon name="upload" size={20} />}
              title={I18N.admin.ripristinaJson}
              subtitle="Importa un file JSON con anteprima differenziale e verifica schema"
              trailing={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTriggerImport}
                  isLoading={isImporting}
                >
                  <Icon name="upload" size={14} />
                  <span>Importa</span>
                </Button>
              }
            />
            <GroupedRow
              leading={<Icon name="canti" size={20} />}
              title="Carica 21 Canti nel Cloud (Supabase)"
              subtitle="Sincronizza i 21 canti completi del canzoniere con accordi, ritmi e BPM nel database remoto"
              trailing={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSeedCanti}
                  isLoading={isSeedingCanti}
                >
                  <Icon name="upload" size={14} />
                  <span>Carica Canti</span>
                </Button>
              }
            />
          </GroupedList>

          {/* Consistenza Archivio e Sezioni (Fase 8C) */}
          <GroupedList
            header="CONSISTENZA ARCHIVIO E CONTEGGI"
            footer="Riepilogo elementi attivi e archiviati nel cestino per ciascuna sezione del Vault."
          >
            <GroupedRow
              leading={<SectionIcon section="giochi" size="sm" />}
              title="Giochi"
              subtitle={`${detailedCounts?.giochi?.active ?? 0} attivi • ${detailedCounts?.giochi?.deleted ?? 0} nel cestino`}
              trailing={<Badge variant="giallo" size="sm">{detailedCounts?.giochi?.active ?? 0}</Badge>}
            />
            <GroupedRow
              leading={<SectionIcon section="bans" size="sm" />}
              title="Bans"
              subtitle={`${detailedCounts?.bans?.active ?? 0} attivi • ${detailedCounts?.bans?.deleted ?? 0} nel cestino`}
              trailing={<Badge variant="rosso" size="sm">{detailedCounts?.bans?.active ?? 0}</Badge>}
            />
            <GroupedRow
              leading={<SectionIcon section="canti" size="sm" />}
              title="Canti"
              subtitle={`${detailedCounts?.canti?.active ?? 0} attivi • ${detailedCounts?.canti?.deleted ?? 0} nel cestino`}
              trailing={<Badge variant="azzurro" size="sm">{detailedCounts?.canti?.active ?? 0}</Badge>}
            />
            <GroupedRow
              leading={<SectionIcon section="calendario" size="sm" />}
              title="Eventi & Calendario"
              subtitle={`${detailedCounts?.eventi?.active ?? 0} eventi attivi • ${detailedCounts?.odg_punti?.active ?? 0} punti ODG`}
              trailing={<Badge variant="neutral" size="sm">{detailedCounts?.eventi?.active ?? 0}</Badge>}
            />
            <GroupedRow
              leading={<Icon name="file" size={20} />}
              title="Allegati (File)"
              subtitle={`${detailedCounts?.allegati?.active ?? 0} file associati attivi`}
              trailing={<Badge variant="neutral" size="sm">{detailedCounts?.allegati?.active ?? 0}</Badge>}
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

          {/* DIAGNOSTICA E SVILUPPO (RISERVATA AGLI AMMINISTRATORI) */}
          <GroupedList header="STRUMENTI DI DIAGNOSTICA">
            <GroupedRow
              leading={<SectionIcon section="admin" size="sm" />}
              title="Stato Dati e Sincronizzazione"
              subtitle="Verifica integrità IndexedDB locale, cursori e tabelle"
              chevron
              onClick={() => navigate('stato-dati')}
            />
            <GroupedRow
              leading={<SectionIcon section="admin" size="sm" />}
              title="Sistema di Design (Palette OKLCH & Tokens)"
              subtitle="Verifica palette OKLCH, 5 foto testata, targa e motivi scout"
              chevron
              onClick={() => navigate('design')}
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

      {/* Input File Nascosto per Import Backup */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".json,application/json"
        style={{ display: 'none' }}
      />

      {/* Modale Anteprima Differenziale Import Backup JSON */}
      {backupPreview && (
        <Modal
          isOpen={true}
          onClose={() => setBackupPreview(null)}
          title="Anteprima Importazione Backup"
          footer={
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', width: '100%' }}>
              <Button variant="secondary" onClick={() => setBackupPreview(null)} disabled={isImporting}>
                Annulla
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                isLoading={isImporting}
                disabled={backupPreview.toInsert.length + backupPreview.toUpdate.length === 0}
              >
                Conferma e Applica ({backupPreview.toInsert.length + backupPreview.toUpdate.length} record)
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
              Verifica differenziale del backup completata. Controlla le modifiche prima di applicarle a Supabase e al database locale:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
              <div style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--color-fill-quaternary)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-ink)' }}>
                  {backupPreview.toInsert.length}
                </div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                  Nuovi da inserire
                </div>
              </div>
              <div style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--color-fill-quaternary)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-ink)' }}>
                  {backupPreview.toUpdate.length}
                </div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                  Da aggiornare
                </div>
              </div>
              <div style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--color-fill-quaternary)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {backupPreview.skippedOlder.length}
                </div>
                <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>
                  Ignorati (più recenti)
                </div>
              </div>
            </div>

            {backupPreview.toInsert.length + backupPreview.toUpdate.length === 0 ? (
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-fill-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)' }}>
                Nessuna novità rilevata: tutti i dati nel file di backup sono identici o più vecchi dei dati già presenti nel database.
              </div>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2)' }}>
                {backupPreview.toInsert.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', padding: '3px 0' }}>
                    <span style={{ fontWeight: 600 }}>[Nuovo {item.table}] {item.title}</span>
                    <Badge variant="giallo" size="sm">+ Inserisci</Badge>
                  </div>
                ))}
                {backupPreview.toUpdate.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', padding: '3px 0' }}>
                    <span style={{ fontWeight: 600 }}>[Modifica {item.table}] {item.title}</span>
                    <Badge variant="azzurro" size="sm">Aggiorna</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
