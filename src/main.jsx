import React, { Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth } from './store/useAuth.js';
import { useTheme } from './store/useTheme.js';
import { TripsProvider, useTrips } from './store/TripsProvider.jsx';
import { TripProvider } from './store/TripProvider.jsx';
import { installGlobalErrorHandlers } from './lib/logger.js';
import Login from './components/Login.jsx';
import App from './components/App.jsx';
import TripPicker from './components/TripPicker.jsx';
import './styles/app.css';

installGlobalErrorHandlers();

function Loading({ text = 'Carregando…' }) {
  return (
    <div className="container screen">
      <p className="t2">{text}</p>
    </div>
  );
}

function Shell({ user, onLogout, theme, toggleTheme }) {
  const { activeTripId, ready } = useTrips();
  if (!ready) return <Loading text="Carregando suas viagens…" />;
  if (!activeTripId) return <TripPicker onLogout={onLogout} theme={theme} toggleTheme={toggleTheme} />;
  return (
    <TripProvider tripId={activeTripId} user={user}>
      <Suspense fallback={<Loading text="Abrindo viagem…" />}>
        <App user={user} onLogout={onLogout} theme={theme} toggleTheme={toggleTheme} />
      </Suspense>
    </TripProvider>
  );
}

function Root() {
  const { user, loading, login, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [loginError, setLoginError] = useState('');

  if (loading) return <Loading />;
  if (!user) {
    return (
      <Login
        error={loginError}
        onLogin={async () => {
          setLoginError('');
          try { await login(); } catch (e) { setLoginError('Não foi possível entrar: ' + e.message); }
        }}
      />
    );
  }
  return (
    <TripsProvider user={user}>
      <Shell user={user} onLogout={logout} theme={theme} toggleTheme={toggle} />
    </TripsProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
