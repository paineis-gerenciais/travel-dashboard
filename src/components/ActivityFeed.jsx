import { useState, useEffect } from 'react';
import { subscribeActivity } from '../lib/tripData.js';
import { Row } from './ui.jsx';

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

/** O que mudou na viagem enquanto você estava fora. */
export default function ActivityFeed({ tripId }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!tripId) return;
    return subscribeActivity(tripId, setEvents);
  }, [tripId]);

  if (events.length === 0) return null;

  return (
    <div className="card card-flush">
      <div style={{ padding: 'var(--sp-4) var(--sp-4) 0' }}>
        <h3>Atividade recente</h3>
      </div>
      {events.slice(0, 6).map((e) => (
        <Row
          key={e.id}
          icon="🔔"
          title={e.authorName}
          sub={e.text}
          value={<span className="tiny t3">{timeAgo(e.createdAtMs)}</span>}
        />
      ))}
    </div>
  );
}
