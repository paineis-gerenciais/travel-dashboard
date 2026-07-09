// lib/firebase.js
// Inicialização do Firebase (item 1.3/1.6). A configuração vem de variáveis de
// ambiente (arquivo .env, ver .env.example) — nada de chaves fixas no código.
// Nota: as chaves "apiKey" do Firebase Web NÃO são secretas (são identificadores
// públicos do projeto); o que protege os dados são as REGRAS do Firestore
// (firestore.rules), não o segredo dessas chaves.

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
