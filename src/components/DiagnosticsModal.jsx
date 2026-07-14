import { useState, useEffect } from 'react';
import { subscribeErrors, getErrors, clearErrors } from '../lib/logger.js';
import { Row, EmptyState } from './ui.jsx';

/** Conteúdo de "diagnóstico". Renderiza dentro de um Sheet (sem chrome próprio). */
export default function DiagnosticsModal() {
  const [errors, setErrors] = useState(getErrors());
  useEffect(() => subscribeErrors(setErrors), []);

  const exportLog = () => {
    const blob = new Blob([JSON.stringify(errors, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'diagnostico-erros.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  if (errors.length === 0) {
    return <EmptyState title="Nenhum erro registrado">Esta sessão está limpa.</EmptyState>;
  }

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button className="btn-sm" onClick={exportLog}>Exportar log</button>
        <button className="btn-ghost btn-sm" onClick={clearErrors}>Limpar</button>
      </div>
      <div className="card card-flush">
        {errors.map((e, i) => (
          <Row key={i} icon="⚠️" title={e.context} sub={e.message}
            value={<span className="tiny t3">{new Date(e.time).toLocaleTimeString('pt-BR')}</span>} />
        ))}
      </div>
    </div>
  );
}
