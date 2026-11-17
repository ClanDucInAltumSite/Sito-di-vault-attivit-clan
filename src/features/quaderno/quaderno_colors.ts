// src/features/quaderno/quaderno_colors.ts
// Token di colore e stile semantico per le tipologie/categorie del Quaderno di Clan
// Conforme alle verifiche statiche del Design System (zero HEX, solo token semantici OKLCH)

import { QuadernoCategoria } from '../../lib/db';

export type CategoryFilter = 'tutte' | QuadernoCategoria;

export interface CategoryPillStyle {
  bg: string;
  border: string;
  color: string;
  dotColor: string;
}

export function getCategoryPillColors(cat: CategoryFilter, isActive: boolean): CategoryPillStyle {
  switch (cat) {
    case 'riunione':
      return {
        bg: isActive ? 'var(--color-brand-purple)' : 'var(--color-surface)',
        border: isActive ? 'var(--color-brand-purple)' : 'var(--color-border)',
        color: isActive ? 'oklch(1 0 0)' : 'var(--color-text)',
        dotColor: isActive ? 'oklch(1 0 0)' : 'var(--color-brand-purple)',
      };
    case 'punto_strada':
      return {
        bg: isActive ? 'var(--color-canti)' : 'var(--color-surface)',
        border: isActive ? 'var(--color-canti)' : 'var(--color-border)',
        color: isActive ? 'oklch(1 0 0)' : 'var(--color-text)',
        dotColor: isActive ? 'oklch(1 0 0)' : 'var(--color-canti)',
      };
    case 'verifica':
      return {
        bg: isActive ? 'var(--color-uscita)' : 'var(--color-surface)',
        border: isActive ? 'var(--color-uscita)' : 'var(--color-border)',
        color: isActive ? 'oklch(1 0 0)' : 'var(--color-text)',
        dotColor: isActive ? 'oklch(1 0 0)' : 'var(--color-uscita)',
      };
    case 'libero':
      return {
        bg: isActive ? 'var(--color-giochi)' : 'var(--color-surface)',
        border: isActive ? 'var(--color-giochi)' : 'var(--color-border)',
        color: isActive ? 'var(--color-giochi-text)' : 'var(--color-text)',
        dotColor: isActive ? 'var(--color-giochi-text)' : 'var(--color-giochi)',
      };
    case 'tutte':
    default:
      return {
        bg: isActive ? 'var(--color-quaderno)' : 'var(--color-surface)',
        border: isActive ? 'var(--color-quaderno)' : 'var(--color-border)',
        color: isActive ? 'oklch(1 0 0)' : 'var(--color-text)',
        dotColor: isActive ? 'oklch(1 0 0)' : 'var(--color-quaderno)',
      };
  }
}
