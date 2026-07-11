import { useState, useRef, useEffect, lazy } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { useTrips } from '../store/TripsProvider.jsx';
import { normalizeState } from '../domain/state.js';
import { mainCities } from '../domain/dates.js';
import { logError } from '../lib/logger.js';
import VersionsModal from './VersionsModal.jsx';
import ShareModal from './ShareModal.jsx';
import DiagnosticsModal from './DiagnosticsModal.jsx';
import PresenceBar from './PresenceBar.jsx';

// Code-splitting (item 3.8): as 10 telas são carregadas sob demanda.
const Resumo = lazy(() => import('./screens/Resumo.jsx'));
const Roteiro = lazy(() => import('./screens/Roteiro.jsx'));
const Mapa = lazy(() => import('./screens/Mapa.jsx'));
const Cidades = lazy(() => import('./screens/Cidades.jsx'));
const Transporte = lazy(() => import('./screens/Transporte.jsx'));
const Alimentacao = lazy(() => import('./screens/Alimentacao.jsx'));
const Atracoes = lazy(() => import('./screens/Atracoes.jsx'));
const Outras = lazy(() => import('./screens/Outras.jsx'));
const Checklist = lazy(() => import('./screens/Checklist.jsx'));
const Custos = lazy(() => import('./screens/Custos.jsx'));

const TABS = [
  ['resumo', '🏠', 'Resumo', Resumo],
  ['roteiro', '🗓️', 'Roteiro', Roteiro],
  ['mapa', '🗺️', 'Mapa', Mapa],
  ['cidades', '📍', 'Cidades', Cidades],
  ['transporte', '🚆', 'Transporte', Transporte],
  ['alimentacao', '🍽️', 'Alimentação', Alimentacao],
  ['atracoes', '🎟️', 'Atrações', Atracoes],
  ['outras', '💼', 'Outras', Outras],
  ['checklist', '✅', 'Checklist', Checklist],
  ['custos', '💰', 'Custos', Custos],
];

export default function App({ user, onLogout, theme, toggleTheme }) {
  const { state, tripName, dirty, actions } = useTrip();
  const { activeTripId, trips, actions: tripsActions } = useTrips();
  const [active, setActive] = useState('resumo');
  const [modal, setModal] = useState(null); // 'versions' | 'share' | 'clear' | 'diag' | null
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef(null);
  const navRef = useRef(null);
  const ActiveComponent = TABS.find((t) => t[0] === active)[3];
  const title = tripName || state.settings.title || 'Planejamento da Viagem';
  const activeTrip = trips.find((t) => t.id === activeTripId);
  const isOwner = activeTrip ? activeTrip.ownerId === user.uid : true;

  // Fechar modal/menu com Esc (acessibilidade — item 3.5)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setModal(null); setMenuOpen(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Mantém a aba ativa visível na navegação mobile (item 4.7)
  useEffect(() => {
    const el = navRef.current?.querySelector('button.active');
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  const exportJSON = () => {
    try {
      const cityName = (mainCities(state)[0] || 'sem-cidade').replace(/\s+/g, '-');
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dados-viagem-${cityName}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { logError('exportJSON', e); }
  };

  const importJSON = (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.cities)) throw new Error('Estrutura inválida');
        if (confirm('Importar dados e substituir o conteúdo desta viagem?')) {
          actions.replaceState(normalizeState(obj));
          setActive('resumo');
        }
      } catch (e) { logError('importJSON', e); alert('Arquivo JSON inválido.'); }
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div data-screen={active}>
      <header>
        <div className="container">
          <h1>
            {title}
            <span className={`save-badge${dirty ? ' saving' : ''}`} role="status" aria-live="polite">
              <span className="dot" aria-hidden="true" />
              {dirty ? 'Salvando…' : 'Salvo'}
            </span>
          </h1>
          <p className="subtitle">{state.settings.subtitle}</p>
          <div className="topbar">
            <nav className="nav" aria-label="Navegação principal" ref={navRef}>
              {TABS.map(([id, icon, label]) => (
                <button
                  key={id}
                  className={active === id ? 'active' : ''}
                  aria-label={label}
                  aria-current={active === id ? 'page' : undefined}
                  onClick={() => { setActive(id); closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  <span aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <button
              className="linkbtn more-menu"
              aria-label="Mais ações"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯ Ações
            </button>
            <div className={`actions${menuOpen ? ' open' : ''}`}>
              <button onClick={() => { tripsActions.closeTrip(); closeMenu(); }}>← Minhas viagens</button>
              <button onClick={() => { setModal('share'); closeMenu(); }}>Compartilhar</button>
              <button onClick={() => { setModal('versions'); closeMenu(); }}>Versões</button>
              <button onClick={() => { exportJSON(); closeMenu(); }}>Exportar JSON</button>
              <button onClick={() => { fileRef.current.click(); closeMenu(); }}>Importar JSON</button>
              <button onClick={() => { window.print(); closeMenu(); }}>Imprimir</button>
              <button aria-label="Alternar tema claro/escuro" onClick={toggleTheme}>
                {theme === 'dark' ? '☀️ Claro' : '🌙 Escuro'}
              </button>
              <button onClick={() => { setModal('diag'); closeMenu(); }}>Diagnóstico</button>
              <button className="danger" onClick={() => { setModal('clear'); closeMenu(); }}>Limpar</button>
              <button onClick={() => { closeMenu(); onLogout(); }}>Sair</button>
              <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importJSON} />
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="container">
          <PresenceBar />
          <ActiveComponent userEmail={user?.email} onNavigate={(id) => { setActive(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>
      </main>

      {modal === 'versions' && <VersionsModal tripId={activeTripId} onClose={() => setModal(null)} />}
      {modal === 'share' && (
        <ShareModal tripId={activeTripId} tripName={title} user={user} isOwner={isOwner} onClose={() => setModal(null)} />
      )}
      {modal === 'diag' && <DiagnosticsModal onClose={() => setModal(null)} />}
      {modal === 'clear' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Limpar viagem" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <h3>Limpar viagem</h3>
              <button className="ghost" onClick={() => setModal(null)}>Fechar</button>
            </div>
            <p>
              Isso apaga o conteúdo atual desta viagem (cidades, custos, checklist) para você
              recomeçar do zero. As <b>versões salvas continuam intactas</b> e as outras viagens não
              são afetadas.
            </p>
            <div className="toolbar">
              <button className="danger" onClick={() => { actions.clearCurrent(); setModal(null); setActive('resumo'); }}>
                Limpar esta viagem
              </button>
              <button className="ghost" onClick={() => setModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
