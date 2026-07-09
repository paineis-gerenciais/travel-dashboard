// components/tableHelpers.js
import { useState } from 'react';
import { fmtDate } from '../domain/format.js';
import { datesFromCities } from '../domain/dates.js';

/** Hook simples de filtro por texto livre sobre uma lista de itens. */
export function useTextFilter() {
  const [query, setQuery] = useState('');
  const filter = (items, toText) =>
    !query.trim()
      ? items
      : items.filter((x) => toText(x).toLowerCase().includes(query.toLowerCase()));
  return { query, setQuery, filter };
}

/** Opções de data (para os selects "adicionar na data"). */
export function dateOptions(state) {
  const ds = datesFromCities(state);
  return ds.map((d) => ({ value: d.date, label: `${fmtDate(d.date)} — ${d.city}` }));
}
