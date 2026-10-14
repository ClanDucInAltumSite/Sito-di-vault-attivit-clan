export interface TopographicBackgroundProps {
  className?: string;
  showCaption?: boolean;
}

/**
 * Sfondo Vettoriale con Curve di Livello Topografiche (Isoipse Cartografiche)
 * Ispirato alle carte IGM scout 1:25.000 dei Monti Sibillini e colline perugine.
 * - Tratto sottile ad altissima definizione
 * - Opacità delicata (6-12%) integrata nei token dell'inchiostro
 * - Lenta animazione armoniosa su sole proprietà transform
 */
export function TopographicBackground({
  className = '',
  showCaption = true,
}: TopographicBackgroundProps) {
  return (
    <div
      className={`topo-contour-wrapper ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
    >
      <svg
        viewBox="0 0 800 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="topo-contour-svg"
        preserveAspectRatio="none"
      >
        {/* Curva 1 (Profondità esterna) */}
        <g className="topo-contour-anim-2">
          <path
            d="M-20 120 C120 70, 240 140, 400 95 C560 50, 680 130, 820 90"
            className="topo-line"
          />
        </g>

        {/* Curva 2 (Intermedia) */}
        <g className="topo-contour-anim-1">
          <path
            d="M-20 95 C140 45, 260 115, 420 70 C580 25, 700 105, 820 65"
            className="topo-line"
          />
        </g>

        {/* Curva 3 (Direttrice Principale con spessore maggiore) */}
        <g className="topo-contour-anim-3">
          <path
            d="M-20 70 C160 20, 280 90, 440 45 C600 0, 720 80, 820 40"
            className="topo-line topo-line-major"
          />
          {/* Quota altimetrica discreta */}
          <text
            x="442"
            y="41"
            fill="var(--color-ink)"
            opacity="0.22"
            fontSize="9"
            fontFamily="var(--font-sans)"
            fontWeight="600"
            letterSpacing="0.05em"
          >
            850 m
          </text>
        </g>

        {/* Curva 4 (Sentiero / Curva d'accento tratteggiata gialla scout) */}
        <g className="topo-contour-anim-1">
          <path
            d="M-20 45 C180 -5, 300 65, 460 20 C620 -25, 740 55, 820 15"
            className="topo-line topo-line-accent"
          />
        </g>

        {/* Curva 5 (Vetta / Cresta interna) */}
        <g className="topo-contour-anim-2">
          <path
            d="M-20 20 C200 -30, 320 40, 480 -5 C640 -50, 760 30, 820 -10"
            className="topo-line"
          />
        </g>
      </svg>

      {showCaption ? (
        <div className="topo-contour-caption">
          <span className="topo-dot" />
          <span>Rilievo Topografico Clan • Duc In Altum</span>
          <span className="topo-dot" />
        </div>
      ) : null}
    </div>
  );
}
