import { JSX, ComponentChildren } from 'preact';

export interface GroupedListProps extends JSX.HTMLAttributes<HTMLElement> {
  header?: string | ComponentChildren;
  footer?: string | ComponentChildren;
  children: ComponentChildren;
  className?: string;
}

export function GroupedList({
  header,
  footer,
  children,
  className = '',
  ...props
}: GroupedListProps) {
  return (
    <section className={`ios-grouped-section ${className}`.trim()} {...props}>
      {header ? (
        <header className="ios-grouped-header">{header}</header>
      ) : null}
      <div className="ios-grouped-card">
        {children}
      </div>
      {footer ? (
        <footer className="ios-grouped-footer">{footer}</footer>
      ) : null}
    </section>
  );
}
