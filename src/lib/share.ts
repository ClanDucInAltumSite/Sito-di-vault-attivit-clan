// src/lib/share.ts
// Modulo per la condivisione rapida dell'applicazione / pagina corrente.
// Utilizza la Web Share API nativa (navigator.share) su dispositivi mobili
// con fallback automatico agli appunti (navigator.clipboard.writeText) su desktop.

import { I18N } from './i18n';

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
}

export interface ShareResult {
  shared: boolean;
  copied: boolean;
  error?: unknown;
}

/**
 * Condivide l'applicazione o una risorsa specifica.
 * 1. Prova prima navigator.share (mobile / PWA installata).
 * 2. Se navigator.share fallisce o non è supportato, copia negli appunti.
 * Gestisce silenziosamente l'annullamento utente (AbortError).
 */
export async function shareWebApp(options?: ShareOptions): Promise<ShareResult> {
  const title = options?.title || I18N.app.shareTitle;
  const text = options?.text || I18N.app.shareText;
  const url =
    options?.url ||
    (typeof window !== 'undefined' && window.location ? window.location.href : '');

  // 1. Tenta la Web Share API nativa
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return { shared: true, copied: false };
    } catch (err: any) {
      // Se l'utente ha premuto "Annulla" nel foglio di condivisione di sistema, non è un errore
      if (err && (err.name === 'AbortError' || err.code === 20)) {
        return { shared: false, copied: false };
      }
      // Altri errori (es. permesso rifiutato o non supportato nel contesto): procedi al fallback
    }
  }

  // 2. Fallback su Clipboard API (Desktop o browser senza Web Share)
  if (url && typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(url);
      return { shared: false, copied: true };
    } catch {
      // Procedi al fallback legacy sottostante
    }
  }

  // 3. Fallback estremo con document.execCommand
  if (url && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        return { shared: false, copied: true };
      }
    } catch (legacyErr) {
      return { shared: false, copied: false, error: legacyErr };
    }
  }

  return { shared: false, copied: false };
}
