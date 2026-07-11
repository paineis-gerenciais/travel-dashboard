import { useState } from 'react';
import { gmaps } from '../domain/transport.js';

// Editor de rota (item N4): recebe os pontos sugeridos do dia e deixa o usuário
// incluir, excluir e reordenar antes de abrir no Google Maps. O estado é local
// (não persiste) — respeita o critério de não tocar no modelo de dados.
export default function RouteEditorModal({ title, initialPoints, onClose }) {
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Editar rota" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <h3>Rota — {title}</h3>
          <button className="ghost" onClick={onClose}>Fechar</button>
        </div>
        <p className="hint">Reordene, remova ou adicione paradas. A ordem abaixo é a ordem da rota.</p>

        {points.length === 0 ? (
          <p className="empty">Nenhuma parada. Adicione ao menos uma abaixo.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {points.map((p, i) => (
              <li key={p.id} className="map-point" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge">{i + 1}</span>
                <span style={{ flex: 1 }}>{p.label}</span>
                <button className="small-btn ghost" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="small-btn ghost" aria-label="Descer" disabled={i === points.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="small-btn danger" aria-label="Remover" onClick={() => remove(i)}>✕</button>
              </li>
            ))}
          </ul>
        )}

        <div className="toolbar" style={{ marginTop: 12 }}>
          <input
            className="wide"
            placeholder="Adicionar parada (ex.: Torre de Belém)"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="ghost" onClick={add}>Adicionar</button>
        </div>

        <div className="toolbar" style={{ marginTop: 4 }}>
          <a
            className="linkbtn"
            target="_blank"
            rel="noreferrer"
            href={url}
            aria-disabled={points.length === 0}
            onClick={(e) => { if (points.length === 0) e.preventDefault(); }}
          >
            Abrir no Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
