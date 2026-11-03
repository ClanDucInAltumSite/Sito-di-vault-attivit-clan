// src/features/quaderno/QuadernoView.tsx
// Vista principale del Quaderno di Clan: verbali, verifiche di percorso e memorie cronologiche

import { useState, useEffect, useMemo } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { SearchField } from '../../ui/SearchField';
import { HeaderBanner } from '../../ui/HeaderBanner';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { QuadernoPagina, QuadernoCategoria, getQuadernoPagine } from '../../lib/db';
import { deleteQuadernoPagina } from '../../lib/admin_actions';
import { useAdmin } from '../../lib/auth';
import { subscribeSyncState } from '../../lib/sync';
import { QuadernoReadingMode } from './QuadernoReadingMode';
import { QuadernoFormSheet } from './QuadernoFormSheet';
import { QuadernoDocEditor } from './QuadernoDocEditor';
import { stripQuadernoSnippet } from './quaderno_dom';
import { DeleteConfirmModal } from '../../ui/DeleteConfirmModal';

type CategoryFilter = 'tutte' | QuadernoCategoria;

export function QuadernoView() {
  const { isAdmin } = useAdmin();
  const [pagine, setPagine] = useState<QuadernoPagina[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>('tutte');

  // Sheets, Modalità Lettura a Grande Schermo ed Editor
  const [selectedPagina, setSelectedPagina] = useState<QuadernoPagina | null>(null);
  const [isReadingModeOpen, setIsReadingModeOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPagina, setEditingPagina] = useState<QuadernoPagina | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingPagina, setDeletingPagina] = useState<QuadernoPagina | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    try {
      const list = await getQuadernoPagine(false);
      setPagine(list);
    } catch (err) {
      console.error('Errore caricamento quaderno:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeSyncState(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const filteredPagine = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pagine.filter((p) => {
      if (filterCategory !== 'tutte' && p.categoria !== filterCategory) {
        return false;
      }
      if (!q) return true;
      return (
        p.titolo.toLowerCase().includes(q) ||
        p.contenuto.toLowerCase().includes(q) ||
        p.data.includes(q)
      );
    });
  }, [pagine, search, filterCategory]);

  const handleOpenNew = () => {
    setEditingPagina(null);
    setIsFormOpen(true);
  };

  const handleEdit = (p: QuadernoPagina) => {
    setIsReadingModeOpen(false);
    setEditingPagina(p);
    setIsEditorOpen(true);
  };

  const handleDeleteRequest = (p: QuadernoPagina) => {
    setDeletingPagina(p);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPagina) return;
    setIsDeleting(true);
    try {
      await deleteQuadernoPagina(deletingPagina.id);
      await loadData();
      setIsDeleteOpen(false);
      setDeletingPagina(null);
      if (selectedPagina?.id === deletingPagina.id) {
        setIsReadingModeOpen(false);
        setSelectedPagina(null);
      }
    } catch (err) {
      console.error('Errore eliminazione pagina:', err);
      alert('Impossibile eliminare la pagina. Verifica la connessione.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaved = (saved: QuadernoPagina) => {
    loadData();
    setSelectedPagina(saved);
  };

  const categoryFilters: { key: CategoryFilter; label: string }[] = [
    { key: 'tutte', label: I18N.quaderno.filtroTutte },
    { key: 'riunione', label: I18N.quaderno.categorie.riunione },
    { key: 'punto_strada', label: I18N.quaderno.categorie.punto_strada },
    { key: 'verifica', label: I18N.quaderno.categorie.verifica },
    { key: 'libero', label: I18N.quaderno.categorie.libero },
  ];

  const getMonthShort = (dateStr: string): string => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
      return d.toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    }
    return '';
  };

  const getDay = (dateStr: string): string => {
    const parts = dateStr.split('-');
    return parts[2] ? String(Number(parts[2])) : '--';
  };

  const getYear = (dateStr: string): string => {
    const parts = dateStr.split('-');
    return parts[0] || '';
  };

  return (
    <div>
      <HeaderBanner
        photoId="quaderno"
        title={I18N.quaderno.title}
        count={`${pagine.length} ${pagine.length === 1 ? 'pagina archiviata' : 'pagine archiviate'}`}
        section="quaderno"
      />

      <div className="container" style={{ position: 'relative', paddingTop: 'var(--space-4)', paddingBottom: 'calc(var(--tab-bar-height, 64px) + 32px)' }}>
        {/* Barra azione Admin (visibile SOLO con sessione admin valida) */}
        {isAdmin && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 'var(--space-3)',
            }}
          >
            <Button variant="primary" size="sm" onClick={handleOpenNew}>
              <Icon name="plus" size={16} />
              <span>{I18N.quaderno.nuovaPagina}</span>
            </Button>
          </div>
        )}

        {/* Barra di ricerca */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <SearchField
            value={search}
            onInput={setSearch}
            placeholder="Cerca per titolo, contenuto o data..."
          />
        </div>

        {/* Filtri Categoria a Pillole */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            overflowX: 'auto',
            paddingBottom: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
          role="tablist"
          aria-label="Filtro categorie quaderno"
        >
          {categoryFilters.map((cf) => {
            const isActive = filterCategory === cf.key;
            return (
              <button
                key={cf.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilterCategory(cf.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full, 9999px)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: isActive ? 700 : 500,
                  whiteSpace: 'nowrap',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--color-quaderno)' : 'var(--color-border)',
                  backgroundColor: isActive ? 'var(--color-quaderno)' : 'var(--color-surface)',
                  color: isActive ? 'oklch(1 0 0)' : 'var(--color-text)',
                  cursor: 'pointer',
                  transition: 'all var(--duration-fast) var(--ease-ios)',
                }}
              >
                {cf.label}
              </button>
            );
          })}
        </div>

        {/* Lista Cronologica delle Pagine */}
        {filteredPagine.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {filteredPagine.map((pagina) => {
              const dayStr = getDay(pagina.data);
              const monthStr = getMonthShort(pagina.data);
              const yearStr = getYear(pagina.data);
              const categoryLabel = I18N.quaderno.categorie[pagina.categoria] || I18N.quaderno.categorie.libero;

              // Estratto di 2 righe pulito da ogni markup interno
              const cleanText = stripQuadernoSnippet(pagina.contenuto || '');
              const snippet = cleanText
                ? cleanText.slice(0, 110) + (cleanText.length > 110 ? '…' : '')
                : I18N.quaderno.emptyContent;

              return (
                <div
                  key={pagina.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedPagina(pagina);
                    setIsReadingModeOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPagina(pagina);
                      setIsReadingModeOpen(true);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-rest)',
                    cursor: 'pointer',
                    transition: 'transform var(--duration-fast) var(--ease-ios), background-color var(--duration-fast) var(--ease-ios)',
                  }}
                >
                  {/* Blocco Data Calendario/Stile Parete */}
                  <div
                    style={{
                      width: '52px',
                      minWidth: '52px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      overflow: 'hidden',
                      backgroundColor: 'var(--color-surface)',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      userSelect: 'none',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        backgroundColor:
                          pagina.categoria === 'riunione'
                            ? 'var(--color-brand-purple)'
                            : pagina.categoria === 'punto_strada'
                            ? 'var(--color-canti)'
                            : pagina.categoria === 'verifica'
                            ? 'var(--color-uscita)'
                            : 'var(--color-giochi)',
                        color:
                          pagina.categoria === 'libero' ? 'var(--color-giochi-text)' : 'oklch(1 0 0)',
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        padding: '2px 0',
                        lineHeight: 1.2,
                      }}
                    >
                      {monthStr}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 700,
                        color: 'var(--color-ink)',
                        padding: '2px 0',
                        lineHeight: 1.1,
                      }}
                    >
                      {dayStr}
                    </div>
                    <div
                      style={{
                        fontSize: '9px',
                        color: 'var(--color-text-secondary)',
                        paddingBottom: '2px',
                      }}
                    >
                      {yearStr}
                    </div>
                  </div>

                  {/* Corpo della Pagina */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '3px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          padding: '1px 7px',
                          borderRadius: 'var(--radius-full, 9999px)',
                          backgroundColor:
                            pagina.categoria === 'riunione'
                              ? 'var(--color-brand-purple-tenue)'
                              : pagina.categoria === 'punto_strada'
                              ? 'var(--color-canti-tenue)'
                              : pagina.categoria === 'verifica'
                              ? 'var(--color-uscita-tenue)'
                              : 'var(--color-giochi-tenue)',
                          color:
                            pagina.categoria === 'riunione'
                              ? 'var(--color-brand-purple-text)'
                              : pagina.categoria === 'punto_strada'
                              ? 'var(--color-canti-text)'
                              : pagina.categoria === 'verifica'
                              ? 'var(--color-uscita-text)'
                              : 'var(--color-giochi-badge-text)',
                        }}
                      >
                        {categoryLabel}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 700,
                        color: 'var(--color-ink)',
                        lineHeight: 1.3,
                        marginBottom: '3px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {pagina.titolo}
                    </div>

                    <div
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {snippet}
                    </div>
                  </div>

                  <div style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                    <Icon name="chevron-right" size={18} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: 'var(--space-8) var(--space-4)',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
              <Icon name="book-open" size={36} strokeWidth={1.5} />
            </div>
            <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
              {search || filterCategory !== 'tutte'
                ? 'Nessuna pagina corrisponde ai filtri di ricerca.'
                : I18N.quaderno.empty}
            </p>
            {isAdmin && !search && filterCategory === 'tutte' && (
              <Button variant="primary" size="sm" onClick={handleOpenNew}>
                <Icon name="plus" size={16} />
                <span>{I18N.quaderno.nuovaPagina}</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modalità Lettura a Grande Schermo stile Documenti Google / Canti */}
      <QuadernoReadingMode
        pagina={selectedPagina}
        isOpen={isReadingModeOpen}
        onClose={() => {
          setIsReadingModeOpen(false);
          setSelectedPagina(null);
        }}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
      />

      {/* Sheet Creazione Iniziale */}
      <QuadernoFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={handleSaved}
        onOpenEditor={(saved) => {
          setEditingPagina(saved);
          setIsEditorOpen(true);
        }}
        initialPagina={editingPagina}
      />

      {/* Editor Schermata Grande stile Documenti Google */}
      {editingPagina && (
        <QuadernoDocEditor
          pagina={editingPagina}
          isOpen={isEditorOpen}
          onClose={(updated) => {
            setIsEditorOpen(false);
            loadData();
            setSelectedPagina(updated);
            setIsReadingModeOpen(true);
          }}
        />
      )}

      {/* Modal Conferma Eliminazione in due passaggi (Admin) */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingPagina(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={deletingPagina?.titolo || ''}
        isLoading={isDeleting}
      />
    </div>
  );
}
