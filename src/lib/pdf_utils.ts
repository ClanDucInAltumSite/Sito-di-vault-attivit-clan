// src/lib/pdf_utils.ts
// Utility sicure per la gestione e l'apertura di documenti PDF (dataURL, base64 e Blob)
// Risolve i blocchi moderni di sicurezza dei browser (Chromium/WebKit) sui frame data:application/pdf

/**
 * Converte una stringa dataURL (es. data:application/pdf;base64,...) in un oggetto Blob nativo.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
  const base64Data = parts[1] || '';
  const byteString = atob(base64Data);
  const byteNumbers = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    byteNumbers[i] = byteString.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type: mime });
}

/**
 * Apre un documento PDF in una nuova scheda nativa del browser.
 * Utilizza un URL blob di medesima origine per evitare che Chromium/Edge/Safari
 * blocchino la visualizzazione del contenuto (errore 'Questi contenuti sono bloccati').
 */
export function openPdfDocument(dataUrlOrBlobUrl: string, fileName?: string): void {
  if (!dataUrlOrBlobUrl) return;

  let url = dataUrlOrBlobUrl;
  let isCreatedBlob = false;

  if (dataUrlOrBlobUrl.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(dataUrlOrBlobUrl);
      url = URL.createObjectURL(blob);
      isCreatedBlob = true;
    } catch (err) {
      console.error('Errore conversione dataURL in Blob per apertura PDF:', err);
    }
  }

  // Apri in una nuova finestra o scheda senza 'noreferrer',
  // poiché i browser Chromium (Chrome/Edge/Brave) bloccano l'apertura
  // dei viewer PDF interni su blob/URL quando il referrer è anonimizzato.
  const win = window.open(url, '_blank');
  if (!win) {
    // Se bloccato dal popup blocker del browser, simula il click su link temporaneo
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    if (fileName) {
      a.download = fileName;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Rilascia l'URL blob dopo 60 secondi per non saturare la memoria
  if (isCreatedBlob) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignora eventuali errori di rilascio
      }
    }, 60000);
  }
}

/**
 * Scarica un file PDF sul file system dell'utente.
 */
export function downloadPdfDocument(dataUrlOrBlobUrl: string, fileName: string): void {
  if (!dataUrlOrBlobUrl) return;

  let url = dataUrlOrBlobUrl;
  let isCreatedBlob = false;

  if (dataUrlOrBlobUrl.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(dataUrlOrBlobUrl);
      url = URL.createObjectURL(blob);
      isCreatedBlob = true;
    } catch {
      url = dataUrlOrBlobUrl;
    }
  }

  const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (isCreatedBlob) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignora eventuali errori di rilascio
      }
    }, 30000);
  }
}
