import { ComponentChildren } from 'preact';
import { HEADER_PHOTOS, HeaderPhotoConfig } from '../lib/photos';
import { SectionIcon, SectionType } from './SectionIcon';

export interface HeaderBannerProps {
  photoId: HeaderPhotoConfig['id'];
  title?: string;
  countLabel?: string;
  count?: string;
  sectionType?: SectionType;
  section?: SectionType | 'neutral';
  isHome?: boolean;
  children?: ComponentChildren;
  className?: string;
}

export function HeaderBanner({
  photoId,
  title,
  countLabel,
  count,
  sectionType,
  section,
  isHome = false,
  children,
  className = '',
}: HeaderBannerProps) {
  const photo = HEADER_PHOTOS[photoId];
  const displayCount = countLabel || count;
  const effectiveSection = (sectionType || (section !== 'neutral' ? section : undefined)) as SectionType | undefined;

  return (
    <div
      className={`header-banner ${isHome ? 'header-banner-home' : 'header-banner-section'} ${className}`.trim()}
    >
      <div className="header-banner-media">
        <picture>
          <source
            type="image/webp"
            srcSet={photo.srcset}
            sizes={photo.sizes}
          />
          <img
            src={photo.src}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            className="header-banner-img"
            loading={isHome ? 'eager' : 'lazy'}
            decoding="async"
            // @ts-ignore fetchpriority is standard in modern browsers
            fetchpriority={isHome ? 'high' : 'auto'}
            style={{
              backgroundImage: `url("${photo.placeholder}")`,
              backgroundSize: 'cover',
            }}
          />
        </picture>
        {/* Scrim funzionale tinto del viola del marchio (#462679) per leggibilità garantita */}
        <div className="header-banner-scrim" aria-hidden="true" />
      </div>

      <div className="header-banner-content">
        {!isHome && (
          <div className="header-banner-meta">
            {effectiveSection && <SectionIcon section={effectiveSection} size="md" />}
            {displayCount && (
              <span className="header-banner-count tabular-nums">{displayCount}</span>
            )}
          </div>
        )}

        {title && !isHome && (
          <h1 className="header-banner-title">{title}</h1>
        )}

        {children}
      </div>
    </div>
  );
}
