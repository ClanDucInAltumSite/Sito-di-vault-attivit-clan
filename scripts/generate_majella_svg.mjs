import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fromFile } from 'geotiff';
import { contours } from 'd3-contour';

// Coordinate Bounding Box della Majella (Monte Amaro e Rava del Ferro centrati)
const BBOX = {
  lonMin: 14.005,
  lonMax: 14.195,
  latMin: 42.060,
  latMax: 42.120,
};

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 480;

function geoToSvg(lat, lon) {
  const x = ((lon - BBOX.lonMin) / (BBOX.lonMax - BBOX.lonMin)) * SVG_WIDTH;
  const y = ((BBOX.latMax - lat) / (BBOX.latMax - BBOX.latMin)) * SVG_HEIGHT;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

// 7 Etichette Ufficiali Verificate con Fonti Attendibili (CAI, Parco Nazionale Majella, IGM, CTR)
export const VERIFIED_POINTS = [
  {
    id: 'monte_amaro',
    name: 'Monte Amaro',
    quota: 2793,
    lat: 42.086307,
    lon: 14.085878,
    type: 'vetta_principale',
    marker: 'triangle',
    highlight: true, // punto giallo di tappa scout
    description: 'Vetta principale del massiccio della Majella (seconda cima degli Appennini)',
    sources: [
      'CAI Sez. Pescara / CAI Sulmona - Carta dei Sentieri 1:25.000',
      'Parco Nazionale della Majella - Toponimi e Rete Sentieristica Ufficiale',
      'IGM Foglio 147 IV NO "Monte Amaro"',
    ],
  },
  {
    id: 'rava_del_ferro',
    name: 'Rava del Ferro',
    quota: 2100, // quota mediana canalone (sale da 1600m a 2500m)
    lat: 42.0915,
    lon: 14.0725,
    type: 'canalone',
    marker: 'line_label',
    rotate: -32,
    description: 'Canalone glaciale sul versante ovest risalito dal celebre sentiero alpinistico CAI B5',
    sources: [
      'CAI Pescara - Itinerario e relazione tecnica Sentiero B5',
      'Parco Nazionale della Majella - Catasto Sentieri',
      'Guida Monti d\'Italia CAI-TCI "Appennino Centrale"',
    ],
  },
  {
    id: 'bivacco_pelino',
    name: 'Bivacco Pelino',
    quota: 2790,
    lat: 42.0868,
    lon: 14.0872,
    type: 'bivacco',
    marker: 'dot',
    description: 'Bivacco geodetico ad igloo rosso posizionato in vetta a Monte Amaro dal CAI Sulmona (1966)',
    sources: [
      'CAI Sulmona - Ente gestore Bivacco Cesare Mario Pelino',
      'Parco Nazionale della Majella - Rete Rifugi e Bivacchi',
    ],
  },
  {
    id: 'monte_focalone',
    name: 'Monte Focalone',
    quota: 2676,
    lat: 42.1072,
    lon: 14.1150,
    type: 'vetta',
    marker: 'triangle',
    description: 'Imponente vetta settentrionale della dorsale principale',
    sources: [
      'Parco Nazionale della Majella - Carta Escursionistica 1:25.000',
      'IGM Foglio 147 IV NE',
    ],
  },
  {
    id: 'monte_acquaviva',
    name: 'Monte Acquaviva',
    quota: 2737,
    lat: 42.1033,
    lon: 14.1211,
    type: 'vetta',
    marker: 'triangle',
    description: 'Seconda elevazione del massiccio della Majella',
    sources: [
      'CAI Chieti - Relazioni creste d\'alta quota',
      'CTR Regione Abruzzo 1:10.000',
    ],
  },
  {
    id: 'passo_san_leonardo',
    name: 'Passo San Leonardo',
    quota: 1282,
    lat: 42.0736,
    lon: 14.0303,
    type: 'passo',
    marker: 'dot',
    description: 'Valico storico tra Pacentro e Sant\'Eufemia a Maiella',
    sources: [
      'Parco Nazionale della Majella - Valichi e accessi',
      'IGM Foglio 146 I NE',
    ],
  },
  {
    id: 'lama_bianca',
    name: 'Lama Bianca',
    quota: 1500,
    lat: 42.1003,
    lon: 14.0594,
    type: 'base_sentiero',
    marker: 'dot',
    description: 'Riserva naturale statale e punto di partenza dell\'itinerario CAI B5 verso la Rava del Ferro',
    sources: [
      'Carabinieri Biodiversità Pescara - Riserva Naturale Statale Lama Bianca',
      'CAI Pescara - Punto di partenza sentiero B5',
    ],
  },
];

// Tracciato GPX del Sentiero CAI B5 (Lama Bianca -> Rava del Ferro -> Monte Amaro)
export const SENTIERO_B5_WAYPOINTS = [
  { lat: 42.1003, lon: 14.0594, elev: 1496 }, // Lama Bianca
  { lat: 42.0965, lon: 14.0635, elev: 1560 },
  { lat: 42.0932, lon: 14.0674, elev: 1606 }, // Attacco Rava
  { lat: 42.0920, lon: 14.0710, elev: 1950 }, // Canalone
  { lat: 42.0905, lon: 14.0755, elev: 2280 }, // Salita ghiaione
  { lat: 42.0890, lon: 14.0790, elev: 2450 }, // Uscita cresta
  { lat: 42.0875, lon: 14.0825, elev: 2680 },
  { lat: 42.086307, lon: 14.085878, elev: 2793 }, // Vetta Monte Amaro
];

// Algoritmo di Semplificazione Douglas-Peucker
function sqDistToSegment(p, p1, p2) {
  let x = p1[0], y = p1[1];
  let dx = p2[0] - x, dy = p2[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = p2[0]; y = p2[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplifyDouglasPeucker(points, sqTolerance) {
  if (points.length <= 2) return points;
  let maxSqDist = 0, index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const sqd = sqDistToSegment(points[i], points[0], points[last]);
    if (sqd > maxSqDist) {
      maxSqDist = sqd;
      index = i;
    }
  }
  if (maxSqDist > sqTolerance) {
    const left = simplifyDouglasPeucker(points.slice(0, index + 1), sqTolerance);
    const right = simplifyDouglasPeucker(points.slice(index), sqTolerance);
    return left.slice(0, left.length - 1).concat(right);
  }
  return [points[0], points[last]];
}

async function getDemData() {
  const refDir = path.resolve('_riferimenti');
  if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });
  const tifPath = path.join(refDir, 'copernicus_N42_E014.tif');

  if (!fs.existsSync(tifPath)) {
    console.log('[DEM] Scaricamento del tile Copernicus GLO-30 N42 E014...');
    const url = 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N42_00_E014_00_DEM/Copernicus_DSM_COG_10_N42_00_E014_00_DEM.tif';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Download DEM fallito: ' + res.status);
    const buf = await res.arrayBuffer();
    fs.writeFileSync(tifPath, Buffer.from(buf));
    console.log('[DEM] Salvato in', tifPath, '(', buf.byteLength, 'bytes)');
  }

  const tiff = await fromFile(tifPath);
  const image = await tiff.getImage();

  const x0 = Math.round((BBOX.lonMin - 14) * 3600);
  const x1 = Math.round((BBOX.lonMax - 14) * 3600);
  const y0 = Math.round((43 - BBOX.latMax) * 3600);
  const y1 = Math.round((43 - BBOX.latMin) * 3600);

  const w = x1 - x0;
  const h = y1 - y0;

  const rasters = await image.readRasters({ window: [x0, y0, x1, y1] });
  return { data: rasters[0], w, h };
}

