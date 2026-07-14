import { useState, useEffect } from 'react';
import { subscribeComments, addComment, deleteComment } from '../lib/tripData.js';
import { useTrips } from '../store/TripsProvider.jsx';
import { Sheet, EmptyState } from './ui.jsx';

/** Comentários por item — conversa com quem compartilha a viagem. */
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
    <>
      <button
        className="btn-ghost btn-sm"
        aria-label={comments.length ? `${comments.length} comentário(s)` : 'Comentar'}
        onClick={() => setOpen(true)}
      >
        💬{comments.length > 0 ? ` ${comments.length}` : ''}
      </button>

      {open && (
        <Sheet title="Comentários" onClose={() => setOpen(false)}>
          <div className="stack">
            {comments.length === 0 ? (
              <EmptyState title="Sem comentários">Escreva o primeiro abaixo.</EmptyState>
            ) : (
              <div className="stack-2">
                {comments.map((c) => (
                  <div key={c.id} className="card" style={{ padding: 'var(--sp-3)' }}>
                    <div className="row-between">
                      <b className="small">{c.authorName}</b>
                      {c.authorUid === user.uid && (
                        <button className="btn-ghost btn-sm" onClick={() => deleteComment(tripId, c.id)}>Excluir</button>
                      )}
                    </div>
                    <p className="small" style={{ margin: 0 }}>{c.text}</p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <input placeholder="Escrever comentário" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
              <button className="btn-primary" onClick={send}>Enviar</button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
