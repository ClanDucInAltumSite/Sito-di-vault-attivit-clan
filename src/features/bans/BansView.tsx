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
import { getPropostePerVisualizzazione, approvaPropostaAdmin, ritiraPropostaLocale, subscribeProposte, PropostaItem } from '../../lib/proposte';
import { BanDetailSheet } from './BanDetailSheet';
import { BanFormSheet } from './BanFormSheet';
import { DeleteConfirmModal } from '../../ui/DeleteConfirmModal';
import { RifiutaPropostaModal } from '../admin/RifiutaPropostaModal';

type SortOption = 'az' | 'za' | 'recenti' | 'vecchi';

export function BansView() {
  const { isAdmin } = useAdmin();
  const [bans, setBans] = useState<Ban[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

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

  const [pendingProposteMap, setPendingProposteMap] = useState<Map<string, PropostaItem>>(new Map());
  const [rejectingProposta, setRejectingProposta] = useState<PropostaItem | null>(null);

  // Caricamento dati da IndexedDB e Supabase (ufficiali + proposte in attesa)
  const loadData = async () => {
    const list = await getBans(false);
    const proposte = await getPropostePerVisualizzazione('bans', isAdmin);

    const map = new Map<string, PropostaItem>();
    const pendingBans: Ban[] = proposte.map((p) => {
      map.set(p.id, p);
      return {
        id: p.id,
        nome: p.dati.nome || p.titolo,
        testo: p.dati.testo || '',
        note_gesti: p.dati.note_gesti || '',
        link: p.dati.link || null,
        created_at: p.created_at,
        updated_at: p.created_at,
        deleted_at: null,
      };
    });

    setPendingProposteMap(map);
    setPendingIds(new Set(proposte.map((p) => p.id)));
    setBans([...pendingBans, ...list]);
  };

  useEffect(() => {
    loadData();
    const unsubSync = subscribeSyncState(() => {
      loadData();
    });
    const unsubProp = subscribeProposte(() => {
      loadData();
    });
    return () => {
      unsubSync();
      unsubProp();
    };
  }, [isAdmin]);

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
      matchesQuery(debouncedSearch, b.nome, b.testo, b.note_gesti, b.link)
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

  const latestBanId = useMemo(() => {
    if (!bans || bans.length === 0) return null;
    const first = bans[0];
    if (!first) return null;
    return bans.reduce(
      (max, b) => (new Date(b.created_at).getTime() > new Date(max.created_at).getTime() ? b : max),
      first
    )?.id ?? null;
  }, [bans]);

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
        {/* Barra azione (Admin o Proposta Utente Non-Admin) */}
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
            <span>{isAdmin ? I18N.bans.nuovoBan : 'Proponi un Ban'}</span>
          </Button>
        </div>

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
              const isPending = pendingIds.has(ban.id);
              const isNew = !isPending && ban.id === latestBanId;

              const subtitleText = ban.note_gesti
                ? ban.note_gesti
                : ban.testo
                ? ban.testo.slice(0, 50) + (ban.testo.length > 50 ? '…' : '')
                : 'Animazione e gesti';

              return (
                <div key={ban.id} className={isPending ? 'proposta-pending-card' : undefined} style={isPending ? { borderRadius: 'var(--radius-md)', margin: '2px 0' } : undefined}>
                  <GroupedRow
                    leading={<SectionIcon section="bans" size="sm" />}
                    title={
                      <HighlightText
                        text={ban.nome}
                        query={debouncedSearch}
                      />
                    }
                    subtitle={
                      <div>
                        <HighlightText
                          text={subtitleText}
                          query={debouncedSearch}
                        />
                        {isPending ? (
                          <span className="proposta-pending-caption">
                            {isAdmin && pendingProposteMap.get(ban.id)?.proponente_nome
                              ? `Proposto da: ${pendingProposteMap.get(ban.id)?.proponente_nome} • In attesa di approvazione`
                              : isAdmin
                              ? 'In attesa di approvazione dell\'Admin'
                              : 'Visibile solo su questo dispositivo fino all\'approvazione dell\'Admin'}
                          </span>
                        ) : null}
                      </div>
                    }
                    trailing={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {ban.link ? (
                          <span
                            title="Link esterno disponibile"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: 'var(--color-bans)',
                            }}
                            aria-label="Link esterno disponibile"
                          >
                            <Icon name="link" size={14} />
                          </span>
                        ) : null}
                        {isPending ? (
                          <Badge variant="giallo" size="sm">
                            In attesa
                          </Badge>
                        ) : isNew ? (
                          <Badge variant="nuovo" size="sm">
                            Nuovo
                          </Badge>
                        ) : null}
                      </div>
                    }
                    chevron
                    onClick={() => {
                      setSelectedBan(ban);
                      setIsDetailOpen(true);
                    }}
                  />
                </div>
              );
            })}
          </GroupedList>
        )}
      </div>

      {/* Sheet Dettaglio Ban */}
      <BanDetailSheet
        ban={selectedBan}
        isOpen={isDetailOpen}
        isNew={selectedBan ? selectedBan.id === latestBanId : false}
        isPending={selectedBan ? pendingIds.has(selectedBan.id) : false}
        proponenteNome={selectedBan ? pendingProposteMap.get(selectedBan.id)?.proponente_nome || null : null}
        onClose={() => setIsDetailOpen(false)}
        onWithdraw={async (b) => {
          await ritiraPropostaLocale(b.id);
          setIsDetailOpen(false);
          setSelectedBan(null);
          await loadData();
        }}
        onApproveProposta={async (b) => {
          const prop = pendingProposteMap.get(b.id);
          if (prop) {
            await approvaPropostaAdmin(prop);
            setIsDetailOpen(false);
            setSelectedBan(null);
            await loadData();
          }
        }}
        onRejectProposta={(b) => {
          const prop = pendingProposteMap.get(b.id);
          if (prop) {
            setIsDetailOpen(false);
            setRejectingProposta(prop);
          }
        }}
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

      {/* Modal In-App Rifiuta Proposta e Blocco Utente (Admin) */}
      <RifiutaPropostaModal
        proposta={rejectingProposta}
        isOpen={Boolean(rejectingProposta)}
        onClose={() => setRejectingProposta(null)}
        onSuccess={async () => {
          setSelectedBan(null);
          await loadData();
        }}
      />
    </div>
  );
}