function isBorderSegment(p1, p2) {
  const margin = 2.0;
  // Bordo inferiore
  if (p1[1] >= SVG_HEIGHT - margin && p2[1] >= SVG_HEIGHT - margin) return true;
  // Bordo superiore
  if (p1[1] <= margin && p2[1] <= margin) return true;
  // Bordo sinistro
  if (p1[0] <= margin && p2[0] <= margin) return true;
  // Bordo destro
  if (p1[0] >= SVG_WIDTH - margin && p2[0] >= SVG_WIDTH - margin) return true;
  return false;
}

function splitRingIntoChains(mapped) {
  const chains = [];
  let currentChain = [];

  for (let i = 0; i < mapped.length - 1; i++) {
    const p1 = mapped[i];
    const p2 = mapped[i + 1];

    if (isBorderSegment(p1, p2)) {
      if (currentChain.length >= 2) {
        chains.push(currentChain);
      }
      currentChain = [];
    } else {
      if (currentChain.length === 0) {
        currentChain.push(p1);
      }
      currentChain.push(p2);
    }
  }

  if (currentChain.length >= 2) {
    chains.push(currentChain);
  }

  if (chains.length > 1) {
    const first = chains[0];
    const last = chains[chains.length - 1];
    if (
      first[0][0] === last[last.length - 1][0] &&
      first[0][1] === last[last.length - 1][1]
    ) {
      chains[chains.length - 1] = last.concat(first.slice(1));
      chains.shift();
    }
  }

  return chains;
}

