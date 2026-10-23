/**
 * src/features/canti/word_template.ts
 *
 * Generatore di template Word (.docx) e Google Docs per il Canzoniere Scout.
 * Produce un file .docx nativo e leggero conforme allo standard visivo di "Strade di Coraggio".
 */

import JSZip from 'jszip';

/**
 * Genera il buffer binario di un file .docx conforme al layout "Strade di Coraggio".
 */
export async function generateScoutWordTemplate(): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. word/styles.xml
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="it-IT"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="80" w:line="240" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`
  );

  // Helper per generare paragrafi compatti senza ritorni a capo spuri
  const p = (text: string, options: { bold?: boolean; italic?: boolean; sizePt?: number; align?: string; spaceAfter?: number } = {}) => {
    const { bold, italic, sizePt = 11, align = 'left', spaceAfter = 80 } = options;
    const szVal = Math.round(sizePt * 2);
    const jc = align === 'center' ? '<w:jc w:val="center"/>' : '';
    const b = bold ? '<w:b/><w:bCs/>' : '';
    const i = italic ? '<w:i/><w:iCs/>' : '';

    return `<w:p><w:pPr>${jc}<w:spacing w:after="${spaceAfter}" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${b}${i}<w:sz w:val="${szVal}"/><w:szCs w:val="${szVal}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  };

  const escapeXml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // 5. word/document.xml - Contenuto predefinito conforme a Strade di Coraggio
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${p('TITOLO DEL CANTO', { bold: true, sizePt: 16, spaceAfter: 60 })}
    ${p('Autore o Occasione (es. Route Nazionale / Gruppo)', { italic: true, sizePt: 11, spaceAfter: 60 })}
    ${p('Tempo: 4/4 ; circa 92–94 BPM.   Ritmo pennata: Giù, Giù-Su, Su-Giù-Su (↓  ↓↑  ↑↓↑)', { sizePt: 10, spaceAfter: 160 })}

    ${p('Do   Fa   Do   Sol', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('Sento nel profondo un desiderio nascere', { sizePt: 11, spaceAfter: 60 })}
    ${p('Do   Fa   Do   Sol', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('è la voglia di partire che continua a crescere', { sizePt: 11, spaceAfter: 60 })}
    ${p('Lam   Fa   Do   Sol', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('verso l\'orizzonte possiam camminare', { sizePt: 11, spaceAfter: 60 })}
    ${p('Lam   Fa   Do   Sol', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('ricorda che solo chi sogna può volare', { sizePt: 11, spaceAfter: 160 })}

    ${p('Cammino con la saggezza del viaggiatore', { sizePt: 11, spaceAfter: 60 })}
    ${p('vivo con gli occhi di un sognatore', { sizePt: 11, spaceAfter: 60 })}
    ${p('la felicità non è un semplice traguardo', { sizePt: 11, spaceAfter: 60 })}
    ${p('ma la direzione del nostro sguardo', { sizePt: 11, spaceAfter: 160 })}

    ${p('RIT:', { bold: true, sizePt: 11, spaceAfter: 60 })}
    ${p('Do   Sol   Lam   Fa', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('E\' giunta l\'ora, è giunto il momento', { sizePt: 11, spaceAfter: 60 })}
    ${p('Do   Sol   Lam   Fa', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('di essere protagonisti del nostro tempo,', { sizePt: 11, spaceAfter: 60 })}
    ${p('Do   Sol   Lam   Fa', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('la strada è la stessa anche se siamo lontani', { sizePt: 11, spaceAfter: 60 })}
    ${p('Do   Sol   Lam   Fa', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('servire è la sfida, il futuro è domani', { sizePt: 11, spaceAfter: 60 })}
    ${p('Do   Sol   Lam   Fa', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('affrontiamo con coraggio ogni salita', { sizePt: 11, spaceAfter: 60 })}
    ${p('Do   Sol   Fa   Do', { bold: true, sizePt: 11, spaceAfter: 30 })}
    ${p('diritti al futuro sulle strade della nostra vita', { sizePt: 11, spaceAfter: 160 })}

    ${p('Un cielo stellato, un fuoco e il suo calore', { sizePt: 11, spaceAfter: 60 })}
    ${p('ogni momento ha un suo dolce sapore', { sizePt: 11, spaceAfter: 60 })}
    ${p('vediamo in lontananza una stella brillare', { sizePt: 11, spaceAfter: 60 })}
    ${p('certezza di qualcuno a cui potersi affidare', { sizePt: 11, spaceAfter: 160 })}

    ${p('RIT.', { bold: true, sizePt: 11, spaceAfter: 160 })}

    ${p('Viviamo per l\'oggi, il futuro è sullo sfondo', { sizePt: 11, spaceAfter: 60 })}
    ${p('sporchiamo le nostre mani in questo mondo', { sizePt: 11, spaceAfter: 60 })}
    ${p('non si può più stare fermi ad aspettare', { sizePt: 11, spaceAfter: 60 })}
    ${p('il nostro sorriso ha ancora molto da dare', { sizePt: 11, spaceAfter: 160 })}

    ${p('RIT.', { bold: true, sizePt: 11, spaceAfter: 160 })}

    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', docXml);

  const blob = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return blob;
}

/**
 * Avvia il download nel browser del file Modello_Canto_Scout.docx.
 */
export async function downloadScoutWordTemplate(filename = 'Modello_Canto_Scout.docx'): Promise<void> {
  const bytes = await generateScoutWordTemplate();
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
