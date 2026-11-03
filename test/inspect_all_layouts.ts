import { DEFAULT_PARSED_SONGS } from '../src/data/parsed_songs';
import { layoutCanzoniereSong } from '../src/features/canti/canzoniere_layout';
import { applyRitRepeatPolicy } from '../src/lib/stampa_canzoni';

console.log('Testing all songs in suona and canta modes (with real RIT policy):');
for (const song of DEFAULT_PARSED_SONGS) {
  for (const mode of ['suona', 'canta'] as const) {
    const applied = applyRitRepeatPolicy(song, mode);
    const res = layoutCanzoniereSong(applied, { mode, layoutMode: 'riempi_pagina' });
    const hasSingleWordWrap = res.pages.some(p =>
      p.leftColumn.blocks.concat(p.rightColumn.blocks).some(b =>
        b.lines.some(l => l.hasSingleWordWrap)
      )
    );
    console.log(
      `${song.titolo} [${mode}]: pages=${res.pages.length}, cols=${res.columnsCount}, font=${res.fontSizePt}pt, fill=${(res.fillRatio*100).toFixed(1)}%, overflow=${res.hasOverflow}, tooLong=${res.hasTooLongLines}, singleWord=${hasSingleWordWrap}`
    );
  }
}
