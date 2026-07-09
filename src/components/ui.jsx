// components/ui.jsx
// Pequenos componentes reutilizáveis usados em várias telas.
import {
  STATUS_OPTIONS,
  CHECKLIST_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
} from '../domain/state.js';

export function Kpi({ label, value }) {
  return (
    <div className="card kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function StatusSelect({ value = 'Planejado', onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function ChecklistStatusSelect({ value = 'Pendente', onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {CHECKLIST_STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function PrioritySelect({ value = 'Média', onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {PRIORITY_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function CategorySelect({ value = 'Outros', onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {CATEGORY_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

/** Classe de linha conforme status (pago/reservado/cancelado). */
export function statusRowClass(x) {
  const s = String(x.status || '').toLowerCase();
  if (s === 'cancelado') return 'status-cancelado';
  if (x.status === 'Pago') return 'status-pago';
  if (x.status === 'Reservado') return 'status-reservado';
  return '';
}
