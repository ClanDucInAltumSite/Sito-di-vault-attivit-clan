

import logoSrc from '../../assets/favicon.png';

/**
 * Motivo 1: Logo Reveal all'avvio / Home
 * Appare con transizione di scala morbida e leggero anello d'accento pulsante
 */
export interface LogoRevealProps {
  size?: number;
  className?: string;
  subtle?: boolean;
}

export function LogoReveal({
  size = 56,
  className = '',
  subtle = false,
}: LogoRevealProps) {
  return (
    <div
      className={`scout-logo-reveal ${subtle ? 'scout-logo-subtle' : ''} ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <div className="scout-logo-halo" aria-hidden="true" />
      <img
        src={logoSrc}
        alt="Logo Clan Duc In Altum"
        className="scout-logo-img"
        width={size}
        height={size}
      />
    </div>
  );
}

/**
 * Motivo 2: The Trail (Il Sentiero)
 * Linea tratteggiata vettoriale sottile con un minuscolo punto giallo scout
 * che si sposta delicatamente lungo il tracciato.
 */
export interface TheTrailProps {
  className?: string;
  compact?: boolean;
}

export function TheTrail({ className = '', compact = false }: TheTrailProps) {
  return (
    <div
      className={`scout-trail-container ${compact ? 'scout-trail-compact' : ''} ${className}`.trim()}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 320 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="scout-trail-svg"
        preserveAspectRatio="none"
      >
        <path
          d="M 4 12 C 60 4, 100 20, 160 12 C 220 4, 260 20, 316 12"
          className="scout-trail-path"
        />
        <circle className="scout-trail-dot" r="3.5" />
      </svg>
    </div>
  );
}

/**
 * Motivo 3: Bussola di sincronizzazione
 * L'ago vettoriale oscilla dolcemente durante la sincronizzazione attiva
 * e si allinea al Nord (0°) una volta completata la sincronizzazione.
 */
export interface CompassSyncProps {
  isSyncing: boolean;
  size?: number;
  className?: string;
  'aria-label'?: string;
}

export function CompassSync({
  isSyncing,
  size = 22,
  className = '',
  'aria-label': ariaLabel,
}: CompassSyncProps) {
  return (
    <div
      className={`scout-compass-widget ${isSyncing ? 'scout-compass-syncing' : 'scout-compass-idle'} ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label={ariaLabel}
      title={isSyncing ? 'Sincronizzazione in corso...' : 'Dati allineati'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="scout-compass-housing"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
      </svg>
      {/* Ago della bussola: punta nord con accento/giallo, punta sud neutra */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="scout-compass-needle"
        aria-hidden="true"
      >
        {/* Punta Nord */}
        <polygon points="12 4 14.5 12 12 10.5 9.5 12" className="scout-needle-north" />
        {/* Punta Sud */}
        <polygon points="12 20 14.5 12 12 13.5 9.5 12" className="scout-needle-south" />
        {/* Pivot centrale */}
        <circle cx="12" cy="12" r="1.5" className="scout-needle-pivot" />
      </svg>
    </div>
  );
}
