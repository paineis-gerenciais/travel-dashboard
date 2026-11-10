import { useState, useEffect } from 'react';
import { createInvite, listMembers, listInvitesForTrip, revokeMember, cancelInvite } from '../lib/tripData.js';
import { inviteMessage, whatsappUrl, mailtoUrl, nativeShare, copyToClipboard } from '../lib/invite.js';
import { useTrips } from '../store/TripsProvider.jsx';
import { Row, Banner, Sheet } from './ui.jsx';

/** Conteúdo de "compartilhar". Renderiza dentro de um Sheet (sem chrome próprio). */
export default function ShareModal({ tripId, tripName, user, isOwner }) {
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sendTo, setSendTo] = useState(null); // e-mail do convite a enviar
  // Quem tem acesso vem de `memberUids` da viagem (a fonte que as regras usam);
  // `members/` só completa nome e e-mail.
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const ownerId = trip?.ownerId;
  const memberUids = trip?.memberUids || [];

  const refresh = async () => {
    try {
      setMembers(await listMembers(tripId));
      if (isOwner) setInvites(await listInvitesForTrip(tripId, user.uid));
    } catch (e) { setError('Não foi possível carregar os membros: ' + e.message); }
  };
  useEffect(() => { refresh(); }, [tripId]);

  const invite = async () => {
    setError('');
    const e = email.trim().toLowerCase();
    if (!e) { setError('Informe um e-mail.'); return; }
    // Quem já está na viagem não recebe convite de novo: reabrir o convite
    // aceito deixaria um convite pendente "dormente" para essa pessoa.
    if (invites.some((i) => i.emailConvidado === e && i.status === 'aceito' && memberUids.includes(i.acceptedByUid))) {
      setError('Essa pessoa já tem acesso à viagem.');
      return;
    }
    setBusy(true);
    try {
      await createInvite(tripId, tripName, user, e);
      setEmail('');
      await refresh();
      setSendTo(e); // abre direto a folha de envio: criar sem avisar não serve de nada
    } catch (err) { setError('Falha ao convidar: ' + err.message); }
    finally { setBusy(false); }
  };

  // O e-mail do convite aceito é a fonte mais confiável (o próprio perfil é editável pelo membro).
  const emailDoConvite = (uid) => invites.find((i) => i.acceptedByUid === uid)?.emailConvidado;

  const pendentes = invites.filter((i) => i.status === 'pendente');

  return (
    <div className="stack">
      {isOwner ? (
        <>
          <p className="small t2" style={{ margin: 0 }}>
            Convide pelo e-mail da conta Google. O acesso aparece quando a pessoa entrar no app com
            esse e-mail — e você escolhe como avisá-la.
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <input
              type="email" placeholder="email@exemplo.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
            />
            <button className="btn-primary" onClick={invite} disabled={busy}>Convidar</button>
          </div>
        </>
      ) : (
        <p className="small t2">Só o dono da viagem pode convidar ou remover pessoas.</p>
      )}

      {error && <p className="small" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}

      <h3 style={{ margin: 0 }}>Com acesso</h3>
      <div className="card card-flush">
        {memberUids.map((uid) => {
          const m = members.find((x) => x.uid === uid);
          const souDono = uid === ownerId;
          const titulo = m ? (m.displayName || m.email || 'Membro sem perfil') : 'Membro sem perfil';
          const sub = `${m?.email ? m.email + ' · ' : ''}${souDono ? 'Dono' : 'Editor'}`;
          return (
            <Row key={uid} icon={souDono ? '👑' : '🤝'} title={titulo} sub={sub}>
              {isOwner && !souDono && (
                <button className="btn-danger btn-sm" onClick={async () => {
                  // Só o e-mail do convite aceito por este uid: o e-mail do perfil é
                  // editável pelo próprio membro e poderia apagar o convite de outra pessoa.
                  try { await revokeMember(tripId, uid, emailDoConvite(uid)); await refresh(); }
                  catch (err) { setError('Falha ao remover: ' + err.message); }
                }}>
                  Remover
                </button>
              )}
            </Row>
          );
        })}
      </div>

      {isOwner && pendentes.length > 0 && (
        <>
          <h3 style={{ margin: 0 }}>Convites pendentes</h3>
          <div className="card card-flush">
            {pendentes.map((c) => (
              <Row key={c.id} icon="✉️" title={c.emailConvidado} sub="Ainda não entrou no app">
                <button className="btn-sm" onClick={() => setSendTo(c.emailConvidado)}>Avisar</button>
                <button className="btn-danger btn-sm" onClick={async () => { await cancelInvite(c.id); await refresh(); }}>
                  Cancelar
                </button>
              </Row>
            ))}
          </div>
        </>
      )}

      {sendTo && (
        <SendInviteSheet
          email={sendTo}
          tripName={tripName}
          fromName={user.displayName || ''}
          onClose={() => setSendTo(null)}
        />
      )}
    </div>
  );
}

/** Como avisar a pessoa convidada. Tudo local — o app não envia nada sozinho. */
function SendInviteSheet({ email, tripName, fromName, onClose }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const text = inviteMessage(tripName, email, fromName);

  const doNative = async () => {
    const ok = await nativeShare(tripName, text);
    setShared(ok);
    if (!ok) setCopied(false);
  };

  const doCopy = async () => {
    const ok = await copyToClipboard(text);
    setCopied(ok);
  };

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <Sheet title="Avisar a pessoa" onClose={onClose}>
      <div className="stack">
        <Banner kind="info">
          Convite criado para <b>{email}</b>. Ela só ganha acesso ao entrar no app com essa conta
          Google — então é preciso avisá-la. Escolha por onde:
        </Banner>

        <div className="stack-2">
          <a className="btn btn-primary btn-block" href={whatsappUrl(text)} target="_blank" rel="noreferrer">
            💬 Enviar pelo WhatsApp
          </a>
          <a className="btn btn-block" href={mailtoUrl(email, tripName, text)}>
            ✉️ Enviar por e-mail
          </a>
          {hasNativeShare && (
            <button className="btn-block" onClick={doNative}>📤 Compartilhar…</button>
          )}
          <button className="btn-block" onClick={doCopy}>
            {copied ? '✅ Mensagem copiada' : '📋 Copiar mensagem'}
          </button>
        </div>

        {shared && <p className="small" style={{ color: 'var(--ok)' }}>Convite compartilhado.</p>}

        <div className="card" style={{ background: 'var(--surface-2)', border: 0 }}>
          <p className="small t2" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{text}</p>
        </div>

        <button className="btn-ghost btn-block" onClick={onClose}>Fechar</button>
      </div>
    </Sheet>
  );
}
