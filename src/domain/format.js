// domain/format.js
// Helpers de parsing e formatação portados fielmente do dashboard Apps Script.
// Fonte: Index.html (num, money, fmtDate). safe() foi REMOVIDO de propósito:
// no React o JSX já escapa interpolações, então não há innerHTML manual a
// proteger — manter safe() seria código morto.

/** Converte texto em número, tolerando formato BR "1.234,56". Nunca negativo. */
/**
 * Converte para número, aceitando tanto números de verdade quanto texto
 * digitado no formato brasileiro ("1.750,00").
 *
 * O caminho de TEXTO remove pontos seguidos de 3 dígitos, porque ali eles são
 * separador de milhar. Isso está certo para entrada do usuário — e estava
 * destruindo floats de verdade: `num(33.333333333333336)` virava a string
 * "33.333333333333336", o ponto era removido como se fosse milhar, e o
 * resultado saía 33333333333333336 (3,3 × 10¹⁶). Era o que produzia os
 * percentuais e valores gigantes na divisão de despesas.
 *
 * Por isso, número entra e sai como número, sem passar pelo parser de texto.
 * A regra de texto continua idêntica para quem digita.
 */
export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(0, v) : 0;
  if (v === null || v === undefined || v === '') return 0;
  return Math.max(
    0,
    Number(
      String(v)
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
