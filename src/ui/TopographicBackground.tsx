import { useState, useEffect, useRef } from 'preact/hooks';

export interface TopographicBackgroundProps {
  className?: string;
}

/**
 * Sfondo Topografico Cartografico Interattivo (Curve di Livello IGM con Discesa Altimetrica)
 * Ispirato alle carte topografiche escursionistiche 1:25.000 dei Monti Sibillini e Appennino Umbro.
 * 
 * Caratteristiche:
 * - Vere curve di livello con isoipse concentriche chiuse (vette), selle e valloni a V.
 * - Discesa altimetrica dinamica con lo scroll: dalla Vetta (1000 m) al Campo Base (0 m).
 * - Parallasse fluido leggero e movimento a respiro naturale (zero layout shift, sole transform).
 * - Trasparenza delicata ad alto contrasto per non distrarre dal testo principale.
 */
export function TopographicBackground({ className = '' }: TopographicBackgroundProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const updateScroll = () => {
      if (rafId.current !== null) return;
      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
        setScrollProgress(progress);
      });
    };

    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll, { passive: true });
    window.addEventListener('hashchange', updateScroll, { passive: true });
    updateScroll();

    return () => {
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
      window.removeEventListener('hashchange', updateScroll);
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Quota dinamica da 1000m (in cima alla pagina) a 0m (in fondo alla pagina)
  const quota = Math.max(0, Math.round((1 - scrollProgress) * 1000));

  // Tappa geografica corrispondente all'altitudine
  let stageName = 'Vetta';
  if (quota <= 50) stageName = 'Campo Base';
  else if (quota <= 280) stageName = 'Fondovalle';
  else if (quota <= 550) stageName = 'Sella';
  else if (quota <= 820) stageName = 'Costone';

  // Parallasse di discesa: sposta le curve verso l'alto man mano che si scende
  const parallaxOffset = Math.round(scrollProgress * -90);

  return (
    <div
      className={`topo-contour-wrapper ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
    >
      {/* Diffusione di luce ambientale morbida e trasparente */}
      <div className="topo-ambient-glow" />

      {/* Rete vettoriale delle curve di livello topografiche con parallasse */}
      <div
        className="topo-svg-container"
        style={{ transform: `translate3d(0, ${parallaxOffset}px, 0)` }}
      >
        <svg
          viewBox="0 0 1200 480"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="topo-contour-svg"
          preserveAspectRatio="none"
        >
          {/* DEFINIZIONE TRATTEGGI E TRATTINI DI PENDENZA CARTOGRAFICI */}
          <defs>
            <pattern id="topoHachure" width="16" height="8" patternUnits="userSpaceOnUse">
              <line x1="8" y1="0" x2="8" y2="4" stroke="var(--color-ink)" strokeWidth="0.8" opacity="0.15" />
            </pattern>
          </defs>

          {/* === 1. VETTA OVEST (MONTE SUBASIO / SIBILLINI) - CURVE CONCENTRICHE CHIUSE === */}
          {/* Vetta 1000m (Ovale sommitale con punto quotato) */}
          <g className="topo-contour-anim-1">
            <ellipse cx="280" cy="70" rx="42" ry="22" className="topo-line topo-line-major" />
            <polygon points="278,68 280,64 282,68" fill="var(--color-ink)" opacity="0.3" />
            <text x="290" y="73" fill="var(--color-ink)" className="topo-elevation-text">
              ▲ 1000 m
            </text>
          </g>

          {/* Isoipsa 950m */}
          <g className="topo-contour-anim-2">
            <path
              d="M 215 70 C 215 38, 345 38, 345 70 C 345 102, 215 102, 215 70 Z"
              className="topo-line"
            />
          </g>

          {/* Isoipsa 900m */}
          <g className="topo-contour-anim-3">
            <path
              d="M 180 70 C 180 25, 380 25, 380 70 C 380 115, 180 115, 180 70 Z"
              className="topo-line"
            />
          </g>

          {/* Isoipsa 850m */}
          <g className="topo-contour-anim-1">
            <path
              d="M 145 70 C 145 12, 415 12, 425 70 C 435 128, 145 128, 145 70 Z"
              className="topo-line"
            />
          </g>

          {/* === 2. CRESTA EST (ANTICIMA) - CURVE CONCENTRICHE CHIUSE === */}
          <g className="topo-contour-anim-2">
            <ellipse cx="880" cy="95" rx="55" ry="26" className="topo-line topo-line-major" />
            <text x="890" y="98" fill="var(--color-ink)" className="topo-elevation-text">
              ▲ 920 m
            </text>
          </g>
          <g className="topo-contour-anim-3">
            <path
              d="M 795 95 C 795 55, 965 55, 965 95 C 965 135, 795 135, 795 95 Z"
              className="topo-line"
            />
          </g>

          {/* === 3. ISOIPSE DI RACCORDO, SELLA (VALICO) E COSTONE === */}
          {/* Isoipsa 800m */}
          <g className="topo-contour-anim-1">
            <path
              d="M -40 120 C 120 70, 180 50, 280 42 C 400 32, 470 120, 580 120 C 690 120, 750 50, 880 50 C 1010 50, 1100 90, 1240 120"
              className="topo-line"
            />
          </g>

          {/* Isoipsa Direttrice 750m (Marcata con quota) */}
          <g className="topo-contour-anim-2">
            <path
              d="M -40 160 C 130 110, 200 80, 310 70 C 420 60, 480 155, 600 155 C 720 155, 770 80, 900 80 C 1030 80, 1110 130, 1240 160"
              className="topo-line topo-line-major"
            />
            <text x="90" y="145" fill="var(--color-ink)" className="topo-elevation-text">
              750 m
            </text>
            <text x="960" y="115" fill="var(--color-ink)" className="topo-elevation-text">
              750 m
            </text>
          </g>

          {/* Isoipsa 700m */}
          <g className="topo-contour-anim-3">
            <path
              d="M -40 195 C 145 145, 220 115, 330 105 C 440 95, 490 190, 620 190 C 740 190, 790 115, 920 115 C 1050 115, 1125 165, 1240 195"
              className="topo-line"
            />
          </g>

          {/* Isoipsa 650m */}
          <g className="topo-contour-anim-1">
            <path
              d="M -40 230 C 160 180, 240 150, 350 140 C 460 130, 500 225, 640 225 C 760 225, 810 150, 940 150 C 1070 150, 1140 200, 1240 230"
              className="topo-line"
            />
          </g>

          {/* Isoipsa 600m */}
          <g className="topo-contour-anim-2">
            <path
              d="M -40 265 C 175 215, 260 185, 370 175 C 480 165, 515 260, 660 260 C 785 260, 830 185, 960 185 C 1090 185, 1155 235, 1240 265"
              className="topo-line"
            />
          </g>

          {/* Isoipsa Direttrice 500m (Valico / Sella) */}
          <g className="topo-contour-anim-3">
            <path
              d="M -40 300 C 190 250, 280 220, 390 210 C 500 200, 530 295, 680 295 C 810 295, 850 220, 980 220 C 1110 220, 1170 270, 1240 300"
              className="topo-line topo-line-major"
            />
            <text x="160" y="280" fill="var(--color-ink)" className="topo-elevation-text">
              500 m • Valico
            </text>
            <text x="1005" y="248" fill="var(--color-ink)" className="topo-elevation-text">
              500 m
            </text>
          </g>

          {/* Isoipsa 400m */}
          <g className="topo-contour-anim-1">
            <path
              d="M -40 335 C 210 285, 300 255, 410 245 C 520 235, 550 330, 700 330 C 830 330, 870 255, 1000 255 C 1130 255, 1185 305, 1240 335"
              className="topo-line"
            />
          </g>

          {/* Isoipsa 300m */}
          <g className="topo-contour-anim-2">
            <path
              d="M -40 370 C 230 320, 320 290, 430 280 C 540 270, 570 365, 720 365 C 850 365, 890 290, 1020 290 C 1150 290, 1200 340, 1240 370"
              className="topo-line"
            />
          </g>

          {/* Isoipsa Direttrice 250m (Colle) */}
          <g className="topo-contour-anim-3">
            <path
              d="M -40 405 C 250 355, 340 325, 450 315 C 560 305, 590 400, 740 400 C 870 400, 910 325, 1040 325 C 1170 325, 1215 375, 1240 405"
              className="topo-line topo-line-major"
            />
            <text x="210" y="385" fill="var(--color-ink)" className="topo-elevation-text">
              250 m
            </text>
            <text x="1045" y="352" fill="var(--color-ink)" className="topo-elevation-text">
              250 m
            </text>
          </g>

          {/* Isoipsa 100m */}
          <g className="topo-contour-anim-1">
            <path
              d="M -40 440 C 270 390, 360 360, 470 350 C 580 340, 610 435, 760 435 C 890 435, 930 360, 1060 360 C 1190 360, 1225 410, 1240 440"
              className="topo-line"
            />
          </g>

          {/* === 4. ISOIPSA 0 M (FONDOVALLE / CAMPO BASE) === */}
          <g className="topo-contour-anim-2">
            <path
              d="M -40 475 C 290 425, 380 395, 490 385 C 600 375, 630 470, 780 470 C 910 470, 950 395, 1080 395 C 1200 395, 1235 445, 1240 475"
              className="topo-line topo-line-major"
            />
            <text x="270" y="450" fill="var(--color-ink)" className="topo-elevation-text">
              0 m • Campo Base
            </text>
            <text x="1080" y="420" fill="var(--color-ink)" className="topo-elevation-text">
              0 m • Fondovalle
            </text>
          </g>

          {/* === 5. SENTIERO SCOUT ESCURSIONISTICO (TRATTO GIALLO TRATTEGGIATO) === */}
          <g className="topo-contour-anim-1">
            <path
              d="M 280 70 Q 360 110, 420 150 T 560 190 T 640 280 T 720 370 T 780 470"
              className="topo-line topo-line-accent"
            />
          </g>
        </svg>
      </div>

      {/* Altimetro cartografico discreto in filigrana nell'angolo inferiore */}
      <div className="topo-altimeter" aria-hidden="true">
        <span className="topo-altimeter-pin">▲</span>
        <span className="topo-altimeter-val tabular-nums">{quota} m</span>
        <span className="topo-altimeter-stage">{stageName}</span>
      </div>
    </div>
  );
}
