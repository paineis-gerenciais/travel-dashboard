// store/useTheme.js — modo claro/escuro (Fase 3, item 3.2).
// A preferência fica só no navegador (localStorage) — não toca no Firestore,
// respeitando o critério de aceite da Fase 3 (nada de mudança no modelo de dados).
import { useState, useEffect, useCallback } from 'react';

const KEY = 'trip_theme';

function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (e) { /* ignore */ }
  // padrão: acompanha a preferência do sistema
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
