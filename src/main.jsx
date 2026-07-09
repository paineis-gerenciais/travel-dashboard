import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth } from './store/useAuth.js';
import { TripProvider } from './store/TripProvider.jsx';
import Login from './components/Login.jsx';
import App from './components/App.jsx';
import './styles/app.css';

function Root() {
  const { user, loading, login, logout } = useAuth();
  const [loginError, setLoginError] = useState('');

  if (loading) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <p className="muted">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        error={loginError}
        onLogin={async () => {
          setLoginError('');
          try {
            await login();
          } catch (e) {
            setLoginError('Não foi possível entrar: ' + e.message);
          }
        }}
      />
    );
  }

  return (
    <TripProvider uid={user.uid}>
      <App user={user} onLogout={logout} />
    </TripProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
