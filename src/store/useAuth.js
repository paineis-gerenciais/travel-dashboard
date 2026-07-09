// store/useAuth.js
// Hook de autenticação (item 2.1 já preparado, mas usado aqui só para associar
// os dados a um uid). Login com Google, coerente com o fluxo que já existia no
// Apps Script (onde o usuário também se identificava pela conta Google).

import { useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  return { user, loading, login, logout };
}
