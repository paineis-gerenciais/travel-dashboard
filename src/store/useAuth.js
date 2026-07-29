// store/useAuth.js — autenticação (Google e celular) + gravação do perfil no login.
import { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase.js';
import { upsertUserProfile } from '../lib/tripData.js';
import { sendLoginCode, confirmCode } from '../lib/phoneAuth.js';
import { track } from '../lib/analytics.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        // grava/atualiza o perfil (necessário para convites e exibição de nomes)
        try { await upsertUserProfile(u); } catch (e) { console.error('Falha ao gravar perfil', e); }
        track('login_succeeded', { method: u.phoneNumber && !u.email ? 'phone' : 'google' });
      }
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  // E-mail e senha. Diferente do login por celular, este provedor NÃO exige o
  // plano Blaze — é a forma mais acessível de entrar no app.
  const loginWithEmail = (email, senha) => signInWithEmailAndPassword(auth, email.trim(), senha);

  const registerWithEmail = async (email, senha, nome) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    if (nome && nome.trim()) {
      await updateProfile(cred.user, { displayName: nome.trim() });
      await upsertUserProfile(auth.currentUser); // grava o nome já no primeiro acesso
    }
    return cred;
  };

  const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

  // Login por celular: 1) enviar código, 2) confirmar. `containerId` é a div
  // invisível do reCAPTCHA que precisa existir no DOM (ver Login.jsx).
  const loginWithPhoneStart = (phoneE164, containerId) => sendLoginCode(phoneE164, containerId);
  const loginWithPhoneConfirm = (confirmationResult, code) => confirmCode(confirmationResult, code);

  // Depois de updateProfile/linkWithPopup/linkWithPhoneNumber, o objeto `user`
  // do Firebase é mutado no lugar — React não percebe a mudança sozinho.
  // Chamar isso após qualquer alteração de perfil força um novo objeto (nova
  // referência), para a UI (nome/celular/e-mail em Configurações) atualizar.
  const refreshUser = () => setUser((u) => (auth.currentUser ? { ...auth.currentUser } : u));

  return {
    user, loading, login, logout,
    loginWithEmail, registerWithEmail, resetPassword,
    loginWithPhoneStart, loginWithPhoneConfirm, refreshUser,
  };
}
