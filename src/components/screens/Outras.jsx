import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate, money, num } from '../../domain/format.js';
import { datesFromCities, cityForDate } from '../../domain/dates.js';
import { dayOther } from '../../domain/costs.js';
import { statusRowClass, StatusSelect } from '../ui.jsx';
import { useTextFilter } from '../tableHelpers.js';

export default function Outras() {
  const { state, actions } = useTrip();
  const { query, setQuery, filter } = useTextFilter();
  const firstDate = datesFromCities(state)[0]?.date || '';

  const sorted = [...state.otherExpenses].sort((a, b) => a.date.localeCompare(b.date));
  const rows = filter(sorted, (x) => [x.date, x.name, x.city].join(' '));

  return (
    <section>
      <h2>Outras despesas</h2>
      <div className="toolbar">
        <input placeholder="Filtrar despesas" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button onClick={() => actions.addOther(firstDate, cityForDate(state, firstDate))}>Adicionar despesa</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Cidade</th><th>Despesa</th><th>Custo</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((x) => {
              const i = state.otherExpenses.indexOf(x);
              return (
                <tr className={statusRowClass(x)} key={x.id}>
                  <td data-label="Data">
                    <input type="date" value={x.date || ''} onChange={(e) => actions.setOtherDate(i, e.target.value, cityForDate(state, e.target.value))} />
                  </td>
                  <td data-label="Cidade">{x.city}</td>
                  <td data-label="Despesa"><input value={x.name || ''} onChange={(e) => actions.updateItem('otherExpenses', i, 'name', e.target.value)} /></td>
                  <td data-label="Custo"><input type="number" value={num(x.cost)} onChange={(e) => actions.updateItem('otherExpenses', i, 'cost', e.target.value)} /></td>
                  <td data-label="Status"><StatusSelect value={x.status} onChange={(v) => actions.updateItem('otherExpenses', i, 'status', v)} /></td>
                  <td><button className="small-btn danger" onClick={() => actions.deleteItem('otherExpenses', i)}>Excluir</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <br />
      <div className="card">
        <h3>Consolidado por dia</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Cidade</th><th>Total outras despesas</th></tr></thead>
            <tbody>
              {datesFromCities(state).map((d) => (
                <tr key={d.date}>
                  <td data-label="Data">{fmtDate(d.date)}</td>
                  <td data-label="Cidade">{d.city}</td>
                  <td data-label="Total outras despesas" className="total-cell">{money(dayOther(state, d.date))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
