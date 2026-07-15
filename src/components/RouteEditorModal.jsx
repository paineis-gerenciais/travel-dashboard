import { useState, useRef } from 'react';
import { gmaps } from '../domain/transport.js';
import { EmptyState } from './ui.jsx';

/**
 * Editor de rota: incluir, remover e REORDENAR paradas arrastando (em vez de
 * botões de subir/descer). Funciona no mouse (HTML5 drag) e no toque (eventos
 * de touch), reordenando a lista conforme a parada é arrastada sobre as outras.
 */
export default function RouteEditorModal({ initialPoints }) {
  const [points, setPoints] = useState(
    initialPoints.map((p, i) => ({ id: `p${i}`, label: p.label, query: p.query }))
  );
  const [novo, setNovo] = useState('');
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const touchInfo = useRef(null);

  const reorder = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setPoints((arr) => {
      const from = arr.findIndex((p) => p.id === fromId);
      const to = arr.findIndex((p) => p.id === toId);
      if (from < 0 || to < 0) return arr;
      const copy = [...arr];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  };

  const remove = (id) => setPoints((p) => p.filter((x) => x.id !== id));
  const add = () => {
    const v = novo.trim();
    if (!v) return;
    setPoints((p) => [...p, { id: `n${Date.now()}`, label: v, query: v }]);
    setNovo('');
  };

  // --- toque: descobre sobre qual item o dedo está e reordena ---
  const onTouchStart = (id) => { touchInfo.current = { id }; setDragId(id); };
  const onTouchMove = (e) => {
    if (!touchInfo.current) return;
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const li = el && el.closest('[data-stop-id]');
    const overTarget = li ? li.getAttribute('data-stop-id') : null;
    setOverId(overTarget);
    if (overTarget && overTarget !== touchInfo.current.id) {
      reorder(touchInfo.current.id, overTarget);
      touchInfo.current.id = touchInfo.current.id; // id segue o mesmo item
    }
  };
  const onTouchEnd = () => { touchInfo.current = null; setDragId(null); setOverId(null); };

  const url = gmaps(points.map((p) => p.query));

  return (
    <div className="stack">
      <p className="small t2" style={{ margin: 0 }}>
        A ordem abaixo é a ordem da rota. Arraste pela alça <span aria-hidden="true">⠿</span> para reordenar.
      </p>

      {points.length === 0 ? (
        <EmptyState title="Nenhuma parada">Adicione ao menos uma parada abaixo.</EmptyState>
      ) : (
        <div className="card card-flush">
          {points.map((p, i) => (
            <div
              key={p.id}
              data-stop-id={p.id}
              className={'row' + (overId === p.id ? ' stop-over' : '') + (dragId === p.id ? ' stop-dragging' : '')}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => { e.preventDefault(); setOverId(p.id); if (dragId) reorder(dragId, p.id); }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
            >
              <span
                className="stop-handle"
                aria-label="Arraste para reordenar"
                onTouchStart={() => onTouchStart(p.id)}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ touchAction: 'none', cursor: 'grab', fontSize: 20, color: 'var(--text-3)', padding: '0 4px' }}
              >
                ⠿
              </span>
              <span className="row-icon" aria-hidden="true">{i + 1}</span>
              <div className="row-main"><span className="row-title">{p.label}</span></div>
              <button className="btn-danger btn-sm" aria-label="Remover parada" onClick={() => remove(p.id)}>✕</button>
            </div>
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
