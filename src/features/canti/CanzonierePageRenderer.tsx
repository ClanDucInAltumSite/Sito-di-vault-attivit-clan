import { CanzonierePage, SongBlock } from './canzoniere_layout';
import { CantoLineRenderer } from './CantoLineRenderer';

export interface CanzonierePageRendererProps {
  page: CanzonierePage;
  isScreenPreview?: boolean;
}

export function CanzonierePageRenderer({ page, isScreenPreview = false }: CanzonierePageRendererProps) {
  const fontSize = `${page.fontSizePt}pt`;
  const arrowFontSize = `${page.arrowSizePt}pt`;

  const renderBlock = (block: SongBlock) => {
    if (block.type === 'header' && block.header) {
      const h = block.header;
      return (
        <div key={block.id} className="canzoniere-column-header-block">
          {h.showDivider && <hr className="canzoniere-song-divider" />}
          <header className="canzoniere-header canzoniere-column-header">
            <div className="canzoniere-header-top">
              <h1 className="canzoniere-header-title">{h.title}</h1>
              {h.author && <span className="canzoniere-header-author">{h.author}</span>}
            </div>
            {h.params && (
              <div className="canzoniere-header-params">
                {h.params.misura && (
                  <span className="canzoniere-param-item">
                    <strong>Tempo:</strong> {h.params.misura}
                    {h.params.bpm_testo ? ` (${h.params.bpm_testo} BPM)` : ''}
                  </span>
                )}
                {h.mode === 'suona' && h.params.ritmo && (
                  <span className="canzoniere-param-item">
                    <strong>Ritmo:</strong> {renderRitmoWithArrows(h.params.ritmo, arrowFontSize)}
                  </span>
                )}
                {h.mode === 'suona' && h.params.capotasto !== null && (
                  <span className="canzoniere-param-item">
                    <span><strong>Capotasto:</strong> {h.params.capotasto}°</span>
                  </span>
                )}
              </div>
            )}
            <hr className="canzoniere-header-divider" />
          </header>
        </div>
      );
    }

    return (
      <div
        key={block.id}
        className={`canzoniere-block ${block.isChorus ? 'is-chorus' : ''}`}
        style={block.fontSizePt ? { fontSize: `${block.fontSizePt}pt` } : undefined}
      >
        {block.lines.map((line, idx) => (
          <CantoLineRenderer
            key={idx}
            line={{
              lyrics: line.lyrics,
              chords: line.chords,
              isRitLabel: line.isRitLabel,
              isChordOnly: line.isChordOnly,
              hasChords: line.hasChords,
            }}
            fontSize={block.fontSizePt ? `${block.fontSizePt}pt` : fontSize}
            isPrint={true}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      className={`canzoniere-page print-song-page ${isScreenPreview ? 'stampa-preview-paper' : ''}`}
      style={{
        fontSize,
      }}
    >
      {/* 1. TESTATINA DI SEZIONE O INTESTAZIONE SINGOLO CANTO */}
      {page.isContinuousFlow ? (
        page.sectionTitle ? (
          <header className="canzoniere-running-header">
            <span className="canzoniere-running-title">{page.sectionTitle}</span>
          </header>
        ) : null
      ) : page.isFirstPage ? (
        <header className="canzoniere-header">
          <div className="canzoniere-header-top">
            <h1 className="canzoniere-header-title">{page.headerTitle}</h1>
            {page.headerAuthor && (
              <span className="canzoniere-header-author">{page.headerAuthor}</span>
            )}
          </div>
          {page.headerParams && (
            <div className="canzoniere-header-params">
              {page.headerParams.misura && (
                <span className="canzoniere-param-item">
                  <strong>Tempo:</strong> {page.headerParams.misura}
                  {page.headerParams.bpm_testo ? ` (${page.headerParams.bpm_testo} BPM)` : ''}
                </span>
              )}
              {page.headerParams.ritmo && (
                <span className="canzoniere-param-item">
                  <strong>Ritmo:</strong> {renderRitmoWithArrows(page.headerParams.ritmo, arrowFontSize)}
                </span>
              )}
              {page.headerParams.capotasto !== null && (
                <span className="canzoniere-param-item">
                  <span><strong>Capotasto:</strong> {page.headerParams.capotasto}°</span>
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

      {/* 2. CORPO A COLONNA SINGOLA O DUE COLONNE */}
      <div
        className={`canzoniere-columns-container ${
          page.columnsCount === 1 ? 'is-single-column' : 'is-two-columns'
        } ${page.columnsCount === 1 && page.fillRatio < 0.88 ? 'is-centered-vertically' : ''}`}
      >
        {/* Colonna Sinistra / Singola a larghezza piena */}
        <div
          className={`canzoniere-column ${
            page.columnsCount === 1 ? 'canzoniere-column-single' : 'canzoniere-column-left'
          }`}
        >
          {page.leftColumn.blocks.map(renderBlock)}
        </div>

        {/* Colonna Destra (solo in modalità a due colonne) */}
        {page.columnsCount !== 1 && (
          <div className="canzoniere-column canzoniere-column-right">
            {page.rightColumn.blocks.map(renderBlock)}
          </div>
        )}
      </div>

      {/* 3. NUMERAZIONE DI PAGINA GLOBALE DEL CANZONIERE */}
      {page.bookPageNumber !== undefined && (
        <footer className="canzoniere-page-footer">
          <span className="canzoniere-page-number">— {page.bookPageNumber} —</span>
        </footer>
      )}
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
