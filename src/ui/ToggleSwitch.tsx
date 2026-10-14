import { JSX } from 'preact';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  id,
  disabled = false,
  'aria-label': ariaLabel,
  className = '',
}: ToggleSwitchProps) {
  const handleChange = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    onChange((e.target as HTMLInputElement).checked);
  };

  return (
    <label
      className={`ios-switch-container ${disabled ? 'ios-switch-disabled' : ''} ${className}`.trim()}
    >
      <input
        type="checkbox"
        role="switch"
        id={id}
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        aria-label={ariaLabel}
        onChange={handleChange}
        className="ios-switch-input"
      />
      <span className="ios-switch-track">
        <span className="ios-switch-thumb" />
      </span>
    </label>
  );
}
