import { useState } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate } from '../../domain/format.js';
import { allPlanningDates, inferCityForDate, tripDayFlow } from '../../domain/dates.js';
import {
  getTransportDate, getTransportOrigin, getTransportDest,
  getTransportDurationMinutes, minutesToLabel,
} from '../../domain/transport.js';
import { Row, EmptyState, Sheet } from '../ui.jsx';
import RouteEditorModal from '../RouteEditorModal.jsx';

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

/** MAPA — rotas por dia, abertas no Google Maps. Sem tabela, sem mapa embutido. */
export default function Mapa() {
  const { state } = useTrip();
  const dates = allPlanningDates(state);
  const [editing, setEditing] = useState(null);

  if (dates.length === 0) {
    return (
      <div className="screen">
        <div className="container">
          <h2>Mapa</h2>
          <EmptyState title="Sem rotas ainda">
            Cadastre cidades e monte os dias — as rotas aparecem aqui.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="container stack">
        <h2>Mapa</h2>
        <p className="small t2" style={{ margin: 0 }}>
          Cada dia tem uma rota sugerida. Toque em Rota para ajustar as paradas antes de abrir no Google Maps.
        </p>

        <div className="card card-flush">
          {dates.map((d) => {
            const pts = dayMapPoints(state, d.date);
            const cityLabel = d.city || inferCityForDate(state, d.date) || '';
            const flow = tripDayFlow(state, d.date);
            const flowLabel = flow.from && flow.to && flow.from !== flow.to
              ? flow.from + ' → ' + flow.to
              : (cityLabel || flow.to || flow.from);
            const title = fmtDate(d.date) + ' — ' + flowLabel;
            return (
              <Row
                key={d.date}
                icon="🗺️"
                title={flowLabel}
                sub={pts.length ? `${fmtDate(d.date)} · ${pts.length} ${pts.length === 1 ? 'parada' : 'paradas'}` : `${fmtDate(d.date)} · sem paradas`}
                value={
                  <button className="btn-sm" disabled={pts.length === 0} onClick={() => setEditing({ title, points: pts })}>
                    Rota
                  </button>
                }
              />
            );
          })}
        </div>
      </div>

      {editing && (
        <Sheet title={editing.title} onClose={() => setEditing(null)}>
          <RouteEditorModal initialPoints={editing.points} />
        </Sheet>
      )}
    </div>
  );
}
