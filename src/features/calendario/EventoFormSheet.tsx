// src/features/calendario/EventoFormSheet.tsx
// Modale Admin per creazione e modifica eventi di calendario:
// - Gestione progressiva: NON richiede mai orari precisi (solo date 'YYYY-MM-DD'). Eventuali orari vanno nelle note.
// - Riunioni "ODG First": Data da concordare attiva di default alla creazione, ODG in primo piano con aggiunta rapida via Invio,
//   nessun orario di fine, nessun luogo forzato su 'Sede'.
// - Uscite ed Eventi: Data Inizio e Data Fine facoltativa per più giorni, oppure "Data ancora da concordare".
// - Salvataggio robusto a 12:00:00 UTC per neutralizzare derive di fuso orario.

import { useState, useEffect, useRef } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { I18N } from '../../lib/i18n';
import { Evento, TipoEvento, getOdgPunti } from '../../lib/db';
import { saveEvento, saveOdgPunto, softDeleteRecord } from '../../lib/admin_actions';
import {
  isEventoDataDaDefinire,
  getCleanDescrizione,
  SENTINEL_DATA_DA_DEFINIRE,
  TAG_DATA_DA_DEFINIRE,
  parseDateOnly,
  formatDateKey,
} from '../../lib/calendario';

export interface EventoFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (evento: Evento) => void;
  initialEvento?: Evento | null;
}

interface OdgDraftItem {
  id?: string;
  testo: string;
  completato?: boolean;
}

