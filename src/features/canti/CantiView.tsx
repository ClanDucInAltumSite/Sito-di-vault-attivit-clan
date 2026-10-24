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
import { Canto, getCanti, upsertRecords } from '../../lib/db';
import { useAdmin } from '../../lib/auth';
import { matchesQuery, HighlightText } from '../../lib/search';
import { softDeleteRecord } from '../../lib/admin_actions';
import { subscribeSyncState } from '../../lib/sync';
import { stripChords } from '../../lib/chordpro';
import { splitSongIntoPages } from '../../lib/stampa';
import { CantoDetailSheet } from './CantoDetailSheet';
import { CantoReadingMode } from './CantoReadingMode';
import { ImportCantoModal, ImportedSongData } from './ImportCantoModal';
import { CantoReviewModal } from './CantoReviewModal';
import { QuickCategoryAssignModal } from './QuickCategoryAssignModal';
import { DeleteConfirmModal } from '../../ui/DeleteConfirmModal';
import { DANZA_LA_VITA_PARSED, DEFAULT_PARSED_SONGS } from '../../data/parsed_songs';

type SortOption = 'az' | 'za' | 'recenti' | 'vecchi';
export type CategoryFilter = 'tutti' | 'scout' | 'chiesa' | 'esterni' | 'senza_categoria';

