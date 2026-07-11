import { useState } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate } from '../../domain/format.js';
import { allPlanningDates, inferCityForDate } from '../../domain/dates.js';
import {
  getTransportDate,
  getTransportOrigin,
  getTransportDest,
  getTransportDurationMinutes,
  minutesToLabel,
} from '../../domain/transport.js';
import RouteEditorModal from '../RouteEditorModal.jsx';

// Pontos de um dia (hospedagem + transportes + atrações), como sugestão inicial
// para o editor de rota.
function dayMapPoints(state, date) {
  const pts = [];
  const city = state.cities.find((c) => date >= c.start && date < c.end);
  if (city && (city.hotel || city.city)) {
    pts.push({ label: city.hotel || city.city, query: (city.hotel || '') + ' ' + city.city });
  }
  state.transports
    .filter((x) => getTransportDate(x) === date)
    .forEach((x) => {
      const o = getTransportOrigin(x);
      const d = getTransportDest(x);
      const dur = getTransportDurationMinutes(x);
      const durTxt = dur ? ' · ' + minutesToLabel(dur) : '';
      if (o) pts.push({ label: 'Saída: ' + o + durTxt, query: o });
      if (d) pts.push({ label: 'Chegada: ' + d, query: d });
    });
  state.attractions
    .filter((x) => x.date === date && x.name)
    .forEach((x) => pts.push({ label: x.name, query: (x.name + ' ' + (x.city || '')).trim() }));
  return pts.map((p) => ({ ...p, query: String(p.query).trim() }));
}

export default function Mapa() {
  const { state } = useTrip();
  const dates = allPlanningDates(state);
  const [editing, setEditing] = useState(null);

  return (
    <section>
      <h2>Mapa</h2>
      <p className="hint">
        Cada dia tem uma rota sugerida (hospedagem, transporte e atrações). Toque em <b>Rota</b> para
        ajustar as paradas — incluir, remover ou reordenar — antes de abrir no Google Maps.
      </p>
      {dates.length === 0 ? (
        <p className="empty">Cadastre cidades, transportes e pontos do roteiro para montar rotas.</p>
      ) : (
        <div className="grid grid2">
          {dates.map((d) => {
            const pts = dayMapPoints(state, d.date);
            const cityLabel = d.city || inferCityForDate(state, d.date) || '';
            const title = fmtDate(d.date) + ' — ' + cityLabel;
            return (
              <div className="card map-card" key={d.date}>
                <h3>{title}</h3>
                <div className="map-points">
                  {pts.length
                    ? pts.map((p, k) => <div className="map-point" key={k}>{p.label}</div>)
                    : <span className="muted">Sem pontos neste dia.</span>}
                </div>
                <div className="toolbar" style={{ marginBottom: 0 }}>
                  <button disabled={pts.length === 0} onClick={() => setEditing({ title, points: pts })}>
                    Rota
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <RouteEditorModal title={editing.title} initialPoints={editing.points} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
