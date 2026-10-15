import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { GroupedList } from '../../ui/GroupedList';
import { GroupedRow } from '../../ui/GroupedRow';
import { SearchField } from '../../ui/SearchField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SectionIcon } from '../../ui/SectionIcon';
import { HeaderBanner } from '../../ui/HeaderBanner';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Gioco, getGiochi } from '../../lib/db';
import { useAdmin } from '../../lib/auth';
import { matchesQuery, HighlightText } from '../../lib/search';
import { softDeleteRecord } from '../../lib/admin_actions';
import { subscribeSyncState } from '../../lib/sync';
import { GiocoDetailSheet } from './GiocoDetailSheet';
import { GiocoFormSheet } from './GiocoFormSheet';
import { DeleteConfirmModal } from '../../ui/DeleteConfirmModal';

type SortOption = 'az' | 'za' | 'recenti' | 'vecchi';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function GiochiView() {
  const { isAdmin } = useAdmin();
  const [giochi, setGiochi] = useState<Gioco[]>([]);

  // Ripristino stato da sessionStorage
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem('giochi_search') || '';
    }
    return '';
  });

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const [sort, setSort] = useState<SortOption>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = sessionStorage.getItem('giochi_sort') as SortOption;
      if (['az', 'za', 'recenti', 'vecchi'].includes(saved)) return saved;
    }
    return 'az';
  });

  // Modali e Sheet
  const [selectedGioco, setSelectedGioco] = useState<Gioco | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGioco, setEditingGioco] = useState<Gioco | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingGioco, setDeletingGioco] = useState<Gioco | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debounceTimerRef = useRef<any>(null);

  // Caricamento dati da IndexedDB
  const loadData = async () => {
    const list = await getGiochi(false);
    setGiochi(list);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeSyncState(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  // Gestione ricerca con debounce ~200 ms e persistenza in sessionStorage
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('giochi_search', val);
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val);
    }, 200);
  };

  // Gestione ordinamento e persistenza in sessionStorage
  const handleSortChange = (val: string) => {
    const s = val as SortOption;
    setSort(s);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('giochi_sort', s);
    }
  };

  // Filtraggio deterministico multi-campo con tolleranza ai typo
  const filteredList = useMemo(() => {
    let result = giochi.filter((g) =>
      matchesQuery(debouncedSearch, g.nome, g.regole, g.materiali)
    );

    const collator = new Intl.Collator('it', { sensitivity: 'base' });

    result.sort((a, b) => {
      switch (sort) {
        case 'az':
          return collator.compare(a.nome, b.nome);
        case 'za':
          return collator.compare(b.nome, a.nome);
        case 'recenti':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'vecchi':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [giochi, debouncedSearch, sort]);

  // Gestione eliminazione (soft delete)
  const handleDeleteConfirm = async () => {
    if (!deletingGioco) return;
    setIsDeleting(true);
    try {
      await softDeleteRecord('giochi', deletingGioco.id);
      await loadData();
      setIsDeleteOpen(false);
      setDeletingGioco(null);
      if (selectedGioco?.id === deletingGioco.id) {
        setIsDetailOpen(false);
        setSelectedGioco(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const existingNames = useMemo(() => giochi.map((g) => g.nome), [giochi]);

  return (
    <div>
      {/* 1. FASCIA FOTOGRAFICA D'INTESTAZIONE */}
      <HeaderBanner
        photoId="giochi"
        title={I18N.giochi.title}
        count={`${giochi.length} ${giochi.length === 1 ? 'gioco salvato' : 'giochi salvati'}`}
        section="giochi"
      />

      <div className="container" style={{ paddingTop: 'var(--space-4)' }}>
        {/* Barra azione Admin (visibile SOLO con sessione admin valida) */}
        {isAdmin ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 'var(--space-3)',
            }}
          >
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingGioco(null);
                setIsFormOpen(true);
              }}
            >
              <Icon name="plus" size={16} />
              <span>{I18N.giochi.nuovoGioco}</span>
            </Button>
          </div>
        ) : null}

        {/* 2. RICERCA E ORDINAMENTO FISSI SOTTO LA TESTATA */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <SearchField
            value={search}
            onInput={handleSearchChange}
            placeholder={I18N.search.placeholderGiochi}
            aria-label={I18N.search.placeholderGiochi}
          />
          <SegmentedControl
            options={[
              { value: 'az', label: 'A → Z' },
              { value: 'za', label: 'Z → A' },
              { value: 'recenti', label: 'Recenti' },
              { value: 'vecchi', label: 'Vecchi' },
            ]}
            value={sort}
            onChange={handleSortChange}
          />

          {/* Annunciatore accessibile per lettori di schermo (aria-live polite) */}
          <div
            aria-live="polite"
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {debouncedSearch
              ? I18N.search.count(filteredList.length)
              : `${giochi.length} giochi`}
          </div>
        </div>

        {/* 3. RISULTATI O STATO VUOTO */}
        {debouncedSearch && filteredList.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-8) var(--space-4)',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              margin: 'var(--space-4) 0',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-3)',
              }}
            >
              <Icon name="search" size={28} />
            </div>
            <h3
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 600,
                color: 'var(--color-ink)',
                margin: '0 0 var(--space-1)',
              }}
            >
              {I18N.search.emptyResult(debouncedSearch)}
            </h3>
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              Verifica i termini cercati o reimposta la ricerca.
            </p>
          </div>
        ) : (
          <GroupedList
            header={debouncedSearch ? `RISULTATI DI RICERCA (${filteredList.length})` : 'GIOCHI DISPONIBILI'}
            footer="Tutti i giochi sono disponibili offline con regole e schemi di gioco."
          >
            {filteredList.map((gioco) => {
              const isNew =
                Date.now() - new Date(gioco.created_at).getTime() < SEVEN_DAYS_MS;

              const subtitleText = gioco.materiali
                ? `Materiali: ${gioco.materiali}`
                : gioco.regole
                ? gioco.regole.slice(0, 50) + (gioco.regole.length > 50 ? '…' : '')
                : 'Regole e svolgimento';

              return (
                <GroupedRow
                  key={gioco.id}
                  leading={<SectionIcon section="giochi" size="sm" />}
                  title={
                    <HighlightText
                      text={gioco.nome}
                      query={debouncedSearch}
                    />
                  }
                  subtitle={
                    <HighlightText
                      text={subtitleText}
                      query={debouncedSearch}
                    />
                  }
                  trailing={
                    isNew ? (
                      <Badge variant="giallo" size="sm">
                        Nuovo
                      </Badge>
                    ) : null
                  }
                  chevron
                  onClick={() => {
                    setSelectedGioco(gioco);
                    setIsDetailOpen(true);
                  }}
                />
              );
            })}
          </GroupedList>
        )}
      </div>

      {/* Sheet Dettaglio Gioco */}
      <GiocoDetailSheet
        gioco={selectedGioco}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onEdit={(g) => {
          setIsDetailOpen(false);
          setEditingGioco(g);
          setIsFormOpen(true);
        }}
        onDelete={(g) => {
          setDeletingGioco(g);
          setIsDeleteOpen(true);
        }}
      />

      {/* Sheet Form Aggiungi/Modifica (Admin) */}
      <GiocoFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialGioco={editingGioco}
        existingNames={existingNames}
        onSaved={async (saved) => {
          await loadData();
          setSelectedGioco(saved);
        }}
      />

      {/* Modal Conferma Eliminazione in due passaggi (Admin) */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingGioco(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={deletingGioco?.nome || ''}
        isLoading={isDeleting}
      />
    </div>
  );
}
