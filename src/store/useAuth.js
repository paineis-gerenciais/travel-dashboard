// store/useAuth.js — autenticação (login Google) + gravação do perfil no login.
import { useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase.js';
import { upsertUserProfile } from '../lib/tripData.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        // grava/atualiza o perfil (necessário para convites e exibição de nomes)
        try { await upsertUserProfile(u); } catch (e) { console.error('Falha ao gravar perfil', e); }
      }
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  return { user, loading, login, logout };
}
