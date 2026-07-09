import { useState, useEffect } from 'react';
import { createInvite, listMembers, listInvitesForTrip, revokeMember, cancelInvite } from '../lib/tripData.js';

export default function ShareModal({ tripId, tripName, user, isOwner, onClose }) {
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      setMembers(await listMembers(tripId));
      if (isOwner) setInvites(await listInvitesForTrip(tripId, user.uid));
    } catch (e) {
      setError('Não foi possível carregar os membros: ' + e.message);
    }
  };
  useEffect(() => { refresh(); }, [tripId]);

  const invite = async () => {
    setError(''); setMsg('');
    if (!email.trim()) { setError('Informe um e-mail.'); return; }
    setBusy(true);
    try {
      await createInvite(tripId, tripName, user, email);
      setMsg(`Convite criado para ${email.trim().toLowerCase()}. Avise a pessoa para entrar no app com esse e-mail — o acesso aparece quando ela logar.`);
      setEmail('');
      await refresh();
    } catch (e) {
      setError('Falha ao convidar: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const pendentes = invites.filter((i) => i.status === 'pendente');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Compartilhar "{tripName}"</h3>
          <button className="ghost" onClick={onClose}>Fechar</button>
        </div>

        {isOwner ? (
          <>
            <p className="hint">
              Convide alguém pelo e-mail da conta Google. O acesso é concedido quando a pessoa faz
              login no app com esse e-mail. O app não envia e-mail — avise a pessoa por fora.
            </p>
            <div className="toolbar">
              <input
                className="wide"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && invite()}
              />
              <button onClick={invite} disabled={busy}>Convidar</button>
            </div>
          </>
        ) : (
          <p className="hint">Só o dono da viagem pode convidar ou remover pessoas.</p>
        )}

        {msg && <p style={{ color: '#15803d' }} role="status">{msg}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        <h3 style={{ marginTop: 16 }}>Com acesso</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th></th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.uid}>
                  <td data-label="Nome">{m.displayName || '—'}</td>
                  <td data-label="E-mail">{m.email || '—'}</td>
                  <td data-label="Papel">{m.role === 'owner' ? 'Dono' : 'Editor'}</td>
                  <td>
                    {isOwner && m.role !== 'owner' && (
                      <button className="small-btn danger" onClick={async () => { await revokeMember(tripId, m.uid); await refresh(); }}>
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isOwner && pendentes.length > 0 && (
          <>
            <h3 style={{ marginTop: 16 }}>Convites pendentes</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>E-mail convidado</th><th></th></tr></thead>
                <tbody>
                  {pendentes.map((c) => (
                    <tr key={c.id}>
                      <td data-label="E-mail convidado">{c.emailConvidado}</td>
                      <td>
                        <button className="small-btn danger" onClick={async () => { await cancelInvite(c.id); await refresh(); }}>
                          Cancelar convite
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
