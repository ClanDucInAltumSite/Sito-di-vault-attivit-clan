// src/features/quaderno/quaderno_image.ts
// Ottimizzazione e compressione client-side su canvas delle immagini per i documenti Quaderno

export async function compressImageForDocument(
  file: File,
  maxDimension = 1280,
  quality = 0.8
): Promise<{ dataUrl: string; name: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Il file selezionato non è un\'immagine valida.'));
    }

    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[[\]()]/g, '')
      .trim() || 'Immagine';
    const reader = new FileReader();

    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return resolve({ dataUrl: rawDataUrl, name: cleanName });
        }

        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve({ dataUrl, name: cleanName });
      };

      img.onerror = () => {
        reject(new Error('Impossibile caricare l\'immagine selezionata.'));
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      reject(new Error('Errore durante la lettura del file immagine.'));
    };

    reader.readAsDataURL(file);
  });
}
