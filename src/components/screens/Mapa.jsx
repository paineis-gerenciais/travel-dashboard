import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate } from '../../domain/format.js';
import { allPlanningDates, inferCityForDate, periodByTime } from '../../domain/dates.js';
import {
  gmaps,
  getTransportDate,
  getTransportOrigin,
  getTransportDest,
} from '../../domain/transport.js';

// Monta os pontos de um dia (hospedagem + transportes), opcionalmente filtrando
// por período. Simplificação fiel do dayMapPoints original.
function dayMapPoints(state, date, period = null) {
  const pts = [];
  const city = state.cities.find((c) => date >= c.start && date < c.end);
  if (city && (city.hotel || city.city)) {
    pts.push({ time: 'Base', label: city.hotel || city.city, query: `${city.hotel || ''} ${city.city}`.trim() });
  }
  state.transports
    .filter((x) => getTransportDate(x) === date)
    .filter((x) => !period || periodByTime(x.time) === period)
    .forEach((x) => {
      const o = getTransportOrigin(x);
      const d = getTransportDest(x);
      if (o) pts.push({ time: x.time || '', label: `Saída: ${o}`, query: o });
      if (d) pts.push({ time: x.time || '', label: `Chegada: ${d}`, query: d });
    });
  state.attractions
    .filter((x) => x.date === date && x.name)
    .filter((x) => !period || periodByTime(x.time) === period)
    .forEach((x) => pts.push({ time: x.time || '', label: x.name, query: `${x.name} ${x.city || ''}`.trim() }));
  return pts;
}

export default function Mapa() {
  const { state } = useTrip();
  const dates = allPlanningDates(state);

  return (
    <section>
      <h2>Mapa</h2>
      <p className="hint">
        Links do Google Maps gerados por dia, com hospedagem e transporte como pontos da rota.
      </p>
      {dates.length === 0 ? (
        <p className="empty">Cadastre cidades, transportes e pontos do roteiro para gerar links de mapa.</p>
      ) : (
        <div className="grid grid2">
          {dates.map((d) => {
            const pts = dayMapPoints(state, d.date);
            return (
              <div className="card map-card" key={d.date}>
                <h3>{fmtDate(d.date)} — {d.city || inferCityForDate(state, d.date) || ''}</h3>
                <div className="map-points">
                  {pts.length
                    ? pts.map((p, k) => (
                        <div className="map-point" key={k}>
                          <b>{p.time}</b> {p.label}
                        </div>
                      ))
                    : <span className="muted">Sem pontos neste dia.</span>}
                </div>
                <div className="toolbar">
                  <a className="linkbtn" target="_blank" rel="noreferrer" href={gmaps(pts.map((p) => p.query))}>
                    Rota completa
                  </a>
                  {['Manhã', 'Tarde', 'Noite'].map((p) => (
                    <a
                      key={p}
                      className="linkbtn ghost"
                      target="_blank"
                      rel="noreferrer"
                      href={gmaps(dayMapPoints(state, d.date, p).map((x) => x.query))}
                    >
                      {p}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
