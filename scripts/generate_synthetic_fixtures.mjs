// scripts/generate_synthetic_fixtures.mjs
// Genera le fixture sintetiche per i test golden in test/fixtures/synthetic/

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const FIXTURES_DIR = path.join(process.cwd(), 'test', 'fixtures', 'synthetic');
fs.mkdirSync(FIXTURES_DIR, { recursive: true });

async function generateDocxFixture() {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>CANTO SINTETICO DEI SENTIERI</w:t></w:r></w:p>
    <w:p><w:r><w:t>Autore: Autore Sintetico Test</w:t></w:r></w:p>
    <w:p><w:r><w:t>Tonalita: Sol - Misura: 4/4 - Categoria: scout</w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t>Sol                    Re</w:t></w:r></w:p>
    <w:p><w:r><w:t>Camminiamo sui sentieri della valle aperta,</w:t></w:r></w:p>
    <w:p><w:r><w:t>Do                    Sol</w:t></w:r></w:p>
    <w:p><w:r><w:t>sotto il cielo terso della primavera.</w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t>RIT.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Do          Re        Sol</w:t></w:r></w:p>
    <w:p><w:r><w:t>Sempre uniti verso l'orizzonte,</w:t></w:r></w:p>
    <w:p><w:r><w:t>Do          Re        Sol</w:t></w:r></w:p>
    <w:p><w:r><w:t>la nostra traccia segna la montagna.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', docXml);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const outPath = path.join(FIXTURES_DIR, 'canto_sintetico.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Generato DOCX sintetico: ${outPath} (${buffer.length} bytes)`);
}

function copyPdfFixture() {
  const sourcePdf = path.join(process.cwd(), 'docs', 'design-review', 'print', 'fase9b_canto_verification.pdf');
  const targetPdf = path.join(FIXTURES_DIR, 'canto_sintetico_stampato.pdf');

  if (fs.existsSync(sourcePdf)) {
    fs.copyFileSync(sourcePdf, targetPdf);
    console.log(`Copiato PDF sintetico stampato: ${targetPdf}`);
  }
}

async function main() {
  await generateDocxFixture();
  copyPdfFixture();
}

main().catch(console.error);
