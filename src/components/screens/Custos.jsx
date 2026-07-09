import { useTrip } from '../../store/TripProvider.jsx';
import { money, num } from '../../domain/format.js';
import { allPlanningDates } from '../../domain/dates.js';
import {
  totals,
  costRowsByView,
  expenseStatusTotals,
  palette,
} from '../../domain/costs.js';
import { Kpi } from '../ui.jsx';

function pieBackground(rows) {
  const total = rows.reduce((s, r) => s + num(r.value), 0) || 1;
  let acc = 0;
  const parts = [];
  rows.forEach((r, i) => {
    const deg = (num(r.value) / total) * 360;
    parts.push(`${palette(i)} ${acc}deg ${acc + deg}deg`);
    acc += deg;
  });
  return `conic-gradient(${parts.join(',') || '#e2e8f0 0deg 360deg'})`;
}

export default function Custos() {
  const { state, actions } = useTrip();
  const t = totals(state);
  const dates = allPlanningDates(state);
  const trav = Math.max(1, num(state.settings.travelers) || 1);
  const view = state.settings.costView || 'categoria';
  const rows = costRowsByView(state, view, t, dates);
  const statusData = expenseStatusTotals(state);
  const maxStatus = Math.max(1, ...statusData.map((s) => s.value));
  const viewLabel = view === 'cidade' ? 'cidade' : view === 'dia' ? 'dia' : 'categoria';

  return (
    <section>
      <h2>Custos</h2>
      <div className="grid grid4">
        <Kpi label="Total geral" value={money(t.total)} />
        <Kpi label="Por pessoa" value={money(t.total / trav)} />
        <Kpi label="Média por dia" value={money(t.total / (dates.length || 1))} />
        <Kpi label="Média por pessoa/dia" value={money(t.total / (trav * (dates.length || 1)))} />
      </div>
      <br />
      <div className="card">
        <div className="toolbar no-print">
          {['categoria', 'cidade', 'dia'].map((v) => (
            <button
              key={v}
              className={view === v ? 'active-toggle' : ''}
              onClick={() => actions.setCostView(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="grid grid2">
          <div>
            <h3>{view === 'dia' ? 'Gráfico de barras por dia' : `Gráfico de pizza por ${viewLabel}`}</h3>
            {view === 'dia' ? (
              <div className="status-bars">
                {rows.map((r, i) => (
                  <div className="status-bar-row" key={i}>
                    <span><b>{r.name}</b></span>
                    <div className="status-bar-track">
                      <div className="status-bar-fill" style={{ width: Math.max(2, (num(r.value) / Math.max(1, ...rows.map((x) => num(x.value)))) * 100) + '%', background: palette(i) }} />
                    </div>
                    <b>{money(r.value)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pie-wrap">
                <div className="pie" style={{ background: pieBackground(rows) }} />
                <div className="legend">
                  {rows.map((r, i) => (
                    <div key={i}>
                      <span style={{ background: palette(i) }} />
                      <b>{r.name}</b>: {money(r.value)} — {((num(r.value) / (t.total || 1)) * 100).toFixed(1)}%
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <h3>Valores por {viewLabel}</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>{viewLabel[0].toUpperCase() + viewLabel.slice(1)}</th><th>Valor</th><th>%</th><th>Por pessoa</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td data-label={viewLabel}>{r.name}</td>
                      <td data-label="Valor" className="total-cell">{money(r.value)}</td>
                      <td data-label="%">{((num(r.value) / (t.total || 1)) * 100).toFixed(1)}%</td>
                      <td data-label="Por pessoa">{money(num(r.value) / trav)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <br />
      <div className="grid grid2">
        <div className="card">
          <h3>Gráfico de barras — status do gasto</h3>
          <div className="status-bars">
            {statusData.map((s) => (
              <div className="status-bar-row" key={s.label}>
                <span><b>{s.label}</b></span>
                <div className="status-bar-track">
                  <div className={`status-bar-fill status-${s.label.toLowerCase()}`} style={{ width: Math.max(2, (s.value / maxStatus) * 100) + '%' }} />
                </div>
                <b>{money(s.value)}</b>
              </div>
            ))}
          </div>
          <p className="hint">Valores cancelados aparecem para controle, mas não entram no total geral.</p>
        </div>
        <div className="card">
          <h3>Status do gasto</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Status</th><th>Itens</th><th>Valor</th><th>%</th></tr></thead>
              <tbody>
                {statusData.map((s) => (
                  <tr key={s.label}>
                    <td data-label="Status">{s.label}</td>
                    <td data-label="Itens">{s.count}</td>
                    <td data-label="Valor" className="total-cell">{money(s.value)}</td>
                    <td data-label="%">{s.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
