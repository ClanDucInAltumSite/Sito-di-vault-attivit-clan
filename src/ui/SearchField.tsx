import { JSX } from 'preact';
import { Icon } from './Icon';
import { I18N } from '../lib/i18n';

export interface SearchFieldProps {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}

export function SearchField({
  value,
  onInput,
  placeholder = I18N.search.placeholderGlobale,
  className = '',
  autoFocus = false,
  'aria-label': ariaLabel = I18N.search.placeholderGlobale,
}: SearchFieldProps) {
  const handleClear = () => {
    onInput('');
  };

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onInput('');
    }
  };

  return (
    <div className={`ios-search-container ${className}`.trim()} role="search">
      <Icon name="search" size={17} className="ios-search-icon" aria-hidden="true" />
      <input
        type="search"
        className="ios-search-input"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        spellcheck={false}
      />
      {value.length > 0 ? (
        <button
          type="button"
          className="ios-search-clear"
          onClick={handleClear}
          aria-label={I18N.search.clear}
        >
          <Icon name="clear" size={16} />
        </button>
      ) : null}
    </div>
  );
}
