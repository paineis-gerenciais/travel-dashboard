// domain/format.js
// Helpers de parsing e formatação portados fielmente do dashboard Apps Script.
// Fonte: Index.html (num, money, fmtDate). safe() foi REMOVIDO de propósito:
// no React o JSX já escapa interpolações, então não há innerHTML manual a
// proteger — manter safe() seria código morto.

/** Converte texto em número, tolerando formato BR "1.234,56". Nunca negativo. */
export function num(v) {
  return Math.max(
    0,
    Number(
      String(v ?? 0)
        .replace(/[^0-9,.-]/g, '')
        .replace(/\.(?=\d{3})/g, '')
        .replace(',', '.')
    ) || 0
  );
}

/** Formata número como moeda BR: "R$ 1.234,56". */
export function money(v) {
  return (
    'R$ ' +
    Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Converte ISO "aaaa-mm-dd" para "dd/mm/aaaa". String vazia se ausente. */
export function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