export async function generateMajellaSvg() {
  console.log('[MAJELLA] Avvio calcolo curve di livello dal DEM reale...');
  const { data, w, h } = await getDemData();

  // Curve maestre: ogni 200m
  const majorLevels = [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2750];
  // Curve intermedie: ogni 100m interposta
  const interLevels = [1100, 1300, 1500, 1700, 1900, 2100, 2300, 2500, 2700];

  const allLevels = [...majorLevels, ...interLevels].sort((a, b) => a - b);
  const c = contours().size([w, h]).thresholds(allLevels);
  const results = c(data);

  // Semplificazione DP con epsilon 0.95px su tela 1200x480
  const sqTol = 0.95 * 0.95;

  // Ripartizione delle isoipse in 3 gruppi di animazione respiratoria fluida
  const animGroups = { 1: [], 2: [], 3: [] };

  for (let idx = 0; idx < results.length; idx++) {
    const item = results[idx];
    const isMajor = majorLevels.includes(item.value);
    const cls = isMajor ? 'topo-line topo-line-major' : 'topo-line';
    const animId = (idx % 3) + 1;

    for (const poly of item.coordinates) {
      for (const ring of poly) {
        if (ring.length < 6) continue;
        const mapped = ring.map(([rx, ry]) => [
          Number(((rx / w) * SVG_WIDTH).toFixed(1)),
          Number(((ry / h) * SVG_HEIGHT).toFixed(1)),
        ]);
        const chains = splitRingIntoChains(mapped);

        for (const ch of chains) {
          const simp = simplifyDouglasPeucker(ch, sqTol);
          if (simp.length < 2) continue;

          const isClosed =
            simp[0][0] === simp[simp.length - 1][0] &&
            simp[0][1] === simp[simp.length - 1][1];
          const d =
            'M' + simp.map((p) => `${p[0]},${p[1]}`).join('L') + (isClosed ? 'Z' : '');

          animGroups[animId].push({
            d,
            cls,
            elev: item.value,
            isMajor,
          });
        }
      }
    }
  }

  // Costruzione tracciato sentiero CAI B5
  const b5SvgPoints = SENTIERO_B5_WAYPOINTS.map((wpt) => geoToSvg(wpt.lat, wpt.lon));
  const b5PathD = 'M' + b5SvgPoints.map((p) => `${p[0]},${p[1]}`).join('L');

  // Posizionamento delle 7 etichette con coordinate SVG
  const labelsSvg = VERIFIED_POINTS.map((pt) => {
    const [sx, sy] = geoToSvg(pt.lat, pt.lon);
    return {
      ...pt,
      svgX: sx,
      svgY: sy,
    };
  });

  // Assemblaggio SVG con proporzioni reali 1:1 e preserveAspectRatio responsive
  let svg = `<svg viewBox="0 0 1200 480" fill="none" xmlns="http://www.w3.org/2000/svg" class="topo-contour-svg" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Carta topografica della Majella e Monte Amaro">\n`;

  // Definizioni pattern
  svg += `  <defs>\n`;
  svg += `    <pattern id="topoHachure" width="16" height="8" patternUnits="userSpaceOnUse">\n`;
  svg += `      <line x1="8" y1="0" x2="8" y2="4" stroke="var(--color-ink)" stroke-width="0.8" opacity="0.15" />\n`;
  svg += `    </pattern>\n`;
  svg += `  </defs>\n\n`;

  // Gruppo 1
  svg += `  <!-- GRUPPO 1: ISOIPSE MAJELLA -->\n`;
  svg += `  <g class="topo-contour-anim-1">\n`;
  for (const item of animGroups[1]) {
    svg += `    <path d="${item.d}" class="${item.cls}" data-elevation="${item.elev}" />\n`;
  }
  svg += `  </g>\n\n`;

  // Gruppo 2
  svg += `  <!-- GRUPPO 2: ISOIPSE MAJELLA -->\n`;
  svg += `  <g class="topo-contour-anim-2">\n`;
  for (const item of animGroups[2]) {
    svg += `    <path d="${item.d}" class="${item.cls}" data-elevation="${item.elev}" />\n`;
  }
  svg += `  </g>\n\n`;

  // Gruppo 3
  svg += `  <!-- GRUPPO 3: ISOIPSE MAJELLA -->\n`;
  svg += `  <g class="topo-contour-anim-3">\n`;
  for (const item of animGroups[3]) {
    svg += `    <path d="${item.d}" class="${item.cls}" data-elevation="${item.elev}" />\n`;
  }
  svg += `  </g>\n\n`;

  // Sentiero CAI B5 attraverso la Rava del Ferro verso Monte Amaro
  svg += `  <!-- SENTIERO CAI B5: LAMA BIANCA -> RAVA DEL FERRO -> MONTE AMARO -->\n`;
  svg += `  <g class="topo-contour-anim-1">\n`;
  svg += `    <path d="${b5PathD}" class="topo-line topo-line-accent" />\n`;
  svg += `  </g>\n\n`;

  // Etichette Ufficiali Verificate (massimo 7)
  svg += `  <!-- ETICHETTE CARTOGRAFICHE UFFICIALI MAJELLA (7 PUNTI VERIFICATI) -->\n`;
  svg += `  <g class="topo-labels-layer">\n`;

  for (const lbl of labelsSvg) {
    if (lbl.id === 'monte_amaro') {
      // Vetta Monte Amaro: marcatore triangolo + punto tappa giallo
      svg += `    <!-- Monte Amaro 2793m (Vetta Principale & Tappa) -->\n`;
      svg += `    <g transform="translate(${lbl.svgX}, ${lbl.svgY})">\n`;
      // Punto giallo di tappa scout
      svg += `      <circle cx="0" cy="0" r="5" fill="var(--color-giochi, #facc15)" stroke="var(--color-ink)" stroke-width="1.2" opacity="0.85" />\n`;
      svg += `      <polygon points="0,-11 -5,-3 5,-3" fill="var(--color-ink)" opacity="0.6" />\n`;
      svg += `      <text x="8" y="-4" fill="var(--color-ink)" class="topo-elevation-text topo-peak-title">▲ Monte Amaro 2793 m</text>\n`;
      svg += `    </g>\n`;
    } else if (lbl.id === 'rava_del_ferro') {
      // Canalone Rava del Ferro: etichetta orientata lungo l'ascesa
      svg += `    <!-- Rava del Ferro (Canalone di Salita) -->\n`;
      svg += `    <g transform="translate(${lbl.svgX}, ${lbl.svgY}) rotate(${lbl.rotate})">\n`;
      svg += `      <text x="0" y="-3" fill="var(--color-ink)" class="topo-elevation-text topo-couloir-label">Rava del Ferro</text>\n`;
      svg += `    </g>\n`;
    } else if (lbl.id === 'bivacco_pelino') {
      // Bivacco Pelino: cupola igloo in vetta (offset verso il basso per non sovrapporsi a Monte Amaro)
      svg += `    <!-- Bivacco Pelino -->\n`;
      svg += `    <g transform="translate(${lbl.svgX}, ${lbl.svgY})">\n`;
      svg += `      <circle cx="0" cy="0" r="2.5" fill="var(--color-ink)" opacity="0.4" />\n`;
      svg += `      <text x="6" y="11" fill="var(--color-ink)" class="topo-elevation-text">Biv. Pelino 2790 m</text>\n`;
      svg += `    </g>\n`;
    } else if (lbl.id === 'monte_focalone') {
      svg += `    <!-- Monte Focalone (2676m) -->\n`;
      svg += `    <g transform="translate(${lbl.svgX}, ${lbl.svgY})">\n`;
      svg += `      <polygon points="0,-8 -4,-1 4,-1" fill="var(--color-ink)" opacity="0.4" />\n`;
      svg += `      <text x="7" y="-4" fill="var(--color-ink)" class="topo-elevation-text">▲ ${lbl.name} ${lbl.quota} m</text>\n`;
      svg += `    </g>\n`;
    } else if (lbl.id === 'monte_acquaviva') {
      svg += `    <!-- Monte Acquaviva (2737m) -->\n`;
      svg += `    <g transform="translate(${lbl.svgX}, ${lbl.svgY})">\n`;
      svg += `      <polygon points="0,-8 -4,-1 4,-1" fill="var(--color-ink)" opacity="0.4" />\n`;
      svg += `      <text x="7" y="10" fill="var(--color-ink)" class="topo-elevation-text">▲ ${lbl.name} ${lbl.quota} m</text>\n`;
      svg += `    </g>\n`;
    } else if (lbl.marker === 'triangle') {
      // Altre Vette
      svg += `    <!-- ${lbl.name} (${lbl.quota}m) -->\n`;
      svg += `    <g transform="translate(${lbl.svgX}, ${lbl.svgY})">\n`;
      svg += `      <polygon points="0,-8 -4,-1 4,-1" fill="var(--color-ink)" opacity="0.4" />\n`;
      svg += `      <text x="7" y="0" fill="var(--color-ink)" class="topo-elevation-text">▲ ${lbl.name} ${lbl.quota} m</text>\n`;
      svg += `    </g>\n`;
    } else {
      // Passi / Luoghi (Passo San Leonardo, Lama Bianca)
      svg += `    <!-- ${lbl.name} (${lbl.quota}m) -->\n`;
      svg += `    <g transform="translate(${lbl.svgX}, ${lbl.svgY})">\n`;
      svg += `      <circle cx="0" cy="0" r="2.5" fill="var(--color-ink)" opacity="0.35" />\n`;
      svg += `      <text x="6" y="3" fill="var(--color-ink)" class="topo-elevation-text">• ${lbl.name} ${lbl.quota} m</text>\n`;
      svg += `    </g>\n`;
    }
  }

  svg += `  </g>\n`;
  svg += `</svg>\n`;

  // Salvataggio output
  const publicDir = path.resolve('public/assets');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const svgOutPath = path.join(publicDir, 'topo_majella.svg');
  fs.writeFileSync(svgOutPath, svg, 'utf8');

  // Salvataggio dati JSON per verifica test
  const uiDir = path.resolve('src/ui');
  const jsonOutPath = path.join(uiDir, 'topo_majella_data.json');
  fs.writeFileSync(
    jsonOutPath,
    JSON.stringify(
      {
        dataset: 'Copernicus GLO-30 Digital Elevation Model (European Space Agency / European Union)',
        license: 'Copernicus Open Access Policy / Free and open public licence',
        retrievalDate: '2026-10-18',
        bbox: BBOX,
        svgDimensions: { width: SVG_WIDTH, height: SVG_HEIGHT },
        points: labelsSvg,
      },
      null,
      2
    ),
    'utf8'
  );

  // Generazione del componente TSX con JSX puro (zero dangerouslySetInnerHTML per conformità contratti di sicurezza)
  let jsxSvg = svg
    .replace(/<!--[\s\S]*?-->\n?/g, '')
    .replace(/class="/g, 'className="')
    .replace(/stroke-width="/g, 'strokeWidth="')
    .replace(/patternUnits="/g, 'patternUnits="')
    .replace(/stroke-dasharray="/g, 'strokeDasharray="');

  const tsxOutPath = path.join(uiDir, 'TopographicBackground.tsx');
  const tsxContent = `import { useEffect, useRef } from 'preact/hooks';

export interface TopographicBackgroundProps {
  className?: string;
}

/**
 * Sfondo Topografico Ambientale Globale — Massiccio della Majella
 * Generato automaticamente dal Modello Digitale del Terreno Copernicus GLO-30 reale.
 * Vetta principale: Monte Amaro (2793 m) e canalone della Rava del Ferro.
 * 
 * Aggiornamento scroll ad alte prestazioni: trasformazione diretta sul nodo DOM (zero re-render).
 * Sicurezza: elementi JSX nativi dichiarativi compilati.
 */
export function TopographicBackground({ className = '' }: TopographicBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    let ticking = false;

    const updateParallax = () => {
      if (!ticking) {
        rafId.current = window.requestAnimationFrame(() => {
          if (containerRef.current) {
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
            const isMobile = window.innerWidth <= 768;
            const maxOffset = isMobile ? -45 : -75;
            const parallaxOffset = Math.round(progress * maxOffset);
            containerRef.current.style.transform = \`translate3d(0, \${parallaxOffset}px, 0)\`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', updateParallax, { passive: true });
    window.addEventListener('resize', updateParallax, { passive: true });
    window.addEventListener('hashchange', updateParallax, { passive: true });
    updateParallax();

    return () => {
      window.removeEventListener('scroll', updateParallax);
      window.removeEventListener('resize', updateParallax);
      window.removeEventListener('hashchange', updateParallax);
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return (
    <div
      className={\`topo-contour-wrapper \${className}\`.trim()}
      aria-hidden="true"
      role="presentation"
    >
      {/* Diffusione di luce ambientale morbida e trasparente */}
      <div className="topo-ambient-glow" />

      {/* Rete vettoriale reale della Majella con parallasse diretta su ref */}
      <div ref={containerRef} className="topo-svg-container">
        ${jsxSvg}
      </div>
    </div>
  );
}
`;
  fs.writeFileSync(tsxOutPath, tsxContent, 'utf8');

  const rawSize = Buffer.byteLength(svg, 'utf8');
  const gzSize = zlib.gzipSync(Buffer.from(svg)).byteLength;

  console.log(`[MAJELLA] Generato con successo:`);
  console.log(`  - File SVG: ${svgOutPath}`);
  console.log(`  - Dimensione grezza: ${(rawSize / 1024).toFixed(1)} KB`);
  console.log(`  - Dimensione GZIP: ${(gzSize / 1024).toFixed(1)} KB (limite massimo: 40 KB)`);
  console.log(`  - Dati JSON: ${jsonOutPath}`);

  return { svg, rawSize, gzSize, labelsSvg };
}

// Esecuzione se lanciato come script
if (process.argv[1]?.endsWith('generate_majella_svg.mjs')) {
  generateMajellaSvg().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
