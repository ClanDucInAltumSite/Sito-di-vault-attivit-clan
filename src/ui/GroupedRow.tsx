import { JSX, ComponentChildren } from 'preact';
import { Icon } from './Icon';

export interface GroupedRowProps {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  leading?: ComponentChildren;
  trailing?: ComponentChildren;
  chevron?: boolean;
  href?: string;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLElement>) => void;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function GroupedRow({
  title,
  subtitle,
  leading,
  trailing,
  chevron = false,
  href,
  onClick,
  destructive = false,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}: GroupedRowProps) {
  const isInteractive = Boolean(href || onClick) && !disabled;
  const classes = [
    'ios-grouped-row',
    isInteractive ? 'ios-grouped-row-interactive' : '',
    destructive ? 'ios-grouped-row-destructive' : '',
    disabled ? 'ios-grouped-row-disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  const content = (
    <>
      {leading ? (
        <div className="ios-row-leading" aria-hidden="true">
          {leading}
        </div>
      ) : null}
      <div className="ios-row-content">
        <span className="ios-row-title">{title}</span>
        {subtitle ? (
          <span className="ios-row-subtitle">{subtitle}</span>
        ) : null}
      </div>
      <div className="ios-row-trailing">
        {trailing}
        {chevron ? (
          <Icon name="chevron-right" size={16} className="ios-row-chevron" />
        ) : null}
      </div>
    </>
  );

  if (href && !disabled) {
    return (
      <a
        href={href}
        className={classes}
        aria-label={ariaLabel}
        onClick={onClick as any}
      >
        {content}
      </a>
    );
  }

  if (onClick && !disabled) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={classes} aria-label={ariaLabel}>
      {content}
    </div>
  );
}
