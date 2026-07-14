import { useState, useEffect } from 'react';
import { subscribeActivity } from '../lib/tripData.js';

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min atrás`;
  if (s < 86400) return `${Math.floor(s / 3600)} h atrás`;
  return `${Math.floor(s / 86400)} d atrás`;
}

/** Rethink 5.F — feed de atividade: o que mudou na viagem enquanto você estava fora. */
export default function ActivityFeed({ tripId }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!tripId) return;
    return subscribeActivity(tripId, setEvents);
  }, [tripId]);

  if (events.length === 0) return null;

  return (
    <div className="card">
      <h3>Atividade recente</h3>
      <div style={{ display: 'grid', gap: 6 }}>
        {events.map((e) => (
          <p key={e.id} style={{ margin: 0, fontSize: 13 }}>
            <b>{e.authorName}</b> {e.text}
            <span className="muted" style={{ marginLeft: 6 }}>· {timeAgo(e.createdAtMs)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
