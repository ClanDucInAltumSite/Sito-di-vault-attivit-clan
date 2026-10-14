import { JSX } from 'preact';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: ReadonlyArray<SegmentOption<T>> | Array<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % options.length;
      const nextOpt = options[nextIndex];
      if (nextOpt) onChange(nextOpt.value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + options.length) % options.length;
      const prevOpt = options[prevIndex];
      if (prevOpt) onChange(prevOpt.value);
    }
  };

  return (
    <div
      className={`ios-segmented-control ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option, idx) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={`ios-segment ${isSelected ? 'ios-segment-selected' : ''}`.trim()}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
