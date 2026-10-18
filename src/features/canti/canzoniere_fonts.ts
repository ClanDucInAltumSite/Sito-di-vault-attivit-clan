/**
 * canzoniere_fonts.ts
 * Gestione affidabile del pre-caricamento font per il Canzoniere A4 e la stampa.
 * 
 * Attende document.fonts.load() per Roboto (400, 400 italic, 700, 22pt) e Nova Mono (400, 700)
 * e document.fonts.ready, seguito da due cicli di requestAnimationFrame.
 * Questo impedisce che Chrome in fase di stampa ricorra ai font di fallback (Arial o Consolas).
 */

export async function ensureCanzoniereFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;

  try {
    await Promise.all([
      document.fonts.load('400 11pt Roboto'),
      document.fonts.load('italic 11pt Roboto'),
      document.fonts.load('700 11pt Roboto'),
      document.fonts.load('700 22pt Roboto'),
      document.fonts.load('400 17pt "Nova Mono"'),
      document.fonts.load('700 17pt "Nova Mono"'),
      document.fonts.ready,
    ]);
  } catch (err) {
    // Fallback se document.fonts non supportato o errore parziale
    console.warn('[ensureCanzoniereFontsLoaded] Errore caricamento font:', err);
  }

  // Due requestAnimationFrame per attendere che il browser calcoli e aggiorni le metriche dei glifi
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }
}
