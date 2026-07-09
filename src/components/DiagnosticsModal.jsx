import { useState, useEffect } from 'react';
import { subscribeErrors, getErrors, clearErrors } from '../lib/logger.js';

export default function DiagnosticsModal({ onClose }) {
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Diagnóstico" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Diagnóstico</h3>
          <button className="ghost" onClick={onClose}>Fechar</button>
        </div>
        {errors.length === 0 ? (
          <p className="empty">Nenhum erro registrado nesta sessão. 🎉</p>
        ) : (
          <>
            <div className="toolbar">
              <button className="small-btn" onClick={exportLog}>Exportar log</button>
              <button className="small-btn ghost" onClick={clearErrors}>Limpar</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Quando</th><th>Contexto</th><th>Mensagem</th></tr></thead>
                <tbody>
                  {errors.map((e, i) => (
                    <tr key={i}>
                      <td data-label="Quando">{new Date(e.time).toLocaleString('pt-BR')}</td>
                      <td data-label="Contexto">{e.context}</td>
                      <td data-label="Mensagem">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
