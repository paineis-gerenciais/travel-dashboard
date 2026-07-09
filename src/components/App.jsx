import { useState, useRef } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { normalizeState } from '../domain/state.js';
import { mainCities } from '../domain/dates.js';
import VersionsModal from './VersionsModal.jsx';
import Resumo from './screens/Resumo.jsx';
import Roteiro from './screens/Roteiro.jsx';
import Mapa from './screens/Mapa.jsx';
import Cidades from './screens/Cidades.jsx';
import Transporte from './screens/Transporte.jsx';
import Alimentacao from './screens/Alimentacao.jsx';
import Atracoes from './screens/Atracoes.jsx';
import Outras from './screens/Outras.jsx';
import Checklist from './screens/Checklist.jsx';
import Custos from './screens/Custos.jsx';

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

export default function App({ user, onLogout }) {
  const { state, dirty, actions } = useTrip();
  const [active, setActive] = useState('resumo');
  const [showVersions, setShowVersions] = useState(false);
  const fileRef = useRef(null);
  const ActiveComponent = TABS.find((t) => t[0] === active)[3];
  const title = state.settings.title || 'Planejamento da Viagem';

  const exportJSON = () => {
    const cityName = (mainCities(state)[0] || 'sem-cidade').replace(/\s+/g, '-');
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dados-viagem-${cityName}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };

  const importJSON = (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.cities)) throw new Error('Estrutura inválida');
        if (confirm('Importar dados e substituir o dashboard atual?')) {
          actions.replaceState(normalizeState(obj));
          setActive('resumo');
        }
      } catch {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

  return (
    <div data-screen={active}>
      <header>
        <div className="container">
          <h1>
            {title}
            {dirty && <span className="dirty-dot" title="Salvando alterações…" />}
          </h1>
          <p className="subtitle">{state.settings.subtitle}</p>
          <div className="topbar">
            <nav className="nav" aria-label="Navegação principal">
              {TABS.map(([id, icon, label]) => (
                <button
                  key={id}
                  className={active === id ? 'active' : ''}
                  aria-label={label}
                  onClick={() => {
                    setActive(id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <span aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="actions">
              <button onClick={() => setShowVersions(true)}>Versões</button>
              <button onClick={exportJSON}>Exportar JSON</button>
              <button onClick={() => fileRef.current.click()}>Importar JSON</button>
              <button onClick={() => window.print()}>Imprimir</button>
              <button onClick={onLogout}>Sair</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={importJSON}
              />
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="container">
          <ActiveComponent userEmail={user?.email} />
        </div>
      </main>
      {showVersions && <VersionsModal uid={user.uid} onClose={() => setShowVersions(false)} />}
    </div>
  );
}
