// components/usePagination.js — paginação client-side leve (Fase 3, item 3.4).
// Só entra em ação quando a lista passa de `pageSize`; para listas pequenas
// (uso comum), mostra tudo e não muda nada. Serve tanto para linhas soltas
// quanto para grupos (dias), preservando a lógica de rowspan das telas.
import { useState, useMemo, useEffect } from 'react';

export function usePagination(items, pageSize = 30) {
  const [page, setPage] = useState(0);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Se a lista encolher (filtro), não deixa a página passar do fim.
  useEffect(() => { if (page > pageCount - 1) setPage(0); }, [pageCount, page]);

  const paged = useMemo(
    () => (total <= pageSize ? items : items.slice(page * pageSize, page * pageSize + pageSize)),
    [items, page, pageSize, total]
  );

  const enabled = total > pageSize;
  return { paged, page, setPage, pageCount, enabled, total };
}

// Componente de controles de paginação (só renderiza se `enabled`).
export function Pager({ page, pageCount, setPage, enabled }) {
  if (!enabled) return null;
  return (
    <div className="pager no-print">
      <button className="small-btn ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
        ← Anterior
      </button>
      <span className="muted">Página {page + 1} de {pageCount}</span>
      <button className="small-btn ghost" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
        Próxima →
      </button>
    </div>
  );
}
