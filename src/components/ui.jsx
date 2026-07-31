// components/ui.jsx — kit de componentes canônicos do redesign (Fase R1).
// Um vocabulário pequeno, usado em todo lugar, no lugar de estilos ad-hoc.
import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
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
export function Row({ icon, title, sub, value, cancelled, children, onClick, highlight }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className={'row' + (cancelled ? ' row-cancelled' : '') + (highlight ? ' row-highlight' : '')}>
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
  const panelRef = useRef(null);

  // Acessibilidade: Esc fecha e o foco fica preso dentro do sheet enquanto ele
  // estiver aberto (sem o trap, quem usa teclado/leitor de tela "sai" do
  // diálogo para o conteúdo inerte de trás).
  useEffect(() => {
    const anterior = document.activeElement;
    const el = panelRef.current;
    const focaveis = () =>
      Array.from(
        el?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || []
      ).filter((n) => !n.disabled && n.offsetParent !== null);

    // Foca o PRÓPRIO diálogo, não o primeiro controle. Antes focava o primeiro
    // elemento focável, que na ordem do DOM é o botão ✕ do cabeçalho — o campo
    // parecia "selecionar o X" ao abrir a edição, e um Enter distraído fechava
    // a tela. Focar o contêiner também faz o leitor de tela anunciar o título
    // do diálogo, em vez de ler um botão solto.
    el?.focus?.();

    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const lista = focaveis();
      if (lista.length === 0) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      anterior?.focus?.();
    };
  }, [onClose]);

  // Altura visível real (teclado do celular abre e "come" a tela).
  //
  // Isto é feito por REF, escrevendo direto no style — de propósito. A versão
  // anterior guardava a altura em estado do React e ouvia também o evento
  // `scroll` do visualViewport: no celular, cada rolagem disparava um setState,
  // que re-renderizava o sheet e fazia a rolagem SALTAR PARA O TOPO. Era o que
  // acontecia na folha de divisão de despesas, que é longa. Sem estado, não há
  // re-render; e só `resize` interessa, porque é o que muda com o teclado.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = panelRef.current;
    if (!vv || !el) return;
    const aplicar = () => { el.style.maxHeight = `${Math.round(vv.height * 0.92)}px`; };
    aplicar();
    vv.addEventListener('resize', aplicar);
    return () => vv.removeEventListener('resize', aplicar);
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        ref={panelRef}
        tabIndex={-1}
        role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
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


/* ---------- Toast: confirmação de ações (T-1.9) ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={notify}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast toast-' + t.kind}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Campo de busca reutilizável (T-1.10) ---------- */
export function SearchField({ value, onChange, placeholder = 'Buscar…', label }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label || placeholder}
      />
    </label>
  );
}
