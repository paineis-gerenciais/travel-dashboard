import { useState } from 'react';
import { useTrips } from '../store/TripsProvider.jsx';
import { blankState, SUBTITLES } from '../domain/state.js';
import { randomQuote } from '../lib/quotes.js';
import { Row, Sheet, EmptyState } from './ui.jsx';
import SettingsSheet from './SettingsSheet.jsx';

function templateState() {
  const base = new Date();
  base.setDate(base.getDate() + 30);
  const iso = (d) => d.toISOString().slice(0, 10);
  const d0 = new Date(base);
  const d4 = new Date(base); d4.setDate(d4.getDate() + 4);
  const d7 = new Date(base); d7.setDate(d7.getDate() + 7);
  const s = blankState();
  s.settings.subtitle = SUBTITLES[0];
  s.cities = [
    { id: 'tpl_a', city: 'Lisboa', emoji: '🇵🇹', start: iso(d0), end: iso(d4), hotel: 'Hotel Centro', nightly: 400, status: 'Reservado', notes: '', breakfastIncluded: true },
    { id: 'tpl_b', city: 'Porto', emoji: '🍷', start: iso(d4), end: iso(d7), hotel: 'Pousada Ribeira', nightly: 350, status: 'Planejado', notes: '', breakfastIncluded: false },
  ];
  return s;
}

/** Nome de exibição com fallback: nome cadastrado → e-mail → celular → "Viajante". */
function greetingName(user) {
  return user.displayName || user.email || user.phoneNumber || 'Viajante';
}

export default function TripPicker({ onLogout, theme, toggleTheme, refreshUser }) {
  const { trips, user, actions } = useTrips();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  // sorteia uma vez por visita à tela, não a cada re-render
  const [quote] = useState(randomQuote);

  const create = async (seed) => {
    setBusy(true);
    try {
      await actions.createTrip(name.trim() || (seed ? 'Viagem exemplo' : 'Nova viagem'), seed);
      setName('');
    } finally { setBusy(false); }
  };

  const closeSettings = () => {
    setShowSettings(false);
    refreshUser?.(); // reflete nome/celular/e-mail vinculados sem precisar relogar
  };

  return (
    <>
      <header className="appbar">
        <div className="container">
          <h1>Minhas viagens</h1>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button className="btn-ghost btn-sm" aria-label="Configurações" onClick={() => setShowSettings(true)}>
              ⚙️
            </button>
            <button className="btn-ghost btn-sm" aria-label="Alternar tema" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="btn-ghost btn-sm" onClick={onLogout}>Sair</button>
          </div>
        </div>
      </header>

      <div className="screen">
        <div className="container stack">
          <div className="card" style={{ background: 'var(--accent-soft)', border: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--fs-4)', fontWeight: 600 }}>
              Olá {greetingName(user)}, bem-vindo ao seu planejador de viagens!
            </p>
            <p className="small t2" style={{ margin: '6px 0 0', fontStyle: 'italic' }}>{quote}</p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <input
              placeholder="Nome da viagem"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <button className="btn-primary" onClick={() => create()} disabled={busy}>Criar</button>
          </div>

          {trips.length === 0 ? (
            <EmptyState
              title="Comece sua primeira viagem"
              action={<button onClick={() => create(templateState())} disabled={busy}>Começar de um modelo</button>}
            >
              Cadastre cidades com datas e o app organiza o resto: dias, roteiro, custos e checklist.
            </EmptyState>
          ) : (
            <div className="card card-flush">
              {trips.map((t) => {
                const isOwner = t.ownerId === user.uid;
                return (
                  <Row
                    key={t.id}
                    icon={isOwner ? '🧳' : '🤝'}
                    title={t.name}
                    sub={isOwner ? `Você é o dono · ${t.memberUids.length} ${t.memberUids.length === 1 ? 'membro' : 'membros'}` : `Compartilhada por ${t.ownerEmail || 'outra pessoa'}`}
                    value={<button className="btn-sm" onClick={() => actions.openTrip(t.id)}>Abrir</button>}
                  >
                    {isOwner && (
                      <>
                        <button className="btn-ghost btn-sm" onClick={() => {
                          const novo = prompt('Novo nome da viagem:', t.name);
                          if (novo && novo.trim()) actions.renameTrip(t.id, novo.trim());
                        }}>Renomear</button>
                        <button className="btn-danger btn-sm" onClick={() => setConfirmDel(t)}>Excluir</button>
                      </>
                    )}
                  </Row>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showSettings && <SettingsSheet user={user} onClose={closeSettings} />}

      {confirmDel && (
        <Sheet title="Excluir viagem" onClose={() => setConfirmDel(null)}>
          <p>
            Excluir <b>{confirmDel.name}</b> apaga a viagem e todas as versões salvas dela, para
            todos os membros. Esta ação não pode ser desfeita.
          </p>
          <div className="stack-2">
            <button className="btn-danger btn-block" onClick={async () => { await actions.deleteTrip(confirmDel.id); setConfirmDel(null); }}>
              Excluir definitivamente
            </button>
            <button className="btn-ghost btn-block" onClick={() => setConfirmDel(null)}>Cancelar</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
