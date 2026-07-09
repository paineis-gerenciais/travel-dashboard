import { useState } from 'react';
import { useTrips } from '../store/TripsProvider.jsx';

export default function TripPicker({ onLogout, theme, toggleTheme }) {
  const { trips, user, actions } = useTrips();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const create = async () => {
    setBusy(true);
    try {
      await actions.createTrip(name.trim() || 'Nova viagem');
      setName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-screen="resumo">
      <header>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1>Minhas viagens</h1>
              <p className="subtitle">Escolha uma viagem para planejar, ou crie uma nova.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button aria-label="Alternar tema claro/escuro" onClick={toggleTheme}>
                {theme === 'dark' ? '☀️ Claro' : '🌙 Escuro'}
              </button>
              <button onClick={onLogout}>Sair</button>
            </div>
          </div>
        </div>
      </header>
      <main>
        <div className="container">
          <section>
            <div className="toolbar">
              <input
                className="wide"
                placeholder="Nome da nova viagem (ex.: Portugal 2026)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
              <button onClick={create} disabled={busy}>Criar viagem</button>
            </div>

            {trips.length === 0 ? (
              <p className="empty">Você ainda não tem viagens. Crie a primeira acima.</p>
            ) : (
              <div className="grid grid2">
                {trips.map((t) => {
                  const isOwner = t.ownerId === user.uid;
                  return (
                    <div className="card" key={t.id}>
                      <h3>{t.name}</h3>
                      <p className="muted" style={{ margin: '4px 0 12px' }}>
                        {isOwner ? '👑 Você é o dono' : `🤝 Compartilhada por ${t.ownerEmail || 'outro usuário'}`}
                        {' · '}
                        {t.memberUids.length} {t.memberUids.length === 1 ? 'membro' : 'membros'}
                      </p>
                      <div className="toolbar" style={{ marginBottom: 0 }}>
                        <button onClick={() => actions.openTrip(t.id)}>Abrir</button>
                        {isOwner && (
                          <button
                            className="ghost"
                            onClick={() => {
                              const novo = prompt('Novo nome da viagem:', t.name);
                              if (novo && novo.trim()) actions.renameTrip(t.id, novo.trim());
                            }}
                          >
                            Renomear
                          </button>
                        )}
                        {isOwner && (
                          <button className="danger" onClick={() => setConfirmDel(t)}>Excluir</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {confirmDel && (
        <div className="modal-backdrop" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Excluir viagem</h3>
              <button className="ghost" onClick={() => setConfirmDel(null)}>Fechar</button>
            </div>
            <p>
              Excluir <b>{confirmDel.name}</b> apaga a viagem e todas as versões salvas dela, para
              todos os membros. Esta ação não pode ser desfeita.
            </p>
            <div className="toolbar">
              <button className="danger" onClick={async () => { await actions.deleteTrip(confirmDel.id); setConfirmDel(null); }}>
                Excluir definitivamente
              </button>
              <button className="ghost" onClick={() => setConfirmDel(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
