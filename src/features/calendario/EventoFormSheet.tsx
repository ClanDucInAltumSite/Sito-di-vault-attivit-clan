// src/features/calendario/EventoFormSheet.tsx
// Modale Admin per creazione e modifica eventi di calendario
// Campi data/ora dinamici per tipologia, inserimento ODG contestuale per riunioni,
// styling corretto dark-mode con classi ios-form-input, rimozione campo responsabile.

import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { I18N } from '../../lib/i18n';
import { Evento, TipoEvento, getOdgPunti } from '../../lib/db';
import { saveEvento, saveOdgPunto, softDeleteRecord } from '../../lib/admin_actions';

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
  const [inizio, setInizio] = useState('');
  const [fine, setFine] = useState('');
  const [oraFine, setOraFine] = useState('');
  const [tuttoIlGiorno, setTuttoIlGiorno] = useState(false);
  const [luogo, setLuogo] = useState('');
  const [cosaPortare, setCosaPortare] = useState('');
  const [descrizione, setDescrizione] = useState('');

  // Stato per ODG contestuale (visibile solo per tipo === 'riunione')
  const [odgList, setOdgList] = useState<OdgDraftItem[]>([]);
  const [newOdgText, setNewOdgText] = useState('');
  const [deletedOdgIds, setDeletedOdgIds] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formatta Date in stringa compatibile con input datetime-local o date (YYYY-MM-DDTHH:mm o YYYY-MM-DD)
  const toInputDate = (isoStr: string | null | undefined, allDay: boolean): string => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (allDay) return `${y}-${m}-${day}`;
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  const toInputTime = (isoStr: string | null | undefined): string => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  };

  useEffect(() => {
    if (isOpen) {
      if (initialEvento) {
        setTitolo(initialEvento.titolo);
        setTipo(initialEvento.tipo);
        setTuttoIlGiorno(initialEvento.tutto_il_giorno);
        setInizio(toInputDate(initialEvento.inizio, initialEvento.tutto_il_giorno));
        setFine(toInputDate(initialEvento.fine, initialEvento.tutto_il_giorno));
        setOraFine(toInputTime(initialEvento.fine));
        setLuogo(initialEvento.luogo || (initialEvento.tipo === 'riunione' ? 'Sede' : ''));
        setCosaPortare(initialEvento.cosa_portare || '');
        setDescrizione(initialEvento.descrizione || '');
        setDeletedOdgIds([]);

        // Se è riunione, carica gli ODG esistenti per consentire modifiche contestuali
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
        // Default per nuovo evento: prossimo sabato o oggi alle 20:45
        const defaultDate = new Date();
        defaultDate.setHours(20, 45, 0, 0);
        setTitolo('');
        setTipo('riunione');
        setTuttoIlGiorno(false);
        setInizio(toInputDate(defaultDate.toISOString(), false));
        setFine('');
        setOraFine('23:00');
        setLuogo('Sede'); // Default 'Sede' per riunione
        setCosaPortare('');
        setDescrizione('');
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
      if (!luogo || luogo.trim() === '') {
        setLuogo('Sede');
      }
      if (!oraFine) {
        setOraFine('23:00');
      }
    } else if (newTipo === 'scadenza') {
      setFine('');
      setOraFine('');
    }
  };

  // Aggiunta punto ODG
  const handleAddOdgPoint = () => {
    const trimmed = newOdgText.trim();
    if (!trimmed) return;
    setOdgList((prev) => [...prev, { testo: trimmed, completato: false }]);
    setNewOdgText('');
  };

  // Rimozione punto ODG
  const handleRemoveOdgPoint = (index: number) => {
    const item = odgList[index];
    if (item && item.id) {
      setDeletedOdgIds((prev) => [...prev, item.id!]);
    }
    setOdgList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!titolo.trim()) {
      setErrorMessage(I18N.calendario.titolo + ' è obbligatorio.');
      return;
    }
    if (!inizio) {
      setErrorMessage(I18N.calendario.inizio + ' è obbligatoria.');
      return;
    }

    // Converti date input in ISO string in base alla tipologia
    let inizioIso: string;
    let fineIso: string | null = null;

    if (tuttoIlGiorno) {
      inizioIso = new Date(`${inizio}T00:00:00`).toISOString();
      if (tipo === 'scadenza') {
        fineIso = null;
      } else if (tipo === 'riunione') {
        fineIso = new Date(`${inizio}T23:59:59`).toISOString();
      } else {
        fineIso = fine ? new Date(`${fine}T23:59:59`).toISOString() : null;
      }
    } else {
      inizioIso = new Date(inizio).toISOString();

      if (tipo === 'riunione') {
        // Riunione: usa l'ora di fine applicata alla stessa data di inizio
        if (oraFine) {
          const datePart = inizio.slice(0, 10);
          let endD = new Date(`${datePart}T${oraFine}:00`);
          // Se l'ora di fine è precedente all'ora di inizio, assume che finisca dopo la mezzanotte
          if (endD.getTime() < new Date(inizioIso).getTime()) {
            endD = new Date(endD.getTime() + 24 * 60 * 60 * 1000);
          }
          fineIso = endD.toISOString();
        } else {
          fineIso = null;
        }
      } else if (tipo === 'scadenza') {
        // Scadenza: ha solo data e ora, nessun campo fine
        fineIso = null;
      } else {
        // Uscita, Evento Clan, Altro: data e ora fine completa
        fineIso = fine ? new Date(fine).toISOString() : null;
      }
    }

    // Controllo fine >= inizio (quando fineIso è valorizzato)
    if (fineIso && new Date(fineIso).getTime() < new Date(inizioIso).getTime()) {
      setErrorMessage(I18N.calendario.erroreDateFine);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const saved = await saveEvento({
        id: initialEvento?.id,
        titolo: titolo.trim(),
        tipo,
        inizio: inizioIso,
        fine: fineIso,
        tutto_il_giorno: tuttoIlGiorno,
        luogo: luogo.trim(),
        responsabile: '', // Campo responsabile rimosso dai requisiti utente
        cosa_portare: cosaPortare.trim(),
        descrizione: descrizione.trim(),
      });

      // Se è una riunione, salva i punti ODG aggiunti o modificati
      if (tipo === 'riunione') {
        // Rimuovi eventuali punti cancellati
        for (const delId of deletedOdgIds) {
          try {
            await softDeleteRecord('odg_punti', delId);
          } catch {
            // Ignora eventuali record già rimossi
          }
        }

        // Salva i nuovi punti aggiunti
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
      title={initialEvento ? 'Modifica Evento' : I18N.calendario.nuovoEvento}
      subtitle="Pianificazione attività di Clan, uscite e riunioni."
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {I18N.dialogs.annulla}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!titolo.trim() || !inizio || isSaving}
          >
            {I18N.dialogs.salva}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
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
            placeholder="es. Riunione di Clan, Uscita sui Sibillini..."
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

        {/* Toggle Tutto il giorno */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input
            id="evento-allday"
            type="checkbox"
            checked={tuttoIlGiorno}
            onChange={(e) => {
              const checked = (e.target as HTMLInputElement).checked;
              setTuttoIlGiorno(checked);
              if (inizio) setInizio(toInputDate(new Date(inizio).toISOString(), checked));
              if (fine) setFine(toInputDate(new Date(fine).toISOString(), checked));
            }}
            disabled={isSaving}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="evento-allday" style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
            {I18N.calendario.tuttoIlGiorno}
          </label>
        </div>

        {/* SEZIONE DATE E ORA DINAMICA PER TIPOLOGIA */}
        {tipo === 'riunione' ? (
          /* RIUNIONE: Data e ora inizio + solo ora fine */
          <div style={{ display: 'grid', gridTemplateColumns: tuttoIlGiorno ? '1fr' : '1.3fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label
                htmlFor="evento-inizio"
                style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
              >
                {tuttoIlGiorno ? 'Data Riunione *' : 'Data e Ora Inizio *'}
              </label>
              <input
                id="evento-inizio"
                type={tuttoIlGiorno ? 'date' : 'datetime-local'}
                className="ios-form-input"
                value={inizio}
                onInput={(e) => setInizio((e.target as HTMLInputElement).value)}
                required
                disabled={isSaving}
              />
            </div>

            {!tuttoIlGiorno && (
              <div>
                <label
                  htmlFor="evento-ora-fine"
                  style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
                >
                  Ora Fine
                </label>
                <input
                  id="evento-ora-fine"
                  type="time"
                  className="ios-form-input"
                  value={oraFine}
                  onInput={(e) => setOraFine((e.target as HTMLInputElement).value)}
                  disabled={isSaving}
                />
              </div>
            )}
          </div>
        ) : tipo === 'scadenza' ? (
          /* SCADENZA: solo data e ora (nessun campo fine) */
          <div>
            <label
              htmlFor="evento-inizio"
              style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
            >
              {tuttoIlGiorno ? 'Data Scadenza *' : 'Data e Ora Scadenza *'}
            </label>
            <input
              id="evento-inizio"
              type={tuttoIlGiorno ? 'date' : 'datetime-local'}
              className="ios-form-input"
              value={inizio}
              onInput={(e) => setInizio((e.target as HTMLInputElement).value)}
              required
              disabled={isSaving}
            />
          </div>
        ) : (
          /* USCITA / EVENTO CLAN / ALTRO: data e ora inizio + data e ora fine */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label
                htmlFor="evento-inizio"
                style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
              >
                {I18N.calendario.inizio} *
              </label>
              <input
                id="evento-inizio"
                type={tuttoIlGiorno ? 'date' : 'datetime-local'}
                className="ios-form-input"
                value={inizio}
                onInput={(e) => setInizio((e.target as HTMLInputElement).value)}
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label
                htmlFor="evento-fine"
                style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
              >
                {I18N.calendario.fine}
              </label>
              <input
                id="evento-fine"
                type={tuttoIlGiorno ? 'date' : 'datetime-local'}
                className="ios-form-input"
                value={fine}
                onInput={(e) => setFine((e.target as HTMLInputElement).value)}
                disabled={isSaving}
              />
            </div>
          </div>
        )}

        {/* Luogo (posizionato prima di descrizione/note) */}
        <div>
          <label
            htmlFor="evento-luogo"
            style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
          >
            {I18N.calendario.luogo}
          </label>
          <input
            id="evento-luogo"
            type="text"
            className="ios-form-input"
            value={luogo}
            onInput={(e) => setLuogo((e.target as HTMLInputElement).value)}
            placeholder={tipo === 'riunione' ? 'Sede' : 'es. Sede di Gruppo, Prati di Tivo...'}
            disabled={isSaving}
          />
        </div>

        {/* Cosa Portare */}
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
            placeholder="es. Zaino spalla, pranzo al sacco, quaderno..."
            disabled={isSaving}
          />
        </div>

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
            placeholder="Note organizzative, orari dettagliati, istruzioni..."
            disabled={isSaving}
          />
        </div>

        {/* SEZIONE ORDINE DEL GIORNO (ODG) - ESCLUSIVA PER RIUNIONI */}
        {tipo === 'riunione' && (
          <div
            style={{
              marginTop: 'var(--space-2)',
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <label
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color-calendario)',
                  letterSpacing: '0.04em',
                }}
              >
                Ordine del Giorno (ODG)
              </label>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {odgList.length} {odgList.length === 1 ? 'punto inserito' : 'punti inseriti'}
              </span>
            </div>

            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              Definisci i punti di discussione per la riunione. Potrai spuntarli e gestirli anche nella vista evento.
            </div>

            {/* Lista punti ODG correnti */}
            {odgList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {odgList.map((pt, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: 'var(--color-interactive)',
                          fontSize: 'var(--font-size-xs)',
                          minWidth: '20px',
                        }}
                      >
                        {idx + 1}.
                      </span>
                      <span style={{ color: 'var(--color-text)', wordBreak: 'break-word' }}>{pt.testo}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveOdgPoint(idx)}
                      className="ios-btn ios-btn-ghost"
                      style={{
                        minHeight: '28px',
                        minWidth: '28px',
                        padding: '0 4px',
                        color: 'var(--color-bans)',
                        flexShrink: 0,
                      }}
                      title="Rimuovi punto ODG"
                      aria-label={`Rimuovi punto ${pt.testo}`}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input per nuovo punto ODG */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
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
                placeholder="Aggiungi punto ODG (es. Verifica bivacco, Scelta route...)"
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
        )}
      </form>
    </BottomSheet>
  );
}
