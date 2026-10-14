import { useState, useEffect } from 'preact/hooks';

export type RouteName = 'home' | 'giochi' | 'bans' | 'canti' | 'calendario' | 'stampa' | 'admin';

export interface RouteState {
  route: RouteName;
  params: Record<string, string>;
  hash: string;
}

function parseHash(hashString: string): RouteState {
  const cleanHash = hashString.replace(/^#\/?/, '');
  const [pathPart, queryPart] = cleanHash.split('?');
  const path = pathPart?.toLowerCase() || '';

  const params: Record<string, string> = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((val, key) => {
      params[key] = val;
    });
  }

  let route: RouteName = 'home';
  if (path === 'giochi' || path.startsWith('giochi/')) route = 'giochi';
  else if (path === 'bans' || path.startsWith('bans/')) route = 'bans';
  else if (path === 'canti' || path.startsWith('canti/')) route = 'canti';
  else if (path === 'calendario' || path.startsWith('calendario/')) route = 'calendario';
  else if (path === 'stampa') route = 'stampa';
  else if (path === 'admin') route = 'admin';

  return { route, params, hash: hashString };
}

let currentRoute: RouteState = typeof window !== 'undefined'
  ? parseHash(window.location.hash)
  : { route: 'home', params: {}, hash: '#/' };

const listeners = new Set<(route: RouteState) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    currentRoute = parseHash(window.location.hash);
    for (const listener of listeners) {
      listener(currentRoute);
    }
  });
}

export function navigate(path: string): void {
  const formatted = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
  window.location.hash = formatted;
}

export function useRoute(): RouteState {
  const [route, setRoute] = useState<RouteState>(currentRoute);

  useEffect(() => {
    listeners.add(setRoute);
    return () => {
      listeners.delete(setRoute);
    };
  }, []);

  return route;
}
