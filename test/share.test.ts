// test/share.test.ts
// Test unitari per il modulo di condivisione Web App (share.ts)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shareWebApp } from '../src/lib/share';

describe('Modulo Condivisione Web App (share.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. Usa navigator.share quando supportato e disponibile', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share: mockShare,
    });

    const result = await shareWebApp({
      title: 'Vault Scout Clan',
      text: 'Accedi al vault',
      url: 'https://vault.scout.test',
    });

    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledWith({
      title: 'Vault Scout Clan',
      text: 'Accedi al vault',
      url: 'https://vault.scout.test',
    });
    expect(result).toEqual({ shared: true, copied: false });
  });

  it('2. Gestisce silenziosamente l\'annullamento utente (AbortError)', async () => {
    const abortError = new Error('Share canceled');
    abortError.name = 'AbortError';

    const mockShare = vi.fn().mockRejectedValue(abortError);
    const mockClipboard = vi.fn();

    vi.stubGlobal('navigator', {
      share: mockShare,
      clipboard: { writeText: mockClipboard },
    });

    const result = await shareWebApp({ url: 'https://vault.scout.test' });

    expect(mockShare).toHaveBeenCalled();
    expect(mockClipboard).not.toHaveBeenCalled();
    expect(result).toEqual({ shared: false, copied: false });
  });

  it('3. Fallback su navigator.clipboard.writeText se navigator.share non è definito', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('navigator', {
      clipboard: { writeText: mockWriteText },
    });

    const result = await shareWebApp({ url: 'https://vault.scout.test' });

    expect(mockWriteText).toHaveBeenCalledWith('https://vault.scout.test');
    expect(result).toEqual({ shared: false, copied: true });
  });

  it('4. Fallback su navigator.clipboard.writeText se navigator.share lancia un errore generico', async () => {
    const genericError = new Error('PermissionDenied');
    const mockShare = vi.fn().mockRejectedValue(genericError);
    const mockWriteText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('navigator', {
      share: mockShare,
      clipboard: { writeText: mockWriteText },
    });

    const result = await shareWebApp({ url: 'https://vault.scout.test' });

    expect(mockShare).toHaveBeenCalled();
    expect(mockWriteText).toHaveBeenCalledWith('https://vault.scout.test');
    expect(result).toEqual({ shared: false, copied: true });
  });

  it('5. Fallback estremo document.execCommand se clipboard non è supportata', async () => {
    const execSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue({
        style: {},
        select: vi.fn(),
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: execSpy,
    });

    const result = await shareWebApp({ url: 'https://vault.scout.test' });

    expect(execSpy).toHaveBeenCalledWith('copy');
    expect(result).toEqual({ shared: false, copied: true });
  });
});
