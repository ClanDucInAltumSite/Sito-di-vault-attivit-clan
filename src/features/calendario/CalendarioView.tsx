// src/features/calendario/CalendarioView.tsx
// Schermata principale del Calendario e Ordine del Giorno (ODG)
// Lettura esclusiva da IndexedDB, commutazione tra Vista Mese e Vista Lista,
// gestione Admin completa e supporto navigazione diretta tramite deep-link (?id=...).

import { useState, useEffect } from 'preact/hooks';
import { HeaderBanner } from '../../ui/HeaderBanner';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { I18N } from '../../lib/i18n';
import { Evento, OdgPunto, getEventi, getOdgPunti } from '../../lib/db';
import { softDeleteRecord } from '../../lib/admin_actions';
import { useAdmin } from '../../lib/auth';
import { useRoute } from '../../app/router';
import { CalendarioMonthView } from './CalendarioMonthView';
import { CalendarioListView } from './CalendarioListView';
import { EventoDetailSheet } from './EventoDetailSheet';
import { EventoFormSheet } from './EventoFormSheet';
import { parseDateOnly, isEventoDataDaDefinire, SENTINEL_DATA_DA_DEFINIRE, TAG_DATA_DA_DEFINIRE } from '../../lib/calendario';

export function CalendarioView() {
  const { isAdmin } = useAdmin();
  const route = useRoute();

  // Ripristino o impostazione vista da sessionStorage
  const [viewMode, setViewMode] = useState<'mese' | 'prossimi' | 'passati'>(() => {
    const saved = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('calendario_view_mode') : null;
    return (saved as 'mese' | 'prossimi' | 'passati') || 'mese';
  });

  const [eventi, setEventi] = useState<Evento[]>([]);
  const [odgMap, setOdgMap] = useState<Record<string, OdgPunto[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Stato modali
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);

  const loadData = async () => {
    try {
      const [evList, allOdg] = await Promise.all([
        getEventi(false),
        getOdgPunti(undefined, false),
      ]);

      setEventi(evList);

      // Mappa ODG per evento_id
      const map: Record<string, OdgPunto[]> = {};
      for (const p of allOdg) {
        if (!map[p.evento_id]) map[p.evento_id] = [];
        map[p.evento_id]!.push(p);
      }
      setOdgMap(map);

      // Deep-link query param (?id=...)
      if (route.params.id) {
        const target = evList.find((e) => e.id === route.params.id);
        if (target) {
          setSelectedEvento(target);
          setIsDetailOpen(true);
        }
      }
    } catch (err) {
      console.error('Errore caricamento calendario:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [route.params.id]);

  const handleViewModeChange = (mode: string) => {
    const m = mode as 'mese' | 'prossimi' | 'passati';
    setViewMode(m);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('calendario_view_mode', m);
    }
  };

  const handleOpenDetail = (evento: Evento) => {
    setSelectedEvento(evento);
    setIsDetailOpen(true);
  };

  const handleNewEvento = () => {
    setEditingEvento(null);
    setIsFormOpen(true);
  };

  const handleCreateNewMeeting = () => {
    setIsDetailOpen(false);
    setEditingEvento({
      id: '',
      titolo: 'Prossima Riunione',
      tipo: 'riunione',
      inizio: SENTINEL_DATA_DA_DEFINIRE,
      fine: null,
      tutto_il_giorno: false,
      luogo: 'Sede',
      descrizione: TAG_DATA_DA_DEFINIRE,
      responsabile: null,
      cosa_portare: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    });
    setIsFormOpen(true);
  };

  const handleEditEvento = (evento: Evento) => {
    setIsDetailOpen(false);
    setEditingEvento(evento);
    setIsFormOpen(true);
  };

  const handleDeleteEvento = async (evento: Evento) => {
    const confirmed = window.confirm(
      `Sei sicuro di voler eliminare l'evento "${evento.titolo}"? Verrà spostato nel cestino.`
    );
    if (!confirmed) return;

    try {
      await softDeleteRecord('eventi', evento.id);
      setIsDetailOpen(false);
      setSelectedEvento(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'eliminazione dell\'evento.');
    }
  };

  const handleSavedEvento = async (saved: Evento) => {
    await loadData();
    setSelectedEvento(saved);
    setIsDetailOpen(true);
  };

  // Riunioni aperte con data ancora da concordare
  const meetingsTbd = eventi.filter(
    (e) => e.tipo === 'riunione' && isEventoDataDaDefinire(e) && e.deleted_at === null
  );

  // Conteggio eventi futuri per la testata
  const todayTime = new Date().setHours(0, 0, 0, 0);
  const upcomingCount = eventi.filter((e) => {
    if (e.deleted_at !== null) return false;
    if (isEventoDataDaDefinire(e)) return true;
    const start = parseDateOnly(e.inizio).getTime();
    const end = e.fine ? parseDateOnly(e.fine).getTime() : start;
    return end >= todayTime;
  }).length;

  const countBannerText = isLoading
    ? 'Caricamento in corso…'
    : `${upcomingCount} ${upcomingCount === 1 ? 'attività in programma' : 'attività in programma'}`;

  return (
    <div>
      {/* 1. FASCIA FOTOGRAFICA D'INTESTAZIONE */}
      <HeaderBanner
        photoId="calendario"
        title={I18N.calendario.title}
        count={countBannerText}
        section="calendario"
      />

      <div className="container" style={{ paddingTop: 'var(--space-4)' }}>
        {/* 2. BARRA CONTROLLI SUPERIORE: FILTRI VISTA E PULSANTE NUOVO EVENTO ADMIN */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ flex: '1 1 280px', maxWidth: '380px' }}>
            <SegmentedControl
              options={[
                { value: 'mese', label: I18N.calendario.vistaMese },
                { value: 'prossimi', label: I18N.calendario.prossimiEventi },
                { value: 'passati', label: 'Passati' },
              ]}
              value={viewMode}
              onChange={handleViewModeChange}
            />
          </div>

          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleNewEvento}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Icon name="plus" size={16} />
              <span>{I18N.calendario.nuovoEvento}</span>
            </Button>
          )}
        </div>

        {/* 2B. BANNER RIUNIONE CON DATA DA CONCORDARE (ODG IN CORSO) */}
        {meetingsTbd.length > 0 && (
          <div
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid var(--color-interactive)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-rest)',
            }}
            onClick={() => handleOpenDetail(meetingsTbd[0]!)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                className="section-sq-icon section-sq-calendario section-sq-sm"
                aria-hidden="true"
              >
                <Icon name="calendar" size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-ink)' }}>
                  {meetingsTbd[0]!.titolo} — Data da concordare
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {(odgMap[meetingsTbd[0]!.id] || []).length} punti ODG inseriti • Tocca per visualizzare o gestire i punti
                </div>
              </div>
            </div>
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditEvento(meetingsTbd[0]!);
                }}
              >
                <Icon name="edit" size={14} />
                <span>Fissa data e ora</span>
              </Button>
            )}
          </div>
        )}

        {/* 3. VISTA ATTIVA */}
        {viewMode === 'mese' ? (
          <CalendarioMonthView
            eventi={eventi}
            odgMap={odgMap}
            onSelectEvento={handleOpenDetail}
          />
        ) : (
          <CalendarioListView
            eventi={eventi}
            odgMap={odgMap}
            onSelectEvento={handleOpenDetail}
            mode={viewMode}
          />
        )}
      </div>

      {/* 4. MODALE DETTAGLIO EVENTO & ODG */}
      <EventoDetailSheet
        evento={selectedEvento}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedEvento(null);
        }}
        onEdit={handleEditEvento}
        onDelete={handleDeleteEvento}
        onCreateMeeting={handleCreateNewMeeting}
        onChanged={loadData}
        initialOdgPoints={selectedEvento ? odgMap[selectedEvento.id] : undefined}
      />

      {/* 5. MODALE FORM CREAZIONE / MODIFICA EVENTO (ADMIN ONLY) */}
      {isAdmin && (
        <EventoFormSheet
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingEvento(null);
          }}
          onSaved={handleSavedEvento}
          initialEvento={editingEvento}
        />
      )}
    </div>
  );
}
