// src/lib/stampa_shared.ts
// Funzioni e utilità di base condivise tra le diverse tipologie di stampa.

/**
 * Helper per riordinare elementi in un array (sposta su o giù).
 */
export function moveItemInArray<T>(array: T[], index: number, direction: 'up' | 'down'): T[] {
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= array.length) return array;
  const result = [...array];
  const [removed] = result.splice(index, 1);
  if (removed !== undefined) {
    result.splice(newIndex, 0, removed);
  }
  return result;
}

/**
 * Avvia la stampa del browser impostando l'attributo data-print sul body
 * per garantire l'isolamento completo di regole @page, margini e classi.
 * Rimuove l'attributo dopo l'evento afterprint.
 */
export function triggerPrint(printType: 'giochibans' | 'canzoni' | 'odg'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  document.body.setAttribute('data-print', printType);

  const cleanup = () => {
    document.body.removeAttribute('data-print');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.print();
}

/**
 * Formatta la data odierna in italiano per la testata di stampa o copertina.
 */
export function formatPrintDate(d: Date = new Date()): string {
  return d.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
