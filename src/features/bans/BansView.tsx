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
import { Ban, getBans } from '../../lib/db';
import { useAdmin } from '../../lib/auth';
import { matchesQuery, HighlightText } from '../../lib/search';
import { softDeleteRecord } from '../../lib/admin_actions';
import { subscribeSyncState } from '../../lib/sync';
import { BanDetailSheet } from './BanDetailSheet';
import { BanFormSheet } from './BanFormSheet';
import { DeleteConfirmModal } from '../../ui/DeleteConfirmModal';

type SortOption = 'az' | 'za' | 'recenti' | 'vecchi';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function BansView() {
  const { isAdmin } = useAdmin();
  const [bans, setBans] = useState<Ban[]>([]);

  // Ripristino stato da sessionStorage
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem('bans_search') || '';
    }
    return '';
  });

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const [sort, setSort] = useState<SortOption>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = sessionStorage.getItem('bans_sort') as SortOption;
      if (['az', 'za', 'recenti', 'vecchi'].includes(saved)) return saved;
    }
    return 'az';
  });

  // Modali e Sheet
  const [selectedBan, setSelectedBan] = useState<Ban | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBan, setEditingBan] = useState<Ban | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingBan, setDeletingBan] = useState<Ban | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debounceTimerRef = useRef<any>(null);

  // Caricamento dati da IndexedDB
  const loadData = async () => {
    const list = await getBans(false);
    setBans(list);
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
      sessionStorage.setItem('bans_search', val);
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
      sessionStorage.setItem('bans_sort', s);
    }
  };

  // Filtraggio deterministico multi-campo con tolleranza ai typo
  const filteredList = useMemo(() => {
    let result = bans.filter((b) =>
      matchesQuery(debouncedSearch, b.nome, b.testo, b.note_gesti)
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
  }, [bans, debouncedSearch, sort]);

  // Gestione eliminazione (soft delete)
  const handleDeleteConfirm = async () => {
    if (!deletingBan) return;
    setIsDeleting(true);
    try {
      await softDeleteRecord('bans', deletingBan.id);
      await loadData();
      setIsDeleteOpen(false);
      setDeletingBan(null);
      if (selectedBan?.id === deletingBan.id) {
        setIsDetailOpen(false);
        setSelectedBan(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const existingNames = useMemo(() => bans.map((b) => b.nome), [bans]);

  return (
    <div>
      {/* 1. FASCIA FOTOGRAFICA D'INTESTAZIONE */}
      <HeaderBanner
        photoId="bans"
        title={I18N.bans.title}
        count={`${bans.length} ${bans.length === 1 ? 'ban salvato' : 'bans salvati'}`}
        section="bans"
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
                setEditingBan(null);
                setIsFormOpen(true);
              }}
            >
              <Icon name="plus" size={16} />
              <span>{I18N.bans.nuovoBan}</span>
            </Button>
          </div>
        ) : null}

        {/* 2. RICERCA RAPIDA E ORDINAMENTO */}
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
            placeholder={I18N.search.placeholderBans}
            aria-label={I18N.search.placeholderBans}
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

          {/* Annunciatore per screen reader */}
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
              : `${bans.length} bans`}
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
            header={debouncedSearch ? `RISULTATI DI RICERCA (${filteredList.length})` : 'BANS E CANTI DI FUOCO'}
            footer="Tocca un ban per aprire il testo e la modalità lettura all'aperto."
          >
            {filteredList.map((ban) => {
              const isNew =
                Date.now() - new Date(ban.created_at).getTime() < SEVEN_DAYS_MS;

              const subtitleText = ban.note_gesti
                ? ban.note_gesti
                : ban.testo
                ? ban.testo.slice(0, 50) + (ban.testo.length > 50 ? '…' : '')
                : 'Animazione e gesti';

              return (
                <GroupedRow
                  key={ban.id}
                  leading={<SectionIcon section="bans" size="sm" />}
                  title={
                    <HighlightText
                      text={ban.nome}
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
                    setSelectedBan(ban);
                    setIsDetailOpen(true);
                  }}
                />
              );
            })}
          </GroupedList>
        )}
      </div>

      {/* Sheet Dettaglio Ban */}
      <BanDetailSheet
        ban={selectedBan}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onEdit={(b) => {
          setIsDetailOpen(false);
          setEditingBan(b);
          setIsFormOpen(true);
        }}
        onDelete={(b) => {
          setDeletingBan(b);
          setIsDeleteOpen(true);
        }}
      />

      {/* Sheet Form Aggiungi/Modifica (Admin) */}
      <BanFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialBan={editingBan}
        existingNames={existingNames}
        onSaved={async (saved) => {
          await loadData();
          setSelectedBan(saved);
        }}
      />

      {/* Modal Conferma Eliminazione in due passaggi (Admin) */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingBan(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={deletingBan?.nome || ''}
        isLoading={isDeleting}
      />
    </div>
  );
}
