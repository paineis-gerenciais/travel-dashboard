import { useState } from 'react';
import { useTrips } from '../store/TripsProvider.jsx';
import { blankState, SUBTITLES } from '../domain/state.js';

// Modelo de exemplo (item 4.2): 7 dias, 2 cidades, para o usuário ver o app
// preenchido em vez de encarar o branco. As datas começam daqui a 30 dias.
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
    { id: 'tpl_a', city: 'Lisboa', emoji: '🇵🇹', start: iso(d0), end: iso(d4), hotel: 'Hotel Centro', nightly: 400, status: 'Reservado', notes: 'Exemplo — ajuste à vontade' },
    { id: 'tpl_b', city: 'Porto', emoji: '🍷', start: iso(d4), end: iso(d7), hotel: 'Pousada Ribeira', nightly: 350, status: 'Planejado', notes: '' },
  ];
  return s;
}

export default function TripPicker({ onLogout, theme, toggleTheme, palette, togglePalette }) {
  const { trips, user, actions } = useTrips();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const create = async (seed) => {
    setBusy(true);
    try {
      await actions.createTrip(name.trim() || (seed ? 'Viagem exemplo' : 'Nova viagem'), seed);
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
              <button aria-label="Alternar paleta de cores" onClick={togglePalette}>
                {palette === 'minimalista' ? '🌈 Colorido' : '⬛ Minimalista'}
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
              <button onClick={() => create()} disabled={busy}>Criar viagem</button>
              <button className="ghost" onClick={() => create(templateState())} disabled={busy}>
                Começar de um modelo (7 dias, 2 cidades)
              </button>
            </div>

            {trips.length === 0 ? (
              <div className="card" style={{ marginTop: 8 }}>
                <h3>Como funciona</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Cadastre <b>cidades com datas</b> de check-in e check-out — o app organiza o resto
                  (roteiro, alimentação, atrações e custos) automaticamente. Quer ver preenchido
                  antes? Toque em <b>Começar de um modelo</b> acima.
                </p>
              </div>
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
