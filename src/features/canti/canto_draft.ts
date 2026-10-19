/**
 * Gestione Bozze Locali Automatiche per il Canzoniere (Fase 10C)
 *
 * Salva automaticamente in localStorage lo stato del canto in fase di inserimento o modifica.
 * Mostra all'utente un banner di ripristino se la pagina viene ricaricata o chiusa accidentalmente.
 * La bozza viene eliminata solo dopo il salvataggio confermato sul database o con scarto esplicito.
 */

export interface CantoDraft {
  titolo: string;
  autore: string;
  misura: string;
  bpm_testo: string;
  ritmo: string;
  capotasto: string;
  tonalita: string;
  testo_chordpro: string;
  note: string;
  settore: string;
  initialCantoId?: string | null;
  updatedAt: number; // timestamp ms
}

const DRAFT_STORAGE_KEY = 'vault_scout_canto_form_draft';

/**
 * Salva la bozza locale corrente in localStorage.
 */
export function saveCantoDraft(draft: Omit<CantoDraft, 'updatedAt'>): void {
  try {
    const payload: CantoDraft = {
      ...draft,
      updatedAt: Date.now(),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[CantoDraft] Errore salvataggio bozza locale:', err);
  }
}

/**
 * Carica la bozza salvata (se presente e non vuota).
 */
export function loadCantoDraft(): CantoDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CantoDraft;
    // Controlla che contenga almeno qualche dato significativo
    const hasContent = Boolean(
      (parsed.titolo && parsed.titolo.trim()) ||
      (parsed.testo_chordpro && parsed.testo_chordpro.trim())
    );
    if (!hasContent) return null;
    return parsed;
  } catch (err) {
    console.warn('[CantoDraft] Errore lettura bozza locale:', err);
    return null;
  }
}

/**
 * Elimina la bozza salvata. Chiamata solo dopo salvataggio confermato o scarto esplicito.
 */
export function clearCantoDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (err) {
    console.warn('[CantoDraft] Errore rimozione bozza:', err);
  }
}

/**
 * Formatta l'orario della bozza in formato leggibile italiano (es. "10:45" o "19/10 alle 10:45").
 */
export function formatDraftTime(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `oggi alle ${timeStr}`;
    }
    const dayStr = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    return `il ${dayStr} alle ${timeStr}`;
  } catch {
    return 'in precedenza';
  }
}
