import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lpeiyzwccedtqjbficjo.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ';

// Fallback WebSocket per ambienti di test / DOM sintetico dove WebSocket non è popolato
let wsTransport: any = undefined;
if (typeof WebSocket === 'undefined' && typeof globalThis !== 'undefined' && !(globalThis as any).WebSocket) {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 1;
    onopen: any = null;
    onmessage: any = null;
    onerror: any = null;
    onclose: any = null;
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  }
  (globalThis as any).WebSocket = MockWebSocket;
  wsTransport = MockWebSocket;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    ...(wsTransport ? { transport: wsTransport } : {}),
  },
});
