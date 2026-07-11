import { useState } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate, money, num } from '../../domain/format.js';
import { foodOrder, datesFromCities, cityForDate } from '../../domain/dates.js';
import { activeCost, dayFood } from '../../domain/costs.js';
import { statusRowClass, StatusChip } from '../ui.jsx';
import { useTextFilter, dateOptions } from '../tableHelpers.js';
import { usePagination, Pager } from '../usePagination.jsx';
import MoneyInput from '../MoneyInput.jsx';

const isEmpty = (x) => !x.autoBreakfast && !(x.place && x.place.trim()) && num(x.cost) === 0;

export default function Alimentacao() {
  const { state, actions } = useTrip();
  const { query, setQuery, filter } = useTextFilter();
  const [addDate, setAddDate] = useState('');
  const opts = dateOptions(state);

  // Agrupa refeições por dia (item 4.4: não há mais linhas vazias pré-geradas).
  const sorted = [...state.foodItems].sort(
    (a, b) => a.date.localeCompare(b.date) || foodOrder(a.type) - foodOrder(b.type)
  );
  const grouped = {};
  filter(sorted, (x) => [x.date, x.type, x.place, x.city].join(' ')).forEach((x) =>
    (grouped[x.date] ||= []).push(x)
  );

  // Lista de dias = união dos dias de cidade + dias que já têm refeição.
  const dayset = new Set([...datesFromCities(state).map((d) => d.date), ...Object.keys(grouped)]);
  const dayKeys = [...dayset].sort();
  const { paged: pagedDays, ...pag } = usePagination(dayKeys, 15);

  const emptyCount = state.foodItems.filter(isEmpty).length;

  return (
    <section>
      <h2>Alimentação</h2>
      <div className="toolbar">
        <input placeholder="Filtrar alimentação" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={addDate} onChange={(e) => setAddDate(e.target.value)}>
          <option value="">Selecione a data</option>
          {opts.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <button onClick={() => addDate && actions.addFoodItem(addDate, cityForDate(state, addDate))}>
          Adicionar linha na data
        </button>
        {emptyCount > 0 && (
          <button className="ghost" onClick={() => actions.removeEmptyFood()}>
            Remover {emptyCount} refeição(ões) vazia(s)
          </button>
        )}
      </div>
      <p className="hint">
        As refeições não são mais criadas em branco: use <b>+ item</b> em cada dia. Cidades com
        "café da manhã incluso" ganham a linha de café automaticamente.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Data</th><th>Cidade</th><th>Tipo</th><th>Restaurante/local</th><th>Custo</th><th>Status</th><th>Total do dia</th><th></th></tr>
          </thead>
          <tbody>
            {pagedDays.map((date) => {
              const arr = grouped[date] || [];
              const total = arr.reduce((s, x) => s + activeCost(x), 0);
              const cityLabel = arr[0]?.city || cityForDate(state, date);

              if (arr.length === 0) {
                return (
                  <tr key={date}>
                    <td data-label="Data">
                      {fmtDate(date)}<br />
                      <button className="small-btn ghost" onClick={() => actions.addFoodItem(date, cityForDate(state, date))}>+ item</button>
                    </td>
                    <td data-label="Cidade">{cityLabel}</td>
                    <td data-label="" colSpan={4}><span className="muted">Sem refeições neste dia.</span></td>
                    <td data-label="Total do dia" className="total-cell">{money(0)}</td>
                    <td></td>
                  </tr>
                );
              }

              return arr.map((x, idx) => {
                const i = state.foodItems.indexOf(x);
                return (
                  <tr className={statusRowClass(x)} key={x.id}>
                    {idx === 0 && (
                      <>
                        <td data-label="Data" rowSpan={arr.length}>
                          {fmtDate(date)}<br />
                          <button className="small-btn ghost" onClick={() => actions.addFoodItem(date, cityForDate(state, date))}>+ item</button>
                        </td>
                        <td data-label="Cidade" rowSpan={arr.length}>{x.city}</td>
                      </>
                    )}
                    <td data-label="Tipo"><input value={x.type} onChange={(e) => actions.updateItem('foodItems', i, 'type', e.target.value)} /></td>
                    <td data-label="Restaurante/local"><input value={x.place || ''} onChange={(e) => actions.updateItem('foodItems', i, 'place', e.target.value)} /></td>
                    <td data-label="Custo"><MoneyInput value={num(x.cost)} onChange={(v) => actions.updateItem('foodItems', i, 'cost', v)} /></td>
                    <td data-label="Status"><StatusChip value={x.status} onChange={(v) => actions.updateItem('foodItems', i, 'status', v)} /></td>
                    {idx === 0 && <td data-label="Total do dia" rowSpan={arr.length} className="total-cell">{money(total)}</td>}
                    <td><button className="small-btn danger" onClick={() => actions.deleteItem('foodItems', i)}>Excluir</button></td>
                  </tr>
                );
              });
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
            <thead><tr><th>Data</th><th>Cidade</th><th>Total alimentação</th></tr></thead>
            <tbody>
              {datesFromCities(state).map((d) => (
                <tr key={d.date}>
                  <td data-label="Data">{fmtDate(d.date)}</td>
                  <td data-label="Cidade">{d.city}</td>
                  <td data-label="Total alimentação" className="total-cell">{money(dayFood(state, d.date))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
