import { JSX } from 'preact';

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: 'giallo' | 'azzurro' | 'rosso' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({
  variant = 'azzurro',
  size = 'md',
  children,
  className = '',
  ...props
}: BadgeProps) {
  const variantClass = `badge-${variant}`;
  const sizeClass = `badge-${size}`;

  return (
    <span
      className={`badge ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