export function CantiView() {
  const { isAdmin } = useAdmin();
  const [canti, setCanti] = useState<Canto[]>([]);

  // Filtro Categoria (Fase 11F)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = sessionStorage.getItem('canti_category') as CategoryFilter;
      if (['tutti', 'scout', 'chiesa', 'esterni', 'senza_categoria'].includes(saved)) return saved;
    }
    return 'tutti';
  });

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
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReadingModeOpen, setIsReadingModeOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);
  const [importedSongData, setImportedSongData] = useState<ImportedSongData | null>(null);
  const [editingCanto, setEditingCanto] = useState<Canto | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingCanto, setDeletingCanto] = useState<Canto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debounceTimerRef = useRef<any>(null);

  // Caricamento dati da IndexedDB
  const loadData = async () => {
    const list = await getCanti(false);
    const enriched = [...list];

    // Aggiorna o arricchisce DANZA LA VITA se versione precedente parziale
    const dvIdx = enriched.findIndex((c) => c.id === DANZA_LA_VITA_PARSED.id);
    if (dvIdx >= 0) {
      const existingDv = enriched[dvIdx];
      if (existingDv && !existingDv.testo_chordpro.includes('Cammina sulle [Fa]orme')) {
        enriched[dvIdx] = {
          ...existingDv,
          ...DANZA_LA_VITA_PARSED,
          updated_at: existingDv.updated_at,
          created_at: existingDv.created_at,
          deleted_at: null,
        } as Canto;
      }
    }

    // Aggiunge o aggiorna tutte le canzoni di default predefinite
    const toSeed: Canto[] = [];
    for (const defSong of DEFAULT_PARSED_SONGS) {
      const existingIdx = enriched.findIndex((c) => c.id === defSong.id || c.titolo.toLowerCase() === defSong.titolo.toLowerCase());
      if (existingIdx === -1) {
        enriched.push(defSong);
        toSeed.push(defSong);
      } else {
        const existing = enriched[existingIdx];
        if (existing && existing.testo_chordpro.length < defSong.testo_chordpro.length) {
          enriched[existingIdx] = {
            ...existing,
            ...defSong,
            id: existing.id,
            created_at: existing.created_at,
            updated_at: new Date().toISOString(),
          };
          toSeed.push(enriched[existingIdx]);
        }
      }
    }

    enriched.sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));

    setCanti(enriched);

    if (toSeed.length > 0) {
      upsertRecords('canti', toSeed).catch((err) => console.warn('Canti seeding error:', err));
    }
  };

  // Conteggi categorie (Fase 11F)
  const countAll = canti.length;
  const countScout = useMemo(() => canti.filter((c) => c.categoria === 'scout').length, [canti]);
  const countChiesa = useMemo(() => canti.filter((c) => c.categoria === 'chiesa').length, [canti]);
  const countEsterni = useMemo(() => canti.filter((c) => c.categoria === 'esterni').length, [canti]);
  const uncategorizedCanti = useMemo(() => canti.filter((c) => !c.categoria), [canti]);
  const countUncategorized = uncategorizedCanti.length;

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeSyncState(() => {
      loadData();
    });
    (window as any).__openCantoDetail = (canto: Canto) => {
      setSelectedCanto(canto);
      setIsDetailOpen(true);
    };
    (window as any).__openCantoReading = (canto: Canto) => {
      setSelectedCanto(canto);
      setIsReadingModeOpen(true);
    };
    (window as any).__openReviewForTesting = (data?: any) => {
      setEditingCanto(null);
      setImportedSongData({
        titolo: data?.titolo || 'Canto Sintetico Lungo della Promessa e della Strada',
        categoria: data?.categoria || 'scout',
        autore: data?.autore || 'Compositore Sintetico',
        tonalita: data?.tonalita || 'Do',
        misura: data?.misura || '4/4',
        bpm_testo: data?.bpm_testo || 'circa 94',
        ritmo: data?.ritmo || '↓ ↑ ↓↑',
        capotasto: data?.capotasto ?? 2,
        origine: data?.origine || 'import_pdf',
        nota_fonte: data?.nota_fonte || 'Canzoniere Sintetico 2026',
        testo_chordpro: data?.testo_chordpro || '',
        warnings: data?.warnings || [],
        removedNoise: data?.removedNoise || [],
      });
      setIsReviewModalOpen(true);
    };
    return () => {
      unsubscribe();
      delete (window as any).__openCantoDetail;
      delete (window as any).__openReviewForTesting;
    };
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

  // Gestione filtro categoria e persistenza in sessionStorage
  const handleCategoryChange = (val: string) => {
    const c = val as CategoryFilter;
    setCategoryFilter(c);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('canti_category', c);
    }
  };

  // Filtraggio deterministico: CERCA SOLO NEL TESTO PULITO (stripChords), MAI NEGLI ACCORDI!
  const filteredList = useMemo(() => {
    let result = canti.filter((c) => {
      if (categoryFilter === 'scout' && c.categoria !== 'scout') return false;
      if (categoryFilter === 'chiesa' && c.categoria !== 'chiesa') return false;
      if (categoryFilter === 'esterni' && c.categoria !== 'esterni') return false;
      if (categoryFilter === 'senza_categoria' && c.categoria) return false;

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
  }, [canti, debouncedSearch, sort, categoryFilter]);

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

  const latestCantoId = useMemo(() => {
    const first = canti[0];
    if (!first) return null;
    return canti.reduce(
      (max, c) => (new Date(c.created_at).getTime() > new Date(max.created_at).getTime() ? c : max),
      first
    ).id;
  }, [canti]);

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
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
            >
              <Icon name="upload" size={16} />
              <span>Importa canto</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingCanto(null);
                setImportedSongData(null);
                setIsReviewModalOpen(true);
              }}
              style={{ fontSize: '0.85rem' }}
            >
              <Icon name="plus" size={14} />
              <span>Nuovo canto vuoto</span>
            </Button>
          </div>
        ) : null}

        {/* Avviso Admin per canti senza categoria con assegnazione rapida (Fase 11F) */}
        {isAdmin && countUncategorized > 0 ? (
          <div
            className="ios-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-4)',
              backgroundColor: 'oklch(0.96 0.05 85)',
              borderColor: 'oklch(0.85 0.1 85)',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Icon name="info" size={18} />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'oklch(0.35 0.12 85)' }}>
                Ci sono {countUncategorized} {countUncategorized === 1 ? 'canto senza categoria' : 'canti senza categoria'}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsQuickAssignOpen(true)}
            >
              Assegna rapidamente
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

          {/* Filtro per Categorie (Fase 11F) */}
          <SegmentedControl
            options={[
              { value: 'tutti', label: `Tutti (${countAll})` },
              { value: 'scout', label: `Scout (${countScout})` },
              { value: 'chiesa', label: `Chiesa (${countChiesa})` },
              { value: 'esterni', label: `Esterni (${countEsterni})` },
              ...(countUncategorized > 0
                ? [{ value: 'senza_categoria', label: `Senza cat. (${countUncategorized})` }]
                : []),
            ]}
            value={categoryFilter}
            onChange={handleCategoryChange}
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
              const isNew = canto.id === latestCantoId;

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {canto.categoria === 'scout' && (
                        <Badge variant="azzurro" size="sm">
                          Scout
                        </Badge>
                      )}
                      {canto.categoria === 'chiesa' && (
                        <Badge variant="giallo" size="sm">
                          Chiesa
                        </Badge>
                      )}
                      {canto.categoria === 'esterni' && (
                        <Badge variant="rosso" size="sm">
                          Esterni
                        </Badge>
                      )}
                      {!canto.categoria && isAdmin && (
                        <Badge variant="rosso" size="sm">
                          Senza cat.
                        </Badge>
                      )}
                      {isNew ? (
                        <Badge variant="nuovo" size="sm">
                          Nuovo
                        </Badge>
                      ) : null}
                    </div>
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

      {/* Sheet Dettaglio Canto */}
      <CantoDetailSheet
        canto={selectedCanto}
        isOpen={isDetailOpen}
        isNew={selectedCanto ? selectedCanto.id === latestCantoId : false}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedCanto(null);
        }}
        onOpenReadingMode={(c) => {
          setIsDetailOpen(false);
          setSelectedCanto(c);
          setIsReadingModeOpen(true);
        }}
        onEdit={(c) => {
          setIsDetailOpen(false);
          setEditingCanto(c);
          setImportedSongData(null);
          setIsReviewModalOpen(true);
        }}
        onDelete={(c) => {
          setIsDetailOpen(false);
          setDeletingCanto(c);
          setIsDeleteOpen(true);
        }}
        onUpdated={loadData}
      />

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
          setImportedSongData(null);
          setIsReviewModalOpen(true);
        }}
        onDelete={(c) => {
          setIsReadingModeOpen(false);
          setDeletingCanto(c);
          setIsDeleteOpen(true);
        }}
        onUpdated={loadData}
      />

      {/* Modal Ingresso Unico Importazione (PDF e Word) */}
      <ImportCantoModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(data) => {
          setImportedSongData(data);
          setEditingCanto(null);
          setIsReviewModalOpen(true);
        }}
      />

      {/* Schermata Revisione Grande Canto (Fase 11D) */}
      {isReviewModalOpen && (
        <CantoReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setImportedSongData(null);
            setEditingCanto(null);
          }}
          initialCanto={editingCanto}
          importedData={importedSongData}
          existingTitles={existingTitles}
          onSaved={async (saved) => {
            await loadData();
            setSelectedCanto(saved);
          }}
        />
      )}

      {/* Modal Assegnazione Rapida Categorie (Fase 11F) */}
      <QuickCategoryAssignModal
        isOpen={isQuickAssignOpen}
        onClose={() => setIsQuickAssignOpen(false)}
        uncategorizedCanti={uncategorizedCanti}
        onUpdated={loadData}
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
