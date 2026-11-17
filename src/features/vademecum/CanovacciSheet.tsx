// src/features/vademecum/CanovacciSheet.tsx
// Scheda interattiva per consultare, scaricare e gestire i Canovacci per Pattuglie
// Supporta allegati PDF (PowerPoint convertiti in PDF), visualizzazione testo espandibile e gestione admin

import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { DeleteConfirmModal } from '../../ui/DeleteConfirmModal';
import { VademecumItem, deleteVademecumItem } from '../../lib/vademecum';
import { useAdmin } from '../../lib/auth';
import { getPropostePerVisualizzazione, approvaPropostaAdmin, ritiraPropostaLocale, subscribeProposte, PropostaItem } from '../../lib/proposte';
import { QuadernoDocRenderer } from '../quaderno/QuadernoDocRenderer';
import { VademecumEditSheet } from './VademecumEditSheet';
import { RifiutaPropostaModal } from '../admin/RifiutaPropostaModal';

export interface CanovacciSheetProps {
  items: VademecumItem[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function CanovacciSheet({
  items,
  isOpen,
  onClose,
  onRefresh,
}: CanovacciSheetProps) {
  const { isAdmin } = useAdmin();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VademecumItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<VademecumItem | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [pendingProposteMap, setPendingProposteMap] = useState<Map<string, PropostaItem>>(new Map());
  const [rejectingProposta, setRejectingProposta] = useState<PropostaItem | null>(null);

  const checkPending = async () => {
    const list = await getPropostePerVisualizzazione('canovacci', isAdmin);
    const map = new Map<string, PropostaItem>();
    list.forEach((p) => map.set(p.id, p));
    setPendingProposteMap(map);
    setPendingIds(new Set(list.map((p) => p.id)));
  };

  useEffect(() => {
    checkPending();
    const unsub = subscribeProposte(() => {
      checkPending();
      onRefresh();
    });
    return () => unsub();
  }, [items, isAdmin]);

  if (!isOpen) return null;

  const handleOpenPdf = (item: VademecumItem) => {
    if (!item.pdfDataUrl) return;
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${item.pdfDataUrl}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`
      );
      win.document.title = item.pdfNome || item.titolo;
    }
  };

  const handleDownloadPdf = (item: VademecumItem) => {
    if (!item.pdfDataUrl) return;
    const a = document.createElement('a');
    a.href = item.pdfDataUrl;
    a.download = item.pdfNome || `${item.titolo}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCreateNew = () => {
    setEditingItem(null);
    setIsEditOpen(true);
  };

  const handleEdit = (item: VademecumItem) => {
    setEditingItem(item);
    setIsEditOpen(true);
  };

  const handleDeleteRequest = (item: VademecumItem) => {
    setDeletingItem(item);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    try {
      await deleteVademecumItem(deletingItem.id);
      onRefresh();
      setIsDeleteOpen(false);
      setDeletingItem(null);
    } catch (err) {
      console.error('Errore eliminazione canovaccio:', err);
    }
  };

  const formatSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <BottomSheet
        isOpen={isOpen && !isEditOpen}
        onClose={onClose}
        title="Canovacci per Pattuglie"
        subtitle="Tracce per uscite, veglie, verifiche e guide PDF"
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Button variant="primary" size="sm" onClick={handleCreateNew}>
              <Icon name="plus" size={15} />
              <span>{isAdmin ? 'Nuovo Canovaccio' : 'Proponi Canovaccio'}</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-6)' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-2)' }}>
              <Icon name="file" size={32} style={{ color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)' }} />
              <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text)' }}>
                Nessun canovaccio presente
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 0' }}>
                {isAdmin
                  ? 'Tocca "Nuovo Canovaccio" in basso per aggiungere la prima traccia o caricare un PDF.'
                  : 'I canovacci e le presentazioni verranno caricati dagli Admin.'}
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isExpanded = expandedId === item.id;
              const isPending = pendingIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={isPending ? 'proposta-pending-card' : undefined}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: isPending ? '1.5px dashed var(--color-interactive)' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-4)',
                    boxShadow: 'var(--shadow-rest)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  {/* Titolo e Descrizione */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text)' }}>
                        {item.titolo}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        {isPending && (
                          <Badge variant="giallo" size="sm">
                            In attesa
                          </Badge>
                        )}
                        {item.pdfNome && (
                          <Badge variant="azzurro" size="sm">
                            PDF
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.descrizioneBreve && (
                      <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                        {item.descrizioneBreve}
                      </p>
                    )}
                    {isPending && (
                      <span className="proposta-pending-caption">
                        {isAdmin && pendingProposteMap.get(item.id)?.proponente_nome
                          ? `Proposto da: ${pendingProposteMap.get(item.id)?.proponente_nome} • In attesa di approvazione`
                          : isAdmin
                          ? 'In attesa di approvazione dell\'Admin'
                          : 'Visibile solo su questo dispositivo fino all\'approvazione dell\'Admin'}
                      </span>
                    )}
                  </div>

                  {/* Scheda PDF se allegato */}
                  {item.pdfDataUrl && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border-subtle)',
                        gap: 'var(--space-2)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: '150px' }}>
                        <Icon name="file" size={18} style={{ color: 'var(--color-bans)' }} />
                        <div>
                          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)' }}>
                            {item.pdfNome || 'Slide / Documento PDF'}
                          </div>
                          {item.pdfSize && (
                            <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-tertiary)' }}>
                              {formatSize(item.pdfSize)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <Button variant="secondary" size="sm" onClick={() => handleOpenPdf(item)}>
                          <Icon name="eye" size={13} />
                          <span>Apri PDF</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadPdf(item)} aria-label="Scarica PDF">
                          <Icon name="download" size={15} />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Testo Traccia Espandibile */}
                  {item.contenuto && (
                    <div>
                      {isExpanded ? (
                        <div
                          className="doc-rendered-body"
                          style={{
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-border-subtle)',
                            fontSize: 'var(--font-size-sm)',
                            lineHeight: 1.5,
                            marginTop: 'var(--space-1)',
                          }}
                        >
                          <QuadernoDocRenderer content={item.contenuto} />
                          <div style={{ marginTop: 'var(--space-3)', textAlign: 'right' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedId(null)}
                            >
                              <Icon name="chevron-up" size={14} />
                              <span>Nascondi traccia</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(item.id)}
                          style={{ padding: '4px 0', color: 'var(--color-interactive)' }}
                        >
                          <Icon name="chevron-down" size={14} />
                          <span>Leggi traccia completa</span>
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Pulsanti Azioni */}
                  {isAdmin && isPending ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 'var(--space-2)',
                        borderTop: '1px solid var(--color-border-subtle)',
                        paddingTop: 'var(--space-2)',
                        marginTop: 'var(--space-1)',
                      }}
                    >
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          const prop = pendingProposteMap.get(item.id);
                          if (prop) setRejectingProposta(prop);
                        }}
                      >
                        <Icon name="close" size={14} />
                        <span>Rifiuta</span>
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          const prop = pendingProposteMap.get(item.id);
                          if (prop) {
                            await approvaPropostaAdmin(prop);
                            onRefresh();
                          }
                        }}
                      >
                        <Icon name="check" size={14} />
                        <span>Approva</span>
                      </Button>
                    </div>
                  ) : isAdmin ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 'var(--space-2)',
                        borderTop: '1px solid var(--color-border-subtle)',
                        paddingTop: 'var(--space-2)',
                        marginTop: 'var(--space-1)',
                      }}
                    >
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                        <Icon name="edit" size={14} />
                        <span>Modifica</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRequest(item)}
                        style={{ color: 'var(--color-bans)' }}
                      >
                        <Icon name="trash" size={14} />
                        <span>Elimina</span>
                      </Button>
                    </div>
                  ) : isPending ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        borderTop: '1px solid var(--color-border-subtle)',
                        paddingTop: 'var(--space-2)',
                        marginTop: 'var(--space-1)',
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await ritiraPropostaLocale(item.id);
                          onRefresh();
                        }}
                        style={{ color: 'var(--color-bans)' }}
                      >
                        <Icon name="trash" size={14} />
                        <span>Ritira proposta</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </BottomSheet>

      {/* Editor per aggiunta o modifica */}
      {isEditOpen && (
        <VademecumEditSheet
          item={editingItem}
          section="canovaccio"
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSaved={() => {
            onRefresh();
            setIsEditOpen(false);
          }}
        />
      )}

      {/* Modale conferma eliminazione */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={deletingItem?.titolo || ''}
        itemTypeLabel="canovaccio"
      />

      {/* Modal In-App Rifiuta Proposta e Blocco Utente (Admin) */}
      <RifiutaPropostaModal
        proposta={rejectingProposta}
        isOpen={Boolean(rejectingProposta)}
        onClose={() => setRejectingProposta(null)}
        onSuccess={async () => {
          onRefresh();
        }}
      />
    </>
  );
}
