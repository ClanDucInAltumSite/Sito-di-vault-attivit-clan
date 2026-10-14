import { JSX } from 'preact';

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({
  interactive = false,
  children,
  className = '',
  ...props
}: CardProps) {
  const interactiveClass = interactive ? 'ios-card-interactive' : '';

  return (
    <div
      className={`ios-card ${interactiveClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
