import { JSX } from 'preact';

export interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = 'ios-btn';
  const variantClass = `ios-btn-${variant}`;
  const sizeClass = `ios-btn-${size}`;
  const widthClass = fullWidth ? 'ios-btn-full' : '';
  const loadingClass = isLoading ? 'ios-btn-loading' : '';

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClass} ${sizeClass} ${widthClass} ${loadingClass} ${className}`.trim()}
      {...props}
    >
      {isLoading ? (
        <span className="ios-btn-spinner" aria-hidden="true" />
      ) : null}
      <span className="ios-btn-label">{children}</span>
    </button>
  );
}
