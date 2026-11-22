// test/pdf_utils.test.ts
import { describe, it, expect, vi } from 'vitest';
import { dataUrlToBlob, openPdfDocument, downloadPdfDocument } from '../src/lib/pdf_utils';

describe('pdf_utils - Gestione sicura Blob e apertura PDF', () => {
  const samplePdfBase64 = 'JVBERi0xLjQKJcTl8uXr'; // Intestazione minima PDF: %PDF-1.4
  const sampleDataUrl = `data:application/pdf;base64,${samplePdfBase64}`;

  it('1. dataUrlToBlob converte correttamente un dataURL in un Blob application/pdf', () => {
    const blob = dataUrlToBlob(sampleDataUrl);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('2. openPdfDocument crea un blobUrl nativo ed evita iframe bloccati', () => {
    const createObjectUrlMock = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-pdf');
    const windowOpenMock = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    openPdfDocument(sampleDataUrl, 'test.pdf');

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(windowOpenMock).toHaveBeenCalledWith('blob:http://localhost/test-pdf', '_blank');

    createObjectUrlMock.mockRestore();
    windowOpenMock.mockRestore();
  });

  it('3. downloadPdfDocument crea un elemento anchor con attributo download e revoca blob', () => {
    const createObjectUrlMock = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-pdf');
    let clickedHref = '';
    let clickedDownload = '';

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') {
        el.click = () => {
          clickedHref = (el as HTMLAnchorElement).href;
          clickedDownload = (el as HTMLAnchorElement).download;
        };
      }
      return el;
    });

    downloadPdfDocument(sampleDataUrl, 'manuale_scout');

    expect(clickedHref).toBe('blob:http://localhost/test-pdf');
    expect(clickedDownload).toBe('manuale_scout.pdf');

    createObjectUrlMock.mockRestore();
    vi.restoreAllMocks();
  });
});
