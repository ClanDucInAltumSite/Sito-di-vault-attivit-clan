import { Icon, IconName } from './Icon';

export type SectionType = 'giochi' | 'bans' | 'canti' | 'calendario' | 'stampa' | 'admin';

export interface SectionIconProps {
  section: SectionType;
  size?: 'sm' | 'md' | 'lg';
  iconOverride?: IconName;
  className?: string;
}

export function SectionIcon({
  section,
  size = 'md',
  iconOverride,
  className = '',
}: SectionIconProps) {
  const iconName: IconName = iconOverride || section;

  return (
    <div
      className={`section-sq-icon section-sq-${section} section-sq-${size} ${className}`.trim()}
      aria-hidden="true"
    >
      <Icon
        name={iconName}
        size={size === 'sm' ? 16 : size === 'lg' ? 24 : 18}
        strokeWidth={2}
      />
    </div>
  );
}
