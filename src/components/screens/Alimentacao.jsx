import { useState } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate, money, num } from '../../domain/format.js';
import { foodOrder, datesFromCities, cityForDate } from '../../domain/dates.js';
import { activeCost, dayFood } from '../../domain/costs.js';
import { statusRowClass, StatusChip } from '../ui.jsx';
import { useTextFilter, dateOptions } from '../tableHelpers.js';
import { usePagination, Pager } from '../usePagination.jsx';
import MoneyInput from '../MoneyInput.jsx';

const isEmpty = (x) => !(x.place && x.place.trim()) && num(x.cost) === 0;

export default function Alimentacao() {
  const { state, actions } = useTrip();
  const { query, setQuery, filter } = useTextFilter();
  const [addDate, setAddDate] = useState('');
  const [hideEmpty, setHideEmpty] = useState(true); // item 4.1: ocultar vazias por padrão
  const opts = dateOptions(state);

  const sorted = [...state.foodItems].sort(
    (a, b) => a.date.localeCompare(b.date) || foodOrder(a.type) - foodOrder(b.type)
  );
  const grouped = {};
  filter(sorted, (x) => [x.date, x.type, x.place, x.city].join(' ')).forEach((x) =>
    (grouped[x.date] ||= []).push(x)
  );

  const dayKeys = Object.keys(grouped).sort();
  const { paged: pagedDays, ...pag } = usePagination(dayKeys, 15);

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
        <button className={hideEmpty ? 'active-toggle' : 'ghost'} onClick={() => setHideEmpty((v) => !v)}>
          {hideEmpty ? 'Mostrando só preenchidas' : 'Mostrando todas'}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Data</th><th>Cidade</th><th>Tipo</th><th>Restaurante/local</th><th>Custo</th><th>Status</th><th>Total do dia</th><th></th></tr>
          </thead>
          <tbody>
            {pagedDays.map((date) => {
              const arr = grouped[date];
              const filled = arr.filter((x) => !isEmpty(x));
              const visible = hideEmpty ? filled : arr;
              const total = arr.reduce((s, x) => s + activeCost(x), 0);
              const city = arr[0]?.city;

              // Dia sem nada preenchido, com ocultar ligado: mostra placeholder do dia.
              if (visible.length === 0) {
                return (
                  <tr key={date}>
                    <td data-label="Data">
                      {fmtDate(date)}<br />
                      <small className="muted">0 de {arr.length} preenchidas</small><br />
                      <button className="small-btn ghost" onClick={() => actions.addFoodItem(date, cityForDate(state, date))}>+ item</button>
                    </td>
                    <td data-label="Cidade">{city}</td>
                    <td data-label="" colSpan={4}><span className="muted">Nenhuma refeição preenchida neste dia.</span></td>
                    <td data-label="Total do dia" className="total-cell">{money(total)}</td>
                    <td></td>
                  </tr>
                );
              }

              return visible.map((x, idx) => {
                const i = state.foodItems.indexOf(x);
                return (
                  <tr className={statusRowClass(x)} key={x.id}>
                    {idx === 0 && (
                      <>
                        <td data-label="Data" rowSpan={visible.length}>
                          {fmtDate(date)}<br />
                          <small className="muted">{filled.length} de {arr.length} preenchidas</small><br />
                          <button className="small-btn ghost" onClick={() => actions.addFoodItem(date, cityForDate(state, date))}>+ item</button>
                        </td>
                        <td data-label="Cidade" rowSpan={visible.length}>{x.city}</td>
                      </>
                    )}
                    <td data-label="Tipo"><input value={x.type} onChange={(e) => actions.updateItem('foodItems', i, 'type', e.target.value)} /></td>
                    <td data-label="Restaurante/local"><input value={x.place || ''} onChange={(e) => actions.updateItem('foodItems', i, 'place', e.target.value)} /></td>
                    <td data-label="Custo"><MoneyInput value={num(x.cost)} onChange={(v) => actions.updateItem('foodItems', i, 'cost', v)} /></td>
                    <td data-label="Status"><StatusChip value={x.status} onChange={(v) => actions.updateItem('foodItems', i, 'status', v)} /></td>
                    {idx === 0 && <td data-label="Total do dia" rowSpan={visible.length} className="total-cell">{money(total)}</td>}
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
