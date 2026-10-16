/**
 * Configurazione unica per le cinque fotografie di testata
 * Conforme alla FASE 1B (FINALE) - Sezione 4
 * Budget totale compresso WebP <= 500 KB, precached per funzionamento offline.
 */

export interface HeaderPhotoConfig {
  id: 'home' | 'giochi' | 'bans' | 'canti' | 'calendario';
  title: string;
  alt: string;
  src: string;
  srcMobile: string;
  srcset: string;
  sizes: string;
  placeholder: string;
  width: number;
  height: number;
  author: string;
  subject: string;
}

const BASE = import.meta.env.BASE_URL || '/';

function photoUrl(filename: string): string {
  const cleanBase = BASE.endsWith('/') ? BASE : `${BASE}/`;
  return `${cleanBase}photos/${filename}`;
}

export const HEADER_PHOTOS: Record<HeaderPhotoConfig['id'], HeaderPhotoConfig> = {
  home: {
    id: 'home',
    title: 'Vault Clan - Duc In Altum',
    alt: 'Paesaggio montano con vette illuminate dal sole al tramonto',
    src: photoUrl('home-400.webp'),
    srcMobile: photoUrl('home-400.webp'),
    srcset: `${photoUrl('home-400.webp')} 400w, ${photoUrl('home-800.webp')} 800w, ${photoUrl('home-1200.webp')} 1200w`,
    sizes: '(max-width: 600px) 400px, (max-width: 1024px) 800px, 1200px',
    placeholder: 'data:image/webp;base64,UklGRngAAABXRUJQVlA4IGwAAADQAwCdASoYAA4APxFwsFAsJiSisAgBgCIJYgCdAB4+k5IjwBGubmAA+pi1mXTBOaemGdQExrH1EqRKuBCRY3JwzzOsrJkCfYjC0wPd2NDRCR1kSZYJztUnwvzEedi8pzrn/tjTpjSHt16rgAA=',
    width: 1200,
    height: 675,
    author: 'Kalen Emsley',
    subject: 'Paesaggio montano e vette al tramonto',
  },
  giochi: {
    id: 'giochi',
    title: 'Archivio Giochi',
    alt: 'Ampio prato verde collinare per attività e grandi giochi scout',
    src: photoUrl('giochi-400.webp'),
    srcMobile: photoUrl('giochi-400.webp'),
    srcset: `${photoUrl('giochi-400.webp')} 400w, ${photoUrl('giochi-800.webp')} 800w, ${photoUrl('giochi-1200.webp')} 1200w`,
    sizes: '(max-width: 600px) 400px, (max-width: 1024px) 800px, 1200px',
    placeholder: 'data:image/webp;base64,UklGRlwAAABXRUJQVlA4IFAAAACwAwCdASoYAA4APxF8tFGsKCUisAgBgCIJZQCdG1/AWKDhbHHgAAD+kEfl3Mnx1FWsk6R1HiCJmYKu4B0Jl+/+X10xtdqQBfNWPjzijAAAAA==',
    width: 1200,
    height: 600,
    author: 'Michael Shannon',
    subject: 'Prato verde all\'aperto e colline',
  },
  bans: {
    id: 'bans',
    title: 'Archivio Bans',
    alt: 'Fuoco di bivacco scout serale con braci ardenti e fiamme vive',
    src: photoUrl('bans-400.webp'),
    srcMobile: photoUrl('bans-400.webp'),
    srcset: `${photoUrl('bans-400.webp')} 400w, ${photoUrl('bans-800.webp')} 800w, ${photoUrl('bans-1200.webp')} 1200w`,
    sizes: '(max-width: 600px) 400px, (max-width: 1024px) 800px, 1200px',
    placeholder: 'data:image/webp;base64,UklGRlIAAABXRUJQVlA4IEYAAABQAwCdASoYAA4APxFysVCsJqSisAgBgCIJY2VuRgATjal/AAD+7eRk1EZWmaT3yzdQkbOlRLosYv+jMgHy4ozYO7Tum+AA',
    width: 1200,
    height: 600,
    author: 'Kimon Maritz',
    subject: 'Fuoco di bivacco notturno con braci ardenti',
  },
  canti: {
    id: 'canti',
    title: 'Canzoniere di Clan',
    alt: 'Chitarra acustica scout con corde e manico a fuoco',
    src: photoUrl('canti-400.webp'),
    srcMobile: photoUrl('canti-400.webp'),
    srcset: `${photoUrl('canti-400.webp')} 400w, ${photoUrl('canti-800.webp')} 800w, ${photoUrl('canti-1200.webp')} 1200w`,
    sizes: '(max-width: 600px) 400px, (max-width: 1024px) 800px, 1200px',
    placeholder: 'data:image/webp;base64,UklGRqoAAABXRUJQVlA4IJ4AAABQBACdASoYAA4APxFysFAsJqSisAgBgCIJbACdMoACSzCopL/sPyrl1pG8APffjmV8OJxFDieeDjlJ4xBt1whllHn23EntzzaIPwIChXsgWu1foXe0DY0MJ6wr4sJlYj4EdAZ9ZM7CFlMEUTVgMJoYGCJzXumnLw4ju8aOzYj+/ruz1aZ7i3cRuJXp/cShVUPgV57/Js9rm2A7yXAAAA==',
    width: 1200,
    height: 600,
    author: 'Wes Hicks',
    subject: 'Chitarra acustica e note per il canzoniere',
  },
  calendario: {
    id: 'calendario',
    title: 'Calendario Clan',
    alt: 'Sentiero battuto nel bosco scout immerso nella natura',
    src: photoUrl('calendario-400.webp'),
    srcMobile: photoUrl('calendario-400.webp'),
    srcset: `${photoUrl('calendario-400.webp')} 400w, ${photoUrl('calendario-800.webp')} 800w, ${photoUrl('calendario-1200.webp')} 1200w`,
    sizes: '(max-width: 600px) 400px, (max-width: 1024px) 800px, 1200px',
    placeholder: 'data:image/webp;base64,UklGRm4AAABXRUJQVlA4IGIAAACwAwCdASoYAA4APxF0sVCsJqSisAgBgCIJZgC7ABkq7kPFIV0MAAD+3fi2ui7iSnHLfxWjO8mG2vdGjD0bmQbVVPijhL4G6zExe4SsRBHqxcpGCCVd73rIZbv1Fb+1p7AAAA==',
    width: 1200,
    height: 600,
    author: 'Luca Bravo',
    subject: 'Sentiero nel bosco illuminato dal sole',
  },
};

export const PHOTOS = HEADER_PHOTOS;
