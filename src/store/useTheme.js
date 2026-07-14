// store/useTheme.js — modo claro/escuro (Fase 3, item 3.2) + paleta (Fase 5, item 5.E).
// Ambas as preferências ficam só no navegador (localStorage) — não tocam no
// Firestore, respeitando o critério de aceite de fases só de apresentação.
import { useState, useEffect, useCallback } from 'react';

const KEY = 'trip_theme';
const PALETTE_KEY = 'trip_palette';

function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (e) { /* ignore */ }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function initialPalette() {
  try {
    const saved = localStorage.getItem(PALETTE_KEY);
    if (saved === 'colorido' || saved === 'minimalista') return saved;
  } catch (e) { /* ignore */ }
  return 'colorido'; // padrão: preserva a identidade visual atual
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);
  const [palette, setPalette] = useState(initialPalette);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    try { localStorage.setItem(PALETTE_KEY, palette); } catch (e) { /* ignore */ }
  }, [palette]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const togglePalette = useCallback(() => setPalette((p) => (p === 'colorido' ? 'minimalista' : 'colorido')), []);
  return { theme, toggle, palette, togglePalette };
}
