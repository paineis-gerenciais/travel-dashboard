import { useState, useEffect } from 'react';
import { createInvite, listMembers, listInvitesForTrip, revokeMember, cancelInvite } from '../lib/tripData.js';
import { Row, EmptyState } from './ui.jsx';

/** Conteúdo de "compartilhar". Renderiza dentro de um Sheet (sem chrome próprio). */
export default function ShareModal({ tripId, tripName, user, isOwner }) {
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
    } catch (e) { setError('Não foi possível carregar os membros: ' + e.message); }
  };
  useEffect(() => { refresh(); }, [tripId]);

  const invite = async () => {
    setError(''); setMsg('');
    if (!email.trim()) { setError('Informe um e-mail.'); return; }
    setBusy(true);
    try {
      await createInvite(tripId, tripName, user, email);
      setMsg(`Convite criado para ${email.trim().toLowerCase()}. Avise a pessoa — o acesso aparece quando ela entrar com esse e-mail.`);
      setEmail('');
      await refresh();
    } catch (e) { setError('Falha ao convidar: ' + e.message); }
    finally { setBusy(false); }
  };

  const pendentes = invites.filter((i) => i.status === 'pendente');

  return (
    <div className="stack">
      {isOwner ? (
        <>
          <p className="small t2" style={{ margin: 0 }}>
            Convide pelo e-mail da conta Google. O app não envia e-mail — avise a pessoa por fora.
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <input type="email" placeholder="email@exemplo.com" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invite()} />
            <button className="btn-primary" onClick={invite} disabled={busy}>Convidar</button>
          </div>
        </>
      ) : (
        <p className="small t2">Só o dono da viagem pode convidar ou remover pessoas.</p>
      )}

      {msg && <p className="small" style={{ color: 'var(--ok)' }} role="status">{msg}</p>}
      {error && <p className="small" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}

      <h3 style={{ margin: 0 }}>Com acesso</h3>
      <div className="card card-flush">
        {members.map((m) => (
          <Row key={m.uid} icon={m.role === 'owner' ? '👑' : '🤝'}
            title={m.displayName || m.email} sub={`${m.email} · ${m.role === 'owner' ? 'Dono' : 'Editor'}`}>
            {isOwner && m.role !== 'owner' && (
              <button className="btn-danger btn-sm" onClick={async () => { await revokeMember(tripId, m.uid); await refresh(); }}>
                Remover
              </button>
            )}
          </Row>
        ))}
      </div>

      {isOwner && pendentes.length > 0 && (
        <>
          <h3 style={{ margin: 0 }}>Convites pendentes</h3>
          <div className="card card-flush">
            {pendentes.map((c) => (
              <Row key={c.id} icon="✉️" title={c.emailConvidado} sub="Aguardando o primeiro login">
                <button className="btn-danger btn-sm" onClick={async () => { await cancelInvite(c.id); await refresh(); }}>
                  Cancelar convite
                </button>
              </Row>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
