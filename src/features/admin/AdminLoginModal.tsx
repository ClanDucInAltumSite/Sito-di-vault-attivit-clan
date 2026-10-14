import { useState } from 'preact/hooks';
import { I18N } from '../../lib/i18n';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { loginAdmin } from '../../lib/auth';

export interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminLoginModal({ isOpen, onClose, onSuccess }: AdminLoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e?: Event) => {
    if (e) e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setErrorMessage(null);

    const result = await loginAdmin(email, password);
    setIsLoading(false);

    if (result.success) {
      setEmail('');
      setPassword('');
      onSuccess();
      onClose();
    } else {
      setErrorMessage(result.error || I18N.auth.errorInvalidCredentials);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={I18N.auth.loginTitle}
      subtitle={I18N.auth.loginDescription}
      footer={
        <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {I18N.dialogs.annulla}
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSubmit()}
            isLoading={isLoading}
            disabled={!email || !password}
          >
            {I18N.auth.loginButton}
          </Button>
        </div>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {errorMessage ? (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--color-rosso-subtle)',
              borderLeft: '4px solid var(--color-rosso)',
              color: 'var(--color-rosso)',
              fontSize: 'var(--font-size-sm)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
            }}
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="ios-form-group">
          <label className="ios-form-label" htmlFor="admin-email">
            {I18N.auth.emailLabel}
          </label>
          <input
            id="admin-email"
            type="email"
            className="ios-form-input"
            required
            autoComplete="email"
            placeholder={I18N.auth.emailPlaceholder}
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            disabled={isLoading}
          />
        </div>

        <div className="ios-form-group">
          <label className="ios-form-label" htmlFor="admin-password">
            {I18N.auth.passwordLabel}
          </label>
          <input
            id="admin-password"
            type="password"
            className="ios-form-input"
            required
            autoComplete="current-password"
            placeholder={I18N.auth.passwordPlaceholder}
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            disabled={isLoading}
          />
        </div>
      </form>
    </BottomSheet>
  );
}
