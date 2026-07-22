// store/useAuth.js — autenticação (Google e celular) + gravação do perfil no login.
import { useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase.js';
import { upsertUserProfile } from '../lib/tripData.js';
import { sendLoginCode, confirmCode } from '../lib/phoneAuth.js';

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

  // Login por celular: 1) enviar código, 2) confirmar. `containerId` é a div
  // invisível do reCAPTCHA que precisa existir no DOM (ver Login.jsx).
  const loginWithPhoneStart = (phoneE164, containerId) => sendLoginCode(phoneE164, containerId);
  const loginWithPhoneConfirm = (confirmationResult, code) => confirmCode(confirmationResult, code);

  // Depois de updateProfile/linkWithPopup/linkWithPhoneNumber, o objeto `user`
  // do Firebase é mutado no lugar — React não percebe a mudança sozinho.
  // Chamar isso após qualquer alteração de perfil força um novo objeto (nova
  // referência), para a UI (nome/celular/e-mail em Configurações) atualizar.
  const refreshUser = () => setUser((u) => (auth.currentUser ? { ...auth.currentUser } : u));

  return { user, loading, login, logout, loginWithPhoneStart, loginWithPhoneConfirm, refreshUser };
}
