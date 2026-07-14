import { useState, useEffect } from 'react';
import { subscribeComments, addComment, deleteComment } from '../lib/tripData.js';
import { useTrips } from '../store/TripsProvider.jsx';

/**
 * Rethink 5.F — colaboração como cidadã de primeira classe. Um ícone de balão
 * com contador ao lado de cada item; ao clicar, expande uma thread curta de
 * comentários daquele item específico. Os dados vivem em
 * trips/{tripId}/comments, isolados por viagem (ver firestore.rules).
 */
export default function CommentThread({ tripId, itemKey }) {
  const { user } = useTrips();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!tripId || !itemKey) return;
    return subscribeComments(tripId, itemKey, setComments);
  }, [tripId, itemKey]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await addComment(tripId, itemKey, user, t);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="small-btn ghost"
        aria-label={comments.length ? `${comments.length} comentário(s)` : 'Comentar'}
        onClick={() => setOpen((v) => !v)}
      >
        💬{comments.length > 0 ? ` ${comments.length}` : ''}
      </button>
      {open && (
        <div
          className="card"
          style={{ position: 'absolute', right: 0, top: '110%', width: 260, zIndex: 30, padding: 10 }}
        >
          {comments.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>Nenhum comentário ainda.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6, marginBottom: 8, maxHeight: 160, overflowY: 'auto' }}>
              {comments.map((c) => (
                <div key={c.id} style={{ fontSize: 12 }}>
                  <b>{c.authorName}:</b> {c.text}
                  {c.authorUid === user.uid && (
                    <button
                      className="small-btn ghost"
                      style={{ marginLeft: 6, padding: '1px 6px' }}
                      onClick={() => deleteComment(tripId, c.id)}
                    >
                      excluir
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              placeholder="Comentar..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              style={{ fontSize: 12 }}
            />
            <button className="small-btn" onClick={send}>Enviar</button>
          </div>
        </div>
      )}
    </span>
  );
}
