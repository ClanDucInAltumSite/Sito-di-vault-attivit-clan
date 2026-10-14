export interface TopographicBackgroundProps {
  className?: string;
}

/**
 * Sfondo Topografico Ambientale Globale (Isoipse Cartografiche Vettoriali)
 * Ispirato alle carte topografiche escursionistiche IGM 1:25.000.
 * - Posizionato in modo fisso sul fondo del viewport, dietro a tutti i contenuti.
 * - Diffusione radiale dell'inchiostro del marchio che elimina la sensazione di "piatto/vuoto".
 * - Curve di livello vettoriali che respirano lentamente con animazioni GPU-accelerate.
 * - Nessun layout shift, nessuna interferenza con il tocco o lo scroll (pointer-events: none).
 */
export function TopographicBackground({ className = '' }: TopographicBackgroundProps) {
  return (
    <div
      className={`topo-contour-wrapper ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
    >
      {/* Alone di luce e profondità ambientale in tinta con la palette */}
      <div className="topo-ambient-glow" />

      {/* Rete di curve di livello topografiche */}
      <svg
        viewBox="0 0 1200 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="topo-contour-svg"
        preserveAspectRatio="none"
      >
        {/* Curva 1 (Profondità esterna / vallata) */}
        <g className="topo-contour-anim-2">
          <path
            d="M-40 215 C160 145, 360 235, 600 175 C840 115, 1040 225, 1240 165"
            className="topo-line"
          />
        </g>

        {/* Curva 2 (Intermedia) */}
        <g className="topo-contour-anim-1">
          <path
            d="M-40 178 C180 108, 380 198, 620 138 C860 78, 1060 188, 1240 128"
            className="topo-line"
          />
        </g>

        {/* Curva 3 (Direttrice Principale con quota altimetrica discreta) */}
        <g className="topo-contour-anim-3">
          <path
            d="M-40 142 C200 72, 400 162, 640 102 C880 42, 1080 152, 1240 92"
            className="topo-line topo-line-major"
          />
          <text
            x="644"
            y="98"
            fill="var(--color-ink)"
            className="topo-elevation-text"
          >
            850 m
          </text>
        </g>

        {/* Curva 4 (Sentiero / Curva d'accento tratteggiata gialla scout) */}
        <g className="topo-contour-anim-1">
          <path
            d="M-40 106 C220 36, 420 126, 660 66 C900 6, 1100 116, 1240 56"
            className="topo-line topo-line-accent"
          />
        </g>

        {/* Curva 5 (Cresta interna / colle) */}
        <g className="topo-contour-anim-2">
          <path
            d="M-40 70 C240 0, 440 90, 680 30 C920 -30, 1120 80, 1240 20"
            className="topo-line"
          />
          <text
            x="245"
            y="14"
            fill="var(--color-ink)"
            className="topo-elevation-text"
          >
            920 m
          </text>
        </g>

        {/* Curva 6 (Vetta) */}
        <g className="topo-contour-anim-3">
          <path
            d="M-40 34 C260 -36, 460 54, 700 -6 C940 -66, 1140 44, 1240 -16"
            className="topo-line"
          />
        </g>
      </svg>
    </div>
  );
}
