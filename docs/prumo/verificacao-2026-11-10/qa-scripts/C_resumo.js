const r = require('docs/prumo/verificacao-2026-11-10/qa-scripts/qa2-C_resultado.json');
for (const e of r) {
  console.log(`\n## ${e.vp} | ${e.tema} (data-theme=${e.theme}) | ${e.tela} | chips: ${e.chips.join(', ')}`);
  if (!e.axe.violations.length) console.log('  sem violacoes');
  for (const v of e.axe.violations) {
    const worst = v.todos.filter(t => t.data).sort((a, b) => a.data.ratio - b.data.ratio)[0];
    console.log(`  ${v.id} (${v.impact}) nos=${v.nodes} ex=${v.todos[0].target} ${worst ? 'pior=' + worst.data.ratio + ' fg=' + worst.data.fg + ' bg=' + worst.data.bg + ' [' + worst.target + ']' : ''}`);
  }
  const chips = [...e.axe.contrastPasses, ...e.axe.violations.filter(v => v.id === 'color-contrast').flatMap(v => v.todos)].filter(t => /class="chip/.test(t.html));
  const incChips = e.axe.incompleteContrast.filter(t => /class="chip/.test(t.html));
  const seen = new Set();
  for (const c of chips) { const k = c.html.match(/chip-\w+/)?.[0] + c.data?.ratio; if (seen.has(k)) continue; seen.add(k); const ok = e.axe.violations.some(v => v.id === 'color-contrast' && v.todos.some(t => t.target === c.target)); console.log(`   chip ${c.html.match(/chip-\w+/)?.[0]} ratio=${c.data?.ratio} (esp ${c.data?.esperado}) fg=${c.data?.fg} bg=${c.data?.bg} ${ok ? 'FALHA' : 'ok'}`); }
  console.log('   incompletos(contraste) chips:', incChips.length, 'total incompletos:', e.axe.incompleteContrast.length);
}
