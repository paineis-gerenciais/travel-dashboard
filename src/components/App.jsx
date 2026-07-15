import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { useTrips } from '../store/TripsProvider.jsx';
import PresenceBar from './PresenceBar.jsx';

// 5 destinos. Nada além disto na navegação principal (Fase R2).
const Dias = lazy(() => import('./screens/Dias.jsx'));
const Cidades = lazy(() => import('./screens/Cidades.jsx'));
const Mapa = lazy(() => import('./screens/Mapa.jsx'));
const Custos = lazy(() => import('./screens/Custos.jsx'));
const Mais = lazy(() => import('./screens/Mais.jsx'));

const TABS = [
  ['dias', '🗓️', 'Dias', Dias],
  ['cidades', '📍', 'Cidades', Cidades],
  ['mapa', '🗺️', 'Mapa', Mapa],
  ['custos', '💰', 'Custos', Custos],
  ['mais', '⋯', 'Mais', Mais],
];

const TAB_KEY = 'trip_active_tab';

export default function App({ user, onLogout, theme, toggleTheme }) {
  const { tripName, dirty, state } = useTrip();
  const { activeTripId } = useTrips();
  const mainRef = useRef(null);

  // F5 mantém a tela atual (item 5.1 do plano mestre).
  const [active, setActive] = useState(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      return TABS.some((t) => t[0] === saved) ? saved : 'dias';
    } catch { return 'dias'; }
  });

  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, active); } catch { /* ignore */ }
  }, [active]);

  const ActiveComponent = TABS.find((t) => t[0] === active)[3];
  const title = tripName || state.settings.title || 'Viagem';

  const navigate = (id) => {
    setActive(id);
    // a rolagem agora vive no <main> (app-shell), não na janela
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-shell">
      <header className="appbar">
        <div className="container">
          <div className="appbar-title">
            <h1>{title}</h1>
            <span className="tiny t3">{dirty ? 'Salvando…' : 'Salvo'}</span>
          </div>
          <PresenceBar />
        </div>
      </header>

      <nav className="tabbar" aria-label="Navegação principal">
        {TABS.map(([id, icon, label]) => (
          <button
            key={id}
            aria-current={active === id ? 'page' : undefined}
            aria-label={label}
            onClick={() => navigate(id)}
          >
            <span className="tab-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main ref={mainRef}>
        <Suspense fallback={<div className="container screen"><p className="t2">Carregando…</p></div>}>
          <ActiveComponent
            user={user}
            tripId={activeTripId}
            onNavigate={navigate}
            theme={theme}
            toggleTheme={toggleTheme}
            onLogout={onLogout}
          />
        </Suspense>
      </main>
    </div>
  );
}
