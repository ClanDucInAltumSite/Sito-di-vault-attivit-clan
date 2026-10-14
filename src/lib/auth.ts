import { useState, useEffect } from 'preact/hooks';
import { supabase } from './supabase';
import { I18N } from './i18n';

export interface AdminAuthState {
  isAdmin: boolean;
  isLoading: boolean;
  userEmail: string | null;
  error: string | null;
}

// Listener globale per lo stato di autenticazione
let currentAdminState: AdminAuthState = {
  isAdmin: false,
  isLoading: true,
  userEmail: null,
  error: null,
};

const listeners = new Set<(state: AdminAuthState) => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentAdminState);
  }
}

// Verifica se l'utente loggato è registrato in admin_users tramite la funzione RPC is_admin
export async function verifyAdminStatus(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      currentAdminState = { isAdmin: false, isLoading: false, userEmail: null, error: null };
      notifyListeners();
      return false;
    }

    const { data, error } = await supabase.rpc('is_admin');
    if (error || !data) {
      currentAdminState = {
        isAdmin: false,
        isLoading: false,
        userEmail: session.user.email || null,
        error: error ? error.message : null,
      };
      notifyListeners();
      return false;
    }

    currentAdminState = {
      isAdmin: true,
      isLoading: false,
      userEmail: session.user.email || null,
      error: null,
    };
    notifyListeners();
    return true;
  } catch (err: any) {
    currentAdminState = {
      isAdmin: false,
      isLoading: false,
      userEmail: null,
      error: err.message || I18N.auth.errorNetwork,
    };
    notifyListeners();
    return false;
  }
}

// Inizializza l'ascolto delle sessioni Supabase
supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    await verifyAdminStatus();
  } else {
    currentAdminState = { isAdmin: false, isLoading: false, userEmail: null, error: null };
    notifyListeners();
  }
});

// Hook Preact per accedere allo stato Admin nei componenti
export function useAdmin(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>(currentAdminState);

  useEffect(() => {
    listeners.add(setState);
    // Controllo iniziale se ancora in loading
    if (currentAdminState.isLoading) {
      verifyAdminStatus();
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}

// Funzione di Login per i capi clan
export async function loginAdmin(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: I18N.auth.errorInvalidCredentials };
    }
    if (!data.user) {
      return { success: false, error: I18N.auth.errorInvalidCredentials };
    }

    const isAdmin = await verifyAdminStatus();
    if (!isAdmin) {
      await supabase.auth.signOut();
      return { success: false, error: I18N.auth.unauthorized };
    }

    return { success: true };
  } catch (_err) {
    return { success: false, error: I18N.auth.errorNetwork };
  }
}

// Funzione di Logout esplicito
export async function logoutAdmin(): Promise<void> {
  await supabase.auth.signOut();
  currentAdminState = { isAdmin: false, isLoading: false, userEmail: null, error: null };
  notifyListeners();
}
