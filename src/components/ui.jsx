// components/ui.jsx — kit de componentes canônicos do redesign (Fase R1).
// Um vocabulário pequeno, usado em todo lugar, no lugar de estilos ad-hoc.
import { useState, useEffect } from 'react';
import { STATUS_OPTIONS, CHECKLIST_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../domain/state.js';

/* ---------- Chip de status ---------- */
const chipClass = (v) => 'chip chip-' + String(v || 'planejado').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function StatusChip({ value = 'Planejado', onChange, options = STATUS_OPTIONS }) {
  const [open, setOpen] = useState(false);
  if (!onChange) return <span className={chipClass(value)}>{value}</span>;
  return (
    <span className="chip-wrap">
      <button type="button" className={chipClass(value)} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {value} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <span className="chip-backdrop" onClick={() => setOpen(false)} />
          <ul className="chip-menu" role="listbox">
            {options.map((o) => (
              <li key={o}>
                <button type="button" className={chipClass(o)} role="option" aria-selected={o === value}
                  onClick={() => { onChange(o); setOpen(false); }}>{o}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </span>
  );
}

export const CHECKLIST_STATUS = CHECKLIST_STATUS_OPTIONS;
export const PRIORITIES = PRIORITY_OPTIONS;

/* ---------- Row: a unidade de lista (substitui a <tr>) ---------- */
export function Row({ icon, title, sub, value, cancelled, children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className={'row' + (cancelled ? ' row-cancelled' : '')}>
      {icon && <span className="row-icon" aria-hidden="true">{icon}</span>}
      <div className="row-main">
        {onClick ? (
          <Tag onClick={onClick} style={{ all: 'unset', cursor: 'pointer' }}>
            <span className="row-title">{title}</span>
          </Tag>
        ) : (
          <span className="row-title">{title}</span>
        )}
        {sub && <span className="row-sub">{sub}</span>}
        {children && <div className="row-actions">{children}</div>}
      </div>
      {value != null && <span className="row-value">{value}</span>}
    </div>
  );
}

/* ---------- Sheet: bottom sheet no mobile, modal no desktop ---------- */
export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- EmptyState: convite, não desculpa ---------- */
export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/* ---------- Banner ---------- */
export function Banner({ kind = 'info', children }) {
  const icon = kind === 'warn' ? '⚠️' : kind === 'danger' ? '⛔' : 'ℹ️';
  return (
    <div className={'banner banner-' + kind} role={kind === 'info' ? 'status' : 'alert'}>
      <span aria-hidden="true">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

/* ---------- Métrica ---------- */
export function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* ---------- Stepper ---------- */
export function Stepper({ onPrev, onNext, canPrev, canNext, label }) {
  return (
    <div className="stepper">
      <button onClick={onPrev} disabled={!canPrev}>← Anterior</button>
      {label && <span className="small t2 num" style={{ minWidth: 90, textAlign: 'center' }}>{label}</span>}
      <button onClick={onNext} disabled={!canNext}>Próximo →</button>
    </div>
  );
}

/* ---------- Campo rotulado ---------- */
export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/* utilidade herdada: classe de linha cancelada */
export const isCancelled = (x) => String(x?.status || '').toLowerCase() === 'cancelado';
