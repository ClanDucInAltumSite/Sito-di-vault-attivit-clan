import { JSX } from 'preact';

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: 'azzurro' | 'giallo' | 'rosso' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({
  variant = 'azzurro',
  size = 'md',
  children,
  className = '',
  ...props
}: BadgeProps) {
  const variantClass = `ios-badge-${variant}`;
  const sizeClass = `ios-badge-${size}`;

  return (
    <span
      className={`ios-badge ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
