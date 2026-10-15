// src/features/calendario/EventoFormSheet.tsx
// Modale Admin per creazione e modifica eventi di calendario
// Validazione fine >= inizio, toggle tutto il giorno, avviso dati personali

import { useState, useEffect } from 'preact/hooks';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { I18N } from '../../lib/i18n';
import { Evento, TipoEvento } from '../../lib/db';
import { saveEvento } from '../../lib/admin_actions';

export interface EventoFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (evento: Evento) => void;
  initialEvento?: Evento | null;
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
  const [tuttoIlGiorno, setTuttoIlGiorno] = useState(false);
  const [luogo, setLuogo] = useState('');
  const [responsabile, setResponsabile] = useState('');
  const [cosaPortare, setCosaPortare] = useState('');
  const [descrizione, setDescrizione] = useState('');
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

  useEffect(() => {
    if (isOpen) {
      if (initialEvento) {
        setTitolo(initialEvento.titolo);
        setTipo(initialEvento.tipo);
        setTuttoIlGiorno(initialEvento.tutto_il_giorno);
        setInizio(toInputDate(initialEvento.inizio, initialEvento.tutto_il_giorno));
        setFine(toInputDate(initialEvento.fine, initialEvento.tutto_il_giorno));
        setLuogo(initialEvento.luogo || '');
        setResponsabile(initialEvento.responsabile || '');
        setCosaPortare(initialEvento.cosa_portare || '');
        setDescrizione(initialEvento.descrizione || '');
      } else {
        // Default per nuovo evento: prossimo sabato alle 15:30
        const defaultDate = new Date();
        defaultDate.setHours(18, 30, 0, 0);
        setTitolo('');
        setTipo('riunione');
        setTuttoIlGiorno(false);
        setInizio(toInputDate(defaultDate.toISOString(), false));
        setFine('');
        setLuogo('');
        setResponsabile('');
        setCosaPortare('');
        setDescrizione('');
      }
      setErrorMessage(null);
    }
  }, [isOpen, initialEvento]);

  const handleSave = async () => {
    if (!titolo.trim()) {
      setErrorMessage(I18N.calendario.titolo + ' è obbligatorio.');
      return;
    }
    if (!inizio) {
      setErrorMessage(I18N.calendario.inizio + ' è obbligatoria.');
      return;
    }

    // Converti date input in ISO string
    let inizioIso: string;
    let fineIso: string | null = null;

    if (tuttoIlGiorno) {
      inizioIso = new Date(`${inizio}T00:00:00`).toISOString();
      fineIso = fine ? new Date(`${fine}T23:59:59`).toISOString() : null;
    } else {
      inizioIso = new Date(inizio).toISOString();
      fineIso = fine ? new Date(fine).toISOString() : null;
    }

    // Controllo fine >= inizio
    if (fineIso && new Date(fineIso).getTime() < new Date(inizioIso).getTime()) {
      setErrorMessage(I18N.calendario.erroreDateFine);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const saved = await saveEvento({
        id: initialEvento?.id,
        titolo,
        tipo,
        inizio: inizioIso,
        fine: fineIso,
        tutto_il_giorno: tuttoIlGiorno,
        luogo,
        responsabile,
        cosa_portare: cosaPortare,
        descrizione,
      });

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
            className="ios-search-container"
            style={{ width: '100%', boxSizing: 'border-box' }}
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
            className="ios-search-container"
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={tipo}
            onChange={(e) => setTipo((e.target as HTMLSelectElement).value as TipoEvento)}
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
              // Riconverti i valori di inizio e fine
              if (inizio) setInizio(toInputDate(new Date(inizio).toISOString(), checked));
              if (fine) setFine(toInputDate(new Date(fine).toISOString(), checked));
            }}
            disabled={isSaving}
            style={{ width: '18px', height: '18px' }}
          />
          <label htmlFor="evento-allday" style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
            {I18N.calendario.tuttoIlGiorno}
          </label>
        </div>

        {/* Inizio e Fine */}
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
              className="ios-search-container"
              style={{ width: '100%', boxSizing: 'border-box' }}
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
              className="ios-search-container"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={fine}
              onInput={(e) => setFine((e.target as HTMLInputElement).value)}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Luogo */}
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
            className="ios-search-container"
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={luogo}
            onInput={(e) => setLuogo((e.target as HTMLInputElement).value)}
            placeholder="es. Sede di Gruppo, Prati di Tivo..."
            disabled={isSaving}
          />
        </div>

        {/* Responsabile */}
        <div>
          <label
            htmlFor="evento-responsabile"
            style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}
          >
            {I18N.calendario.responsabile}
          </label>
          <input
            id="evento-responsabile"
            type="text"
            className="ios-search-container"
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={responsabile}
            onInput={(e) => setResponsabile((e.target as HTMLInputElement).value)}
            placeholder="es. Capi Clan, Pattuglia Animazione..."
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
            className="ios-search-container"
            style={{ width: '100%', boxSizing: 'border-box' }}
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
            className="ios-search-container"
            style={{ width: '100%', minHeight: '80px', height: 'auto', padding: 'var(--space-2)', boxSizing: 'border-box', fontFamily: 'inherit' }}
            value={descrizione}
            onInput={(e) => setDescrizione((e.target as HTMLTextAreaElement).value)}
            placeholder="Note organizzative, orari dettagliati, istruzioni..."
            disabled={isSaving}
          />
        </div>
      </form>
    </BottomSheet>
  );
}
