import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
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
    <div className="login-wrap">
      <div className="login-card"><p className="muted">{text}</p></div>
    </div>
  );
}

function Shell({ user, onLogout, theme, toggleTheme, palette, togglePalette }) {
  const { activeTripId, ready } = useTrips();
  if (!ready) return <Loading text="Carregando suas viagens…" />;
  if (!activeTripId) return <TripPicker onLogout={onLogout} theme={theme} toggleTheme={toggleTheme} palette={palette} togglePalette={togglePalette} />;
  return (
    <TripProvider tripId={activeTripId} user={user}>
      <Suspense fallback={<Loading text="Abrindo viagem…" />}>
        <App user={user} onLogout={onLogout} theme={theme} toggleTheme={toggleTheme} palette={palette} togglePalette={togglePalette} />
      </Suspense>
    </TripProvider>
  );
}

function Root() {
  const { user, loading, login, logout } = useAuth();
  const { theme, toggle, palette, togglePalette } = useTheme();
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
      <Shell user={user} onLogout={logout} theme={theme} toggleTheme={toggle} palette={palette} togglePalette={togglePalette} />
    </TripsProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
