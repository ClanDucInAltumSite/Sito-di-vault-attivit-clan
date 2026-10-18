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
import { Canto, getCanti } from '../../lib/db';
import { useAdmin } from '../../lib/auth';
import { matchesQuery, HighlightText } from '../../lib/search';
import { softDeleteRecord } from '../../lib/admin_actions';
import { subscribeSyncState } from '../../lib/sync';
import { stripChords } from '../../lib/chordpro';
import { splitSongIntoPages } from '../../lib/stampa';
import { CantoReadingMode } from './CantoReadingMode';
import { CantoFormSheet } from './CantoFormSheet';
import { DeleteConfirmModal } from '../../ui/DeleteConfirmModal';

type SortOption = 'az' | 'za' | 'recenti' | 'vecchi';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function CantiView() {
  const { isAdmin } = useAdmin();
  const [canti, setCanti] = useState<Canto[]>([]);

  // Ripristino stato da sessionStorage
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem('canti_search') || '';
    }
    return '';
  });

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const [sort, setSort] = useState<SortOption>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = sessionStorage.getItem('canti_sort') as SortOption;
      if (['az', 'za', 'recenti', 'vecchi'].includes(saved)) return saved;
    }
    return 'az';
  });

  // Modali e Sheet
  const [selectedCanto, setSelectedCanto] = useState<Canto | null>(null);
  const [isReadingModeOpen, setIsReadingModeOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCanto, setEditingCanto] = useState<Canto | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingCanto, setDeletingCanto] = useState<Canto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debounceTimerRef = useRef<any>(null);

  // Caricamento dati da IndexedDB
  const loadData = async () => {
    const list = await getCanti(false);
    setCanti(list);
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
      sessionStorage.setItem('canti_search', val);
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
      sessionStorage.setItem('canti_sort', s);
    }
  };

  // Filtraggio deterministico: CERCA SOLO NEL TESTO PULITO (stripChords), MAI NEGLI ACCORDI!
  const filteredList = useMemo(() => {
    let result = canti.filter((c) => {
      const cleanLyrics = stripChords(c.testo_chordpro);
      return matchesQuery(debouncedSearch, c.titolo, c.autore || '', cleanLyrics);
    });

    const collator = new Intl.Collator('it', { sensitivity: 'base' });

    result.sort((a, b) => {
      switch (sort) {
        case 'az':
          return collator.compare(a.titolo, b.titolo);
        case 'za':
          return collator.compare(b.titolo, a.titolo);
        case 'recenti':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'vecchi':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [canti, debouncedSearch, sort]);

  // Gestione eliminazione (soft delete gerarchica)
  const handleDeleteConfirm = async () => {
    if (!deletingCanto) return;
    setIsDeleting(true);
    try {
      await softDeleteRecord('canti', deletingCanto.id);
      await loadData();
      setIsDeleteOpen(false);
      setDeletingCanto(null);
      if (selectedCanto?.id === deletingCanto.id) {
        setIsReadingModeOpen(false);
        setSelectedCanto(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const existingTitles = useMemo(() => canti.map((c) => c.titolo), [canti]);

  return (
    <div>
      {/* 1. FASCIA FOTOGRAFICA D'INTESTAZIONE */}
      <HeaderBanner
        photoId="canti"
        title={I18N.canti.title}
        count={`${canti.length} ${canti.length === 1 ? 'canto con accordi' : 'canti con accordi'}`}
        section="canti"
      />

      <div className="container" style={{ paddingTop: 'var(--space-4)' }}>
        {/* Barra azione Admin (visibile SOLO con sessione admin autenticata) */}
        {isAdmin ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingCanto(null);
                setIsFormOpen(true);
              }}
            >
              <Icon name="plus" size={16} />
              <span>{I18N.canti.nuovoCanto}</span>
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
            placeholder={I18N.search.placeholderCanti}
            aria-label={I18N.search.placeholderCanti}
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
              : `${canti.length} canti`}
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
            header={debouncedSearch ? `RISULTATI DI RICERCA (${filteredList.length})` : 'CANZONIERE'}
            footer="Tocca un canto per visualizzare gli accordi, trasporre la tonalità o avviare il metronomo."
          >
            {filteredList.map((canto) => {
              const isNew =
                Date.now() - new Date(canto.created_at).getTime() < SEVEN_DAYS_MS;

              const pageCount = splitSongIntoPages(canto.testo_chordpro).length;
              const metaParts = [];
              if (canto.tonalita) metaParts.push(`Tonalità: ${canto.tonalita}`);
              if (canto.bpm_testo) metaParts.push(`${canto.bpm_testo} BPM`);
              else if (canto.tempo_bpm) metaParts.push(`${canto.tempo_bpm} BPM`);
              if (canto.misura) metaParts.push(canto.misura);
              metaParts.push(pageCount === 1 ? '1 pag.' : `${pageCount} pag.`);

              const subtitleText = metaParts.join(' • ');

              return (
                <GroupedRow
                  key={canto.id}
                  leading={<SectionIcon section="canti" size="sm" />}
                  title={
                    <HighlightText
                      text={canto.titolo}
                      query={debouncedSearch}
                    />
                  }
                  subtitle={
                    <HighlightText
                      text={canto.autore ? `${canto.autore} - ${subtitleText}` : subtitleText}
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
                    setSelectedCanto(canto);
                    setIsReadingModeOpen(true);
                  }}
                />
              );
            })}
          </GroupedList>
        )}
      </div>

      {/* Modalità Lettura a Tutto Schermo (Accordi, Metronomo, Wake Lock e Allegati) */}
      <CantoReadingMode
        canto={selectedCanto}
        isOpen={isReadingModeOpen}
        onClose={() => {
          setIsReadingModeOpen(false);
          setSelectedCanto(null);
        }}
        onEdit={(c) => {
          setIsReadingModeOpen(false);
          setEditingCanto(c);
          setIsFormOpen(true);
        }}
        onDelete={(c) => {
          setIsReadingModeOpen(false);
          setDeletingCanto(c);
          setIsDeleteOpen(true);
        }}
        onUpdated={loadData}
      />

      {/* Sheet Form Aggiungi/Modifica Canto (Admin - Unificato 3-in-1) */}
      <CantoFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialCanto={editingCanto}
        existingTitles={existingTitles}
        onSaved={async (saved) => {
          await loadData();
          setSelectedCanto(saved);
        }}
      />

      {/* Modal Conferma Eliminazione in due passaggi (Admin) */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingCanto(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName={deletingCanto?.titolo || ''}
        isLoading={isDeleting}
      />
    </div>
  );
}