export function EventoFormSheet({
  isOpen,
  onClose,
  onSaved,
  initialEvento,
}: EventoFormSheetProps) {
  const [titolo, setTitolo] = useState('');
  const [tipo, setTipo] = useState<TipoEvento>('riunione');
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [dataDaDefinire, setDataDaDefinire] = useState(false);
  const [luogo, setLuogo] = useState('');
  const [cosaPortare, setCosaPortare] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [showOptionalLuogo, setShowOptionalLuogo] = useState(false);

  // Stato per ODG contestuale (visibile solo per tipo === 'riunione')
  const [odgList, setOdgList] = useState<OdgDraftItem[]>([]);
  const [newOdgText, setNewOdgText] = useState('');
  const [deletedOdgIds, setDeletedOdgIds] = useState<string[]>([]);
  const odgInputRef = useRef<HTMLInputElement>(null);
  const [editingOdgIndex, setEditingOdgIndex] = useState<number | null>(null);
  const [editingOdgText, setEditingOdgText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formatta data ISO in YYYY-MM-DD locale per input type="date"
  const toDateInputValue = (isoStr: string | null | undefined): string => {
    if (!isoStr || isoStr.startsWith('2099')) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(isoStr)) {
      if (isoStr.includes('T12:00')) {
        return isoStr.slice(0, 10);
      }
      const d = parseDateOnly(isoStr);
      return formatDateKey(d);
    }
    return '';
  };

  // Helper per verificare quali tipologie supportano la data da concordare (riunione, evento, altro)
  // Per uscite e scadenze la data è sempre obbligatoria e richiesta.
  const canTypeBeTbd = (t: TipoEvento): boolean => t === 'riunione' || t === 'evento' || t === 'altro';

  useEffect(() => {
    if (isOpen) {
      setEditingOdgIndex(null);
      setEditingOdgText('');
      if (initialEvento && initialEvento.id) {
        const canBeTbd = canTypeBeTbd(initialEvento.tipo);
        const isTbd = canBeTbd && isEventoDataDaDefinire(initialEvento);
        setDataDaDefinire(isTbd);
        setTitolo(initialEvento.titolo);
        setTipo(initialEvento.tipo);
        setDataInizio(isTbd ? '' : toDateInputValue(initialEvento.inizio));
        setDataFine(isTbd || !initialEvento.fine ? '' : toDateInputValue(initialEvento.fine));
        setLuogo(initialEvento.luogo || '');
        setShowOptionalLuogo(Boolean(initialEvento.luogo && initialEvento.luogo.trim()));
        setCosaPortare(initialEvento.cosa_portare || '');
        setDescrizione(getCleanDescrizione(initialEvento.descrizione));
        setDeletedOdgIds([]);

        if (initialEvento.tipo === 'riunione') {
          getOdgPunti(initialEvento.id, false).then((items) => {
            setOdgList(items.map((it) => ({ id: it.id, testo: it.testo, completato: it.completato })));
          }).catch(() => {
            setOdgList([]);
          });
        } else {
          setOdgList([]);
        }
      } else {
        // Nuovo evento
        const isMeeting = (initialEvento?.tipo || 'riunione') === 'riunione';
        setTitolo(initialEvento?.titolo || (isMeeting ? 'Prossima Riunione' : ''));
        setTipo(initialEvento?.tipo || 'riunione');
        setDataDaDefinire(isMeeting); // Default true SOLO per nuova riunione!
        setDataInizio('');
        setDataFine('');
        setLuogo('');
        setShowOptionalLuogo(false);
        setCosaPortare('');
        setDescrizione(initialEvento?.descrizione ? getCleanDescrizione(initialEvento.descrizione) : '');
        setOdgList([]);
        setDeletedOdgIds([]);
      }
      setErrorMessage(null);
    }
  }, [isOpen, initialEvento]);

  // Gestione cambio tipo evento
  const handleTipoChange = (newTipo: TipoEvento) => {
    setTipo(newTipo);
    if (newTipo === 'riunione') {
      if (!titolo.trim() || titolo === 'Nuovo Evento' || titolo === 'Nuova Uscita' || titolo === 'Scadenza') {
        setTitolo('Prossima Riunione');
      }
      if (!initialEvento && !dataInizio) {
        setDataDaDefinire(true);
      }
      if (!luogo.trim()) {
        setShowOptionalLuogo(false);
      }
    } else if (newTipo === 'uscita' || newTipo === 'scadenza') {
      // Uscite e scadenze richiedono SEMPRE una data!
      setDataDaDefinire(false);
      if (titolo === 'Prossima Riunione') {
        setTitolo(newTipo === 'uscita' ? 'Nuova Uscita' : 'Scadenza');
      }
      if (newTipo === 'scadenza') {
        setDataFine('');
        if (!luogo.trim()) {
          setShowOptionalLuogo(false);
        }
      }
    } else {
      if (titolo === 'Prossima Riunione') {
        setTitolo('');
      }
    }
  };

  // Aggiunta punto ODG rapida con supporto ad incollaggio multi-linea
  const handleAddOdgPoint = () => {
    const raw = newOdgText.trim();
    if (!raw) return;
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s•\-\*\d\.\)\-]+\s*/, '').trim())
      .filter(Boolean);

    if (lines.length > 1) {
      setOdgList((prev) => [...prev, ...lines.map((t) => ({ testo: t, completato: false }))]);
    } else {
      const cleanSingle = raw.replace(/^[\s•\-\*\d\.\)\-]+\s*/, '').trim() || raw;
      setOdgList((prev) => [...prev, { testo: cleanSingle, completato: false }]);
    }
    setNewOdgText('');
    setTimeout(() => {
      odgInputRef.current?.focus();
    }, 0);
  };

  // Rimozione punto ODG
  const handleRemoveOdgPoint = (index: number) => {
    if (editingOdgIndex === index) {
      setEditingOdgIndex(null);
      setEditingOdgText('');
    }
    const item = odgList[index];
    if (item && item.id) {
      setDeletedOdgIds((prev) => [...prev, item.id!]);
    }
    setOdgList((prev) => prev.filter((_, i) => i !== index));
  };

  // Modifica punto ODG
  const handleStartEditOdg = (index: number) => {
    setEditingOdgIndex(index);
    setEditingOdgText(odgList[index]?.testo || '');
    setTimeout(() => {
      editInputRef.current?.focus();
    }, 0);
  };

  const handleSaveEditOdg = () => {
    if (editingOdgIndex === null) return;
    const trimmed = editingOdgText.trim();
    if (trimmed) {
      setOdgList((prev) =>
        prev.map((pt, i) => (i === editingOdgIndex ? { ...pt, testo: trimmed } : pt))
      );
    }
    setEditingOdgIndex(null);
    setEditingOdgText('');
  };

  const handleCancelEditOdg = () => {
    setEditingOdgIndex(null);
    setEditingOdgText('');
  };

  const handleSave = async () => {
    // Se c'è una modifica in corso, salvala prima di procedere
    if (editingOdgIndex !== null) {
      const trimmed = editingOdgText.trim();
      if (trimmed) {
        setOdgList((prev) =>
          prev.map((pt, i) => (i === editingOdgIndex ? { ...pt, testo: trimmed } : pt))
        );
      }
      setEditingOdgIndex(null);
      setEditingOdgText('');
    }

    if (!titolo.trim()) {
      setErrorMessage(I18N.calendario.titolo + ' è obbligatorio.');
      return;
    }

    const isTbd = canTypeBeTbd(tipo) && dataDaDefinire;

    if (!isTbd && !dataInizio) {
      setErrorMessage(
        tipo === 'scadenza'
          ? 'Il giorno di scadenza è obbligatorio.'
          : tipo === 'uscita'
          ? "Il giorno d'inizio uscita è obbligatorio."
          : I18N.calendario.inizio + ' è obbligatoria.'
      );
      return;
    }

    let inizioIso: string;
    let fineIso: string | null = null;

    if (isTbd) {
      inizioIso = SENTINEL_DATA_DA_DEFINIRE;
      fineIso = null;
    } else {
      // Imposta le date a 12:00:00 UTC per neutralizzare ogni slittamento di fuso orario
      inizioIso = `${dataInizio}T12:00:00.000Z`;

      if (tipo === 'riunione' || tipo === 'scadenza') {
        fineIso = null;
      } else {
        fineIso = dataFine ? `${dataFine}T12:00:00.000Z` : null;
      }
    }

    // Controllo fine >= inizio se specificata
    if (fineIso && fineIso < inizioIso) {
      setErrorMessage(I18N.calendario.erroreDateFine);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      let finalDesc = descrizione.trim();
      if (isTbd) {
        finalDesc = `${TAG_DATA_DA_DEFINIRE} ${finalDesc}`.trim();
      }

      // Campi secondari: salviamo il luogo se inserito o già esistente, senza azzerare arbitrariamente
      const finalLuogo = luogo.trim();

      // Cosa portare: se è un'uscita o un evento salviamo cosaPortare; per altri tipi manteniamo eventuale valore pregresso
      const finalCosaPortare = (tipo === 'uscita' || tipo === 'evento')
        ? cosaPortare.trim()
        : (initialEvento?.cosa_portare || '');

      const finalResponsabile = initialEvento?.responsabile ?? '';

      const saved = await saveEvento({
        id: initialEvento?.id || undefined,
        titolo: titolo.trim(),
        tipo,
        inizio: inizioIso,
        fine: fineIso,
        tutto_il_giorno: true, // Lavoriamo unicamente su giorni interi
        luogo: finalLuogo,
        responsabile: finalResponsabile,
        cosa_portare: finalCosaPortare,
        descrizione: finalDesc,
      });

      // Se è una riunione, salva i punti ODG aggiunti o modificati
      if (tipo === 'riunione') {
        for (const delId of deletedOdgIds) {
          try {
            await softDeleteRecord('odg_punti', delId);
          } catch {
            // Ignora eventuali record già rimossi
          }
        }

        for (let i = 0; i < odgList.length; i++) {
          const pt = odgList[i];
          if (pt && !pt.id) {
            await saveOdgPunto({
              evento_id: saved.id,
              testo: pt.testo,
              completato: pt.completato ?? false,
              ordine: i,
            });
          }
        }
      }

      setIsSaving(false);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(err.message || I18N.dialogs.erroreSalvataggio);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={initialEvento ? 'Modifica Attività' : I18N.calendario.nuovoEvento}
      subtitle="Pianificazione progressiva attività di Clan, uscite e riunioni."
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {I18N.dialogs.annulla}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!titolo.trim() || (!dataDaDefinire && !dataInizio) || isSaving}
          >
            {I18N.dialogs.salva}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        {/* Avviso Dati Personali e Privacy */}
        <div
          role="note"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-surface-hover)',
            borderLeft: '4px solid var(--color-interactive)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            lineHeight: 1.4,
            color: 'var(--color-text-secondary)',
          }}
        >
          {I18N.calendario.avvisoPrivacy}
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-bans-tenue)',
              color: 'var(--color-bans-text)',
              borderLeft: '4px solid var(--color-bans)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Titolo */}
        <div>
          <label
            htmlFor="evento-titolo"
            style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
          >
            {I18N.calendario.titolo} *
          </label>
          <input
            id="evento-titolo"
            type="text"
            className="ios-form-input"
            value={titolo}
            onInput={(e) => setTitolo((e.target as HTMLInputElement).value)}
            placeholder="es. Prossima Riunione, Uscita Majella, Bivacco..."
            required
            disabled={isSaving}
          />
        </div>

        {/* Tipo Attività */}
        <div>
          <label
            htmlFor="evento-tipo"
            style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
          >
            {I18N.calendario.tipo} *
          </label>
          <select
            id="evento-tipo"
            className="ios-form-input"
            value={tipo}
            onChange={(e) => handleTipoChange((e.target as HTMLSelectElement).value as TipoEvento)}
            disabled={isSaving}
          >
            <option value="riunione">{I18N.calendario.tipi.riunione}</option>
            <option value="uscita">{I18N.calendario.tipi.uscita}</option>
            <option value="scadenza">{I18N.calendario.tipi.scadenza}</option>
            <option value="evento">{I18N.calendario.tipi.evento}</option>
            <option value="altro">{I18N.calendario.tipi.altro}</option>
          </select>
        </div>

        {/* SEZIONE SPECIFICA PER RIUNIONI ("ODG FIRST") */}
        {tipo === 'riunione' ? (
          <>
            {/* Opzione Data da Concordare per Riunioni */}
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: dataDaDefinire ? 'var(--color-quaderno-tenue)' : 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${dataDaDefinire ? 'var(--color-quaderno)' : 'var(--color-border)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  id="evento-data-da-definire"
                  type="checkbox"
                  checked={dataDaDefinire}
                  onChange={(e) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    setDataDaDefinire(checked);
                    if (checked && !titolo.trim()) {
                      setTitolo('Prossima Riunione');
                    }
                  }}
                  disabled={isSaving}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="evento-data-da-definire" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: 'pointer', color: 'var(--color-ink)' }}>
                  Data ancora da concordare (prepara subito l'ODG)
                </label>
              </div>
              <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', paddingLeft: '26px' }}>
                {dataDaDefinire
                  ? 'Perfetto: scrivi i punti ODG qui sotto. La riunione resterà in cima al calendario pronta per quando fisserete la data.'
                  : 'Inserisci il giorno della riunione. Eventuali orari precisi possono essere specificati nelle note in basso.'}
              </span>
            </div>

            {/* Se data concordata: solo il giorno */}
            {!dataDaDefinire && (
              <div>
                <label
                  htmlFor="evento-data-riunione"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
                >
                  Giorno della Riunione *
                </label>
                <input
                  id="evento-data-riunione"
                  type="date"
                  className="ios-form-input"
                  value={dataInizio}
                  onInput={(e) => setDataInizio((e.target as HTMLInputElement).value)}
                  required
                  disabled={isSaving}
                />
              </div>
            )}

            {/* SEZIONE ORDINE DEL GIORNO (ODG) IN PRIMO PIANO */}
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-rest)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                <label
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--color-quaderno)',
                    letterSpacing: '0.04em',
                  }}
                >
                  Ordine del Giorno (ODG)
                </label>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {odgList.length} {odgList.length === 1 ? 'punto inserito' : 'punti inseriti'}
                </span>
              </div>

              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-3) 0' }}>
                Inserisci i punti di discussione. Premi <strong>Invio</strong> per aggiungere un punto e continuare a scrivere.
              </p>

              {/* Lista punti ODG correnti */}
              {odgList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  {odgList.map((pt, idx) => (
                    editingOdgIndex === idx ? (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-1) var(--space-2)',
                          backgroundColor: 'var(--color-surface)',
                          border: '1.5px solid var(--color-quaderno)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'var(--color-quaderno)',
                            fontSize: 'var(--font-size-xs)',
                            minWidth: '20px',
                          }}
                        >
                          {idx + 1}.
                        </span>
                        <input
                          ref={editInputRef}
                          type="text"
                          className="ios-form-input"
                          style={{
                            flex: 1,
                            height: '36px',
                            minHeight: '36px',
                            fontSize: '16px',
                            padding: '0 10px',
                          }}
                          value={editingOdgText}
                          onInput={(e) => setEditingOdgText((e.target as HTMLInputElement).value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEditOdg();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelEditOdg();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveEditOdg}
                          disabled={!editingOdgText.trim()}
                          className="ios-btn ios-btn-primary"
                          style={{
                            minHeight: '36px',
                            height: '36px',
                            minWidth: '36px',
                            padding: '0 8px',
                            flexShrink: 0,
                          }}
                          title="Salva modifica"
                          aria-label="Salva modifica punto ODG"
                        >
                          <Icon name="check" size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditOdg}
                          className="ios-btn ios-btn-ghost"
                          style={{
                            minHeight: '36px',
                            height: '36px',
                            minWidth: '36px',
                            padding: '0 8px',
                            color: 'var(--color-text-secondary)',
                            flexShrink: 0,
                          }}
                          title="Annulla modifica"
                          aria-label="Annulla modifica"
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                    ) : (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--space-2) var(--space-3)',
                          backgroundColor: 'var(--color-surface-hover)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-sm)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            flex: 1,
                            minWidth: 0,
                            cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                          onClick={() => handleStartEditOdg(idx)}
                          title="Tocca per modificare"
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              color: 'var(--color-quaderno)',
                              fontSize: 'var(--font-size-xs)',
                              minWidth: '20px',
                            }}
                          >
                            {idx + 1}.
                          </span>
                          <span style={{ color: 'var(--color-text)', wordBreak: 'break-word' }}>{pt.testo}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleStartEditOdg(idx)}
                            className="ios-btn ios-btn-ghost"
                            style={{
                              minHeight: '36px',
                              minWidth: '36px',
                              padding: '0 6px',
                              color: 'var(--color-text-secondary)',
                            }}
                            title="Modifica punto ODG"
                            aria-label={`Modifica punto ${pt.testo}`}
                          >
                            <Icon name="edit" size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveOdgPoint(idx)}
                            className="ios-btn ios-btn-ghost"
                            style={{
                              minHeight: '36px',
                              minWidth: '36px',
                              padding: '0 6px',
                              color: 'var(--color-bans)',
                            }}
                            title="Rimuovi punto ODG"
                            aria-label={`Rimuovi punto ${pt.testo}`}
                          >
                            <Icon name="close" size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* Input per nuovo punto ODG con supporto Invio a raffica */}
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  ref={odgInputRef}
                  type="text"
                  className="ios-form-input"
                  style={{ flex: 1 }}
                  value={newOdgText}
                  onInput={(e) => setNewOdgText((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOdgPoint();
                    }
                  }}
                  placeholder="Aggiungi punto ODG (es. Verifica bivacco, Scelta capitolo...)"
                  disabled={isSaving}
                />
                <button
                  type="button"
                  onClick={handleAddOdgPoint}
                  disabled={!newOdgText.trim() || isSaving}
                  className="ios-btn ios-btn-secondary"
                  style={{
                    minHeight: 'var(--touch-target)',
                    padding: '0 var(--space-3)',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  <Icon name="plus" size={16} />
                  <span>Aggiungi</span>
                </button>
              </div>
            </div>

            {/* Note per Riunioni */}
            <div>
              <label
                htmlFor="evento-descrizione"
                style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
              >
                Note e Dettagli (facoltativo)
              </label>
              <textarea
                id="evento-descrizione"
                className="ios-form-textarea"
                style={{ minHeight: '70px', padding: 'var(--space-3)' }}
                value={descrizione}
                onInput={(e) => setDescrizione((e.target as HTMLTextAreaElement).value)}
                placeholder="Eventuali orari di inizio, comunicazioni, promemoria..."
                disabled={isSaving}
              />
            </div>

            {/* Luogo opzionale per riunioni: non necessario di default per evitare rumore, ma non eliminato se presente */}
            {showOptionalLuogo || luogo.trim() ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                  <label
                    htmlFor="evento-luogo-riunione"
                    style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}
                  >
                    {I18N.calendario.luogo} (opzionale)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setLuogo('');
                      setShowOptionalLuogo(false);
                    }}
                    className="ios-btn ios-btn-ghost"
                    style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', padding: '0 4px', minHeight: 'auto', height: 'auto' }}
                  >
                    Rimuovi
                  </button>
                </div>
                <input
                  id="evento-luogo-riunione"
                  type="text"
                  className="ios-form-input"
                  value={luogo}
                  onInput={(e) => setLuogo((e.target as HTMLInputElement).value)}
                  placeholder="es. Sede di Gruppo, Casa di..."
                  disabled={isSaving}
                />
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setShowOptionalLuogo(true)}
                  className="ios-btn ios-btn-ghost"
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)',
                    padding: '2px 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Icon name="plus" size={14} />
                  <span>Aggiungi luogo (opzionale)</span>
                </button>
              </div>
            )}
          </>
        ) : (
          /* SEZIONE USCITE, EVENTI, SCADENZE, ALTRO */
          <>
            {/* Opzione Data da Concordare: SOLO per 'evento' e 'altro' (per uscite e scadenze la data è sempre richiesta) */}
            {canTypeBeTbd(tipo) && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: dataDaDefinire ? 'var(--color-interactive-tenue)' : 'var(--color-surface-hover)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${dataDaDefinire ? 'var(--color-interactive)' : 'var(--color-border)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <input
                    id="evento-data-da-definire-altro"
                    type="checkbox"
                    checked={dataDaDefinire}
                    onChange={(e) => {
                      setDataDaDefinire((e.target as HTMLInputElement).checked);
                    }}
                    disabled={isSaving}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="evento-data-da-definire-altro" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: 'pointer', color: 'var(--color-ink)' }}>
                    Data ancora da concordare
                  </label>
                </div>
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', paddingLeft: '26px' }}>
                  Se non avete ancora stabilito la data esatta, resterà in evidenza come attività da concordare.
                </span>
              </div>
            )}

            {/* Campi data */}
            {(!canTypeBeTbd(tipo) || !dataDaDefinire) && (
              tipo === 'scadenza' ? (
                <div>
                  <label
                    htmlFor="evento-data-inizio"
                    style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
                  >
                    Giorno di Scadenza *
                  </label>
                  <input
                    id="evento-data-inizio"
                    type="date"
                    className="ios-form-input"
                    value={dataInizio}
                    onInput={(e) => setDataInizio((e.target as HTMLInputElement).value)}
                    required
                    disabled={isSaving}
                  />

                  {/* Luogo opzionale per scadenze: non forzato per evitare rumore, ma non eliminato se presente */}
                  {showOptionalLuogo || luogo.trim() ? (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                        <label
                          htmlFor="evento-luogo-scadenza"
                          style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}
                        >
                          {I18N.calendario.luogo} (opzionale)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setLuogo('');
                            setShowOptionalLuogo(false);
                          }}
                          className="ios-btn ios-btn-ghost"
                          style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)', padding: '0 4px', minHeight: 'auto', height: 'auto' }}
                        >
                          Rimuovi
                        </button>
                      </div>
                      <input
                        id="evento-luogo-scadenza"
                        type="text"
                        className="ios-form-input"
                        value={luogo}
                        onInput={(e) => setLuogo((e.target as HTMLInputElement).value)}
                        placeholder="es. Sede Clan, Segreteria..."
                        disabled={isSaving}
                      />
                    </div>
                  ) : (
                    <div style={{ marginTop: 'var(--space-1)' }}>
                      <button
                        type="button"
                        onClick={() => setShowOptionalLuogo(true)}
                        className="ios-btn ios-btn-ghost"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-secondary)',
                          padding: '2px 0',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Icon name="plus" size={14} />
                        <span>Aggiungi luogo (opzionale)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div>
                    <label
                      htmlFor="evento-data-inizio"
                      style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
                    >
                      {tipo === 'uscita' ? "Giorno d'Inizio *" : "Giorno Inizio *"}
                    </label>
                    <input
                      id="evento-data-inizio"
                      type="date"
                      className="ios-form-input"
                      value={dataInizio}
                      onInput={(e) => setDataInizio((e.target as HTMLInputElement).value)}
                      required
                      disabled={isSaving}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="evento-data-fine"
                      style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
                    >
                      Giorno Fine (opzionale)
                    </label>
                    <input
                      id="evento-data-fine"
                      type="date"
                      className="ios-form-input"
                      value={dataFine}
                      onInput={(e) => setDataFine((e.target as HTMLInputElement).value)}
                      placeholder="Per uscite di più giorni"
                      disabled={isSaving}
                    />
                  </div>
                </div>
              )
            )}

            {/* Luogo: Pertinente per Uscite, Eventi, Altro (MAI per scadenze o riunioni) */}
            {(tipo === 'uscita' || tipo === 'evento' || tipo === 'altro') && (
              <div>
                <label
                  htmlFor="evento-luogo"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
                >
                  {tipo === 'uscita' ? 'Destinazione / Luogo' : I18N.calendario.luogo}
                </label>
                <input
                  id="evento-luogo"
                  type="text"
                  className="ios-form-input"
                  value={luogo}
                  onInput={(e) => setLuogo((e.target as HTMLInputElement).value)}
                  placeholder={tipo === 'uscita' ? "es. Majella, Rifugio Pomilio, Prati di Tivo..." : "es. Sede, Parco, Sala civica..."}
                  disabled={isSaving}
                />
              </div>
            )}

            {/* Cosa Portare: Pertinente SOLO per Uscite ed Eventi (MAI per scadenze, riunioni, altro) */}
            {(tipo === 'uscita' || tipo === 'evento') && (
              <div>
                <label
                  htmlFor="evento-cosaportare"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
                >
                  {I18N.calendario.cosaPortare}
                </label>
                <input
                  id="evento-cosaportare"
                  type="text"
                  className="ios-form-input"
                  value={cosaPortare}
                  onInput={(e) => setCosaPortare((e.target as HTMLInputElement).value)}
                  placeholder="es. Zaino spalla, sacco a pelo, scarponi, pranzo al sacco..."
                  disabled={isSaving}
                />
              </div>
            )}

            {/* Descrizione / Note */}
            <div>
              <label
                htmlFor="evento-descrizione"
                style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
              >
                {I18N.calendario.descrizione}
              </label>
              <textarea
                id="evento-descrizione"
                className="ios-form-textarea"
                style={{ minHeight: '80px', padding: 'var(--space-3)' }}
                value={descrizione}
                onInput={(e) => setDescrizione((e.target as HTMLTextAreaElement).value)}
                placeholder={
                  tipo === 'scadenza'
                    ? "Dettagli sulla scadenza, importo, iban, documenti da consegnare..."
                    : tipo === 'uscita'
                    ? "Orari precisi di ritrovo e rientro, dettagli logistici, indicazioni..."
                    : "Note organizzative, orari indicativi, promemoria..."
                }
                disabled={isSaving}
              />
            </div>
          </>
        )}
      </form>
    </BottomSheet>
  );
}
