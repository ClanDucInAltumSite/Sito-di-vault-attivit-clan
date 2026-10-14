import { JSX } from 'preact';

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  stitch?: boolean;
  interactive?: boolean;
}

export function Card({
  stitch = false,
  interactive = false,
  children,
  className = '',
  ...props
}: CardProps) {
  const stitchClass = stitch ? 'scout-stitch' : '';
  const interactiveClass = interactive ? 'scout-card-interactive' : '';

  return (
    <div
      className={`scout-card ${stitchClass} ${interactiveClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
