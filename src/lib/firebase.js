// lib/firebase.js
// Inicialização do Firebase (item 1.3/1.6). A configuração vem de variáveis de
// ambiente (arquivo .env, ver .env.example) — nada de chaves fixas no código.
// Nota: as chaves "apiKey" do Firebase Web NÃO são secretas (são identificadores
// públicos do projeto); o que protege os dados são as REGRAS do Firestore
// (firestore.rules), não o segredo dessas chaves.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore com cache local persistente: o app continua lendo/escrevendo
// offline e sincroniza quando a conexão volta. Complementa o service worker
// do PWA (que cuida do casco do app; isto cuida dos dados).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// ---------------------------------------------------------------------------
// Modo de teste (T-1.12). SÓ é ativado quando VITE_USE_EMULATORS === 'true',
// variável que existe apenas no ambiente de teste local/CI — jamais em
// produção. Como a comparação é estática, o bundler elimina este bloco inteiro
// no build normal (e, com ele, os imports que só são usados aqui).
//
// Importante: NADA de `await` no topo do módulo. Além de o alvo de build do
// Vite não suportar top-level await, um import assíncrono aqui criaria uma
// corrida — o app poderia começar a usar `auth`/`db` antes de a conexão com o
// emulador ser estabelecida, deixando os testes E2E instáveis. Por isso os
// imports são estáticos e a conexão é síncrona.
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);

  // Gancho usado pelos testes E2E para entrar sem depender de conta Google.
  window.__E2E_LOGIN__ = async (email) => {
    const senha = 'senha-de-teste-123';
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch {
      await createUserWithEmailAndPassword(auth, email, senha);
    }
  };
}
