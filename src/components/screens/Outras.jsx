import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate, money, num } from '../../domain/format.js';
import { datesFromCities, cityForDate } from '../../domain/dates.js';
import { dayOther } from '../../domain/costs.js';
import {statusRowClass, StatusSelect, StatusChip } from '../ui.jsx';
import { useTextFilter } from '../tableHelpers.js';
import { usePagination, Pager } from '../usePagination.jsx';
import MoneyInput from '../MoneyInput.jsx';

export default function Outras() {
  const { state, actions } = useTrip();
  const { query, setQuery, filter } = useTextFilter();
  const firstDate = datesFromCities(state)[0]?.date || '';

  const sorted = [...state.otherExpenses].sort((a, b) => a.date.localeCompare(b.date));
  const rows = filter(sorted, (x) => [x.date, x.name, x.city].join(' '));
  const { paged, ...pag } = usePagination(rows, 40);

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
            {paged.map((x) => {
              const i = state.otherExpenses.indexOf(x);
              return (
                <tr className={statusRowClass(x)} key={x.id}>
                  <td data-label="Data">
                    <input type="date" value={x.date || ''} onChange={(e) => actions.setOtherDate(i, e.target.value, cityForDate(state, e.target.value))} />
                  </td>
                  <td data-label="Cidade">{x.city}</td>
                  <td data-label="Despesa"><input value={x.name || ''} onChange={(e) => actions.updateItem('otherExpenses', i, 'name', e.target.value)} /></td>
                  <td data-label="Custo"><MoneyInput value={num(x.cost)} onChange={(v) => actions.updateItem('otherExpenses', i, 'cost', v)} /></td>
                  <td data-label="Status"><StatusChip value={x.status} onChange={(v) => actions.updateItem('otherExpenses', i, 'status', v)} /></td>
                  <td><button className="small-btn danger" onClick={() => actions.deleteItem('otherExpenses', i)}>Excluir</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager {...pag} />
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
