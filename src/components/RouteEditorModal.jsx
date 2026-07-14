import { useState } from 'react';
import { gmaps } from '../domain/transport.js';
import { Row, EmptyState } from './ui.jsx';

/** Editor de rota: incluir, remover e reordenar paradas antes de abrir no Google Maps. */
export default function RouteEditorModal({ initialPoints }) {
  const [points, setPoints] = useState(
    initialPoints.map((p, i) => ({ id: `p${i}`, label: p.label, query: p.query }))
  );
  const [novo, setNovo] = useState('');

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= points.length) return;
    const arr = [...points];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setPoints(arr);
  };
  const remove = (idx) => setPoints((p) => p.filter((_, i) => i !== idx));
  const add = () => {
    const v = novo.trim();
    if (!v) return;
    setPoints((p) => [...p, { id: `n${Date.now()}`, label: v, query: v }]);
    setNovo('');
  };

  const url = gmaps(points.map((p) => p.query));

  return (
    <div className="stack">
      <p className="small t2" style={{ margin: 0 }}>A ordem abaixo é a ordem da rota.</p>

      {points.length === 0 ? (
        <EmptyState title="Nenhuma parada">Adicione ao menos uma parada abaixo.</EmptyState>
      ) : (
        <div className="card card-flush">
          {points.map((p, i) => (
            <Row key={p.id} icon={String(i + 1)} title={p.label}>
              <button className="btn-ghost btn-sm" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="btn-ghost btn-sm" aria-label="Descer" disabled={i === points.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button className="btn-danger btn-sm" aria-label="Remover" onClick={() => remove(i)}>✕</button>
            </Row>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <input placeholder="Adicionar parada" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add}>Adicionar</button>
      </div>

      <a
        className="btn btn-primary btn-block"
        target="_blank"
        rel="noreferrer"
        href={url}
        onClick={(e) => { if (points.length === 0) e.preventDefault(); }}
      >
        Abrir no Google Maps
      </a>
    </div>
  );
}
