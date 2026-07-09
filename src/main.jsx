import React from 'react';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useAuth } from './store/useAuth.js';
import { TripsProvider, useTrips } from './store/TripsProvider.jsx';
import { TripProvider } from './store/TripProvider.jsx';
import Login from './components/Login.jsx';
import App from './components/App.jsx';
import TripPicker from './components/TripPicker.jsx';
import './styles/app.css';

function Loading({ text = 'Carregando…' }) {
  return (
    <div className="login-wrap">
      <div className="login-card"><p className="muted">{text}</p></div>
    </div>
  );
}

// Dentro do TripsProvider: mostra o seletor de viagens ou a viagem ativa.
function Shell({ user, onLogout }) {
  const { activeTripId, ready } = useTrips();
  if (!ready) return <Loading text="Carregando suas viagens…" />;
  if (!activeTripId) return <TripPicker />;
  return (
    <TripProvider tripId={activeTripId} user={user}>
      <App user={user} onLogout={onLogout} />
    </TripProvider>
  );
}

function Root() {
  const { user, loading, login, logout } = useAuth();
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
      <Shell user={user} onLogout={logout} />
    </TripsProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
