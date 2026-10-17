import { CanzonierePage, SongBlock } from './canzoniere_layout';

export interface CanzonierePageRendererProps {
  page: CanzonierePage;
  isScreenPreview?: boolean;
}

export function CanzonierePageRenderer({ page, isScreenPreview = false }: CanzonierePageRendererProps) {
  const fontSize = `${page.fontSizePt}pt`;
  const arrowFontSize = `${page.arrowSizePt}pt`;

  const renderBlock = (block: SongBlock) => (
    <div key={block.id} className="canzoniere-block">
      {block.lines.map((line, idx) => {
        if (line.isRitLabel) {
          return (
            <div key={idx} className="canzoniere-rit-label" style={{ fontSize }}>
              {line.lyrics}
            </div>
          );
        }

        if (line.hasChords && !line.isChordOnly) {
          return (
            <div key={idx} className="canzoniere-line-pair">
              {/* Riga accordi sovrapposti posizionati esattamente */}
              <div className="canzoniere-chords-row" style={{ fontSize }}>
                {line.chords.map((ch, cIdx) => (
                  <span
                    key={cIdx}
                    className="canzoniere-chord-item"
                    style={{ left: `${ch.offsetPx}px` }}
                  >
                    {ch.chord}
                  </span>
                ))}
              </div>
              {/* Riga testo naturale in Roboto Regular */}
              <div className="canzoniere-lyrics-row" style={{ fontSize }}>
                {line.lyrics || '\u00A0'}
              </div>
            </div>
          );
        }

        if (line.isChordOnly) {
          return (
            <div key={idx} className="canzoniere-line-pair">
              <div className="canzoniere-chords-row" style={{ fontSize }}>
                {line.chords.map((ch, cIdx) => (
                  <span
                    key={cIdx}
                    className="canzoniere-chord-item"
                    style={{ left: `${ch.offsetPx}px` }}
                  >
                    {ch.chord}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        return (
          <div key={idx} className="canzoniere-line-pair">
            <div className="canzoniere-lyrics-row" style={{ fontSize }}>
              {line.lyrics || '\u00A0'}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`canzoniere-page print-song-page ${isScreenPreview ? 'stampa-preview-paper' : ''}`}
      style={{
        fontSize,
      }}
    >
      {/* 1. INTESTAZIONE */}
      {page.isFirstPage ? (
        <header className="canzoniere-header">
          {/* Titolo maiuscolo Roboto Bold 22 pt */}
          <h1 className="canzoniere-header-title">{page.headerTitle}</h1>

          {/* Autore o evento in corsivo Roboto Italic 11 pt */}
          {page.headerAuthor && (
            <div className="canzoniere-header-author">{page.headerAuthor}</div>
          )}

          {/* Riga parametri: Tempo, Ritmo pennata con frecce Nova Mono, Capotasto */}
          {page.headerParams && (
            <div className="canzoniere-header-params">
              {page.headerParams.misura && (
                <span>
                  <strong>Tempo:</strong> {page.headerParams.misura}
                  {page.headerParams.bpm_testo ? ` ; ${page.headerParams.bpm_testo} BPM.` : '.'}
                </span>
              )}

              {page.headerParams.ritmo && (
                <span style={{ marginLeft: '16pt' }}>
                  <strong>Ritmo pennata:</strong> {renderRitmoWithArrows(page.headerParams.ritmo, arrowFontSize)}
                </span>
              )}

              {page.headerParams.capotasto !== null && (
                <span style={{ marginLeft: '16pt' }}>
                  <strong>Capotasto:</strong> {page.headerParams.capotasto}
                </span>
              )}
            </div>
          )}

          {/* Linea orizzontale sottile sotto l'intestazione */}
          <hr className="canzoniere-header-divider" />
        </header>
      ) : (
        /* Intestazione ridotta per pagine successive */
        <header className="canzoniere-page2-header">
          <span>{page.headerTitle}</span>
          <span>{page.pageNumber}/{page.totalPages}</span>
        </header>
      )}

      {/* 2. CORPO A DUE COLONNE CON LINEA VERTICALE SEPARATRICE */}
      <div className="canzoniere-columns-container">
        {/* Colonna Sinistra */}
        <div className="canzoniere-column canzoniere-column-left">
          {page.leftColumn.blocks.map(renderBlock)}
        </div>

        {/* Colonna Destra */}
        <div className="canzoniere-column canzoniere-column-right">
          {page.rightColumn.blocks.map(renderBlock)}
        </div>
      </div>
    </div>
  );
}

/**
 * Renderizza le frecce (↓ ↑) con font Nova Mono Bold 17 pt proporzionale.
 */
function renderRitmoWithArrows(ritmoText: string, arrowFontSize: string) {
  // Trova le sequenze di frecce tra parentesi o isolate
  const parts = ritmoText.split(/([↓↑]+)/g);

  return parts.map((part, idx) => {
    if (/^[↓↑]+$/.test(part)) {
      return (
        <span key={idx} className="canzoniere-arrow-glyph" style={{ fontSize: arrowFontSize }}>
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}
