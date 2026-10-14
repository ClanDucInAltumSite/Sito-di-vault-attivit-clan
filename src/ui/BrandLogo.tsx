import logoCompletoSrc from '../../assets/logo-completo.png';
import logoEmblemaSrc from '../../assets/logo-emblema.png';

export interface BrandLogoProps {
  variant?: 'completo' | 'emblema';
  size?: number;
  className?: string;
  withTarga?: boolean;
  priority?: boolean;
}

/**
 * Componente Logo Ufficiale — Conforme a FASE 1B (FINALE) Sezione 1
 * - Sempre su fondo chiaro / targa bianca opaca
 * - Area di rispetto >= 12%
 * - Nessun ritocco, deformazione o ricolorazione
 * - Variante 'completo' (con scritta) e 'emblema' (solo cerchio giglio per usi piccoli)
 */
export function BrandLogo({
  variant = 'completo',
  size,
  className = '',
  withTarga = false,
  priority = false,
}: BrandLogoProps) {
  const isCompleto = variant === 'completo';
  const src = isCompleto ? logoCompletoSrc : logoEmblemaSrc;
  const alt = isCompleto
    ? 'Logo Ufficiale Clan Duc In Altum — Gruppo AGESCI Ponte San Giovanni 1'
    : 'Emblema Scout Duc In Altum';

  // Dimensioni native: completo 540x543 (ratio ~1), emblema 540x468 (ratio 1.15)
  const defaultWidth = isCompleto ? 220 : 32;
  const width = size || defaultWidth;
  const height = isCompleto ? Math.round(width * (543 / 540)) : Math.round(width * (468 / 540));

  const imgElement = (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`brand-logo-img brand-logo-${variant}`}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      // @ts-ignore fetchpriority is standard in modern browsers
      fetchpriority={priority ? 'high' : 'auto'}
      style={{
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        objectFit: 'contain',
      }}
    />
  );

  if (withTarga) {
    return (
      <div className={`brand-targa scout-logo-reveal ${className}`.trim()} role="presentation">
        {imgElement}
      </div>
    );
  }

  return (
    <div className={`brand-logo-wrap ${className}`.trim()}>
      {imgElement}
    </div>
  );
}
