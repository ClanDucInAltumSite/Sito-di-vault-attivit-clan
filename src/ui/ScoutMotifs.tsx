/**
 * I Tre Motivi Scout Vettoriali — FASE 1B (FINALE) Sezione 7
 * Tratto sottile come le icone (1.75px), al massimo uno per schermata:
 * 1. La Rivelazione del Logo (su Targa Bianca)
 * 2. Il Sentiero (linea tratteggiata che si disegna con punto giallo finale)
 * 3. La Bussola di Sincronizzazione (ago oscillante durante il sync)
 */

import { BrandLogo } from './BrandLogo';

export interface LogoRevealProps {
  size?: number;
  className?: string;
}

export function LogoReveal({ size = 56, className = '' }: LogoRevealProps) {
  return (
    <div className={`scout-logo-reveal brand-targa ${className}`.trim()} role="presentation">
      <BrandLogo variant="completo" size={size} />
    </div>
  );
}

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
        viewBox="0 0 320 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="scout-trail-svg"
        preserveAspectRatio="none"
      >
        <path
          d="M 6 10 C 60 2, 100 18, 160 10 C 220 2, 260 18, 308 10"
          className="scout-trail-path"
        />
        {/* Punto giallo scout al termine della traccia */}
        <circle cx="312" cy="10" r="3.5" className="scout-trail-end-dot" />
      </svg>
    </div>
  );
}

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
      title={isSyncing ? 'Sincronizzazione in corso...' : 'Dati sincronizzati'}
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
      {/* Ago della bussola: punta nord con colore di sezione / accento, punta sud neutra */}
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
