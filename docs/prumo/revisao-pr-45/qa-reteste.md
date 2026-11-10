# Reteste de qualidade: PR #45 (travel-dashboard)

- **Demanda:** travel-dashboard#41 · qa-engineer · 2026-11-10
- **Branch:** `feat/41-skill-roteiro-importacao-json` em `2c9aea4` (novos: `a6b9914`, `402a6f7`, `2c9aea4` sobre `1f81e4d`)
- **Ambiente:** Node 22, Vitest 1.6.1, Playwright (Pixel 5 e Desktop Chrome), emuladores Firestore e Auth, variáveis Firebase fictícias, dados fictícios. Arquivos de teste em `scratchpad/qa45b/` (fora do repositório).
- **Parecer:** REPROVADO (1 defeito alto novo/residual: R1, o D1 reaparece no .xlsx gerado pelo script da skill).

## 1. Situação de D1 a D10
| ID | Situação | Evidência |
|---|---|---|
| D1 | **Parcial** | JSON e domínio: corrigido (caso C12b: só `nightly` 650→700 e `cost` 90→95 mudam; hotel, café, status "Reservado"/"Pago", notas e hora preservados). Colar e .xlsx sem a coluna: preservam (R5, R8). **Não corrigido no .xlsx que o script da skill gera** (R1 abaixo). |
| D2 | Corrigido | `20300610` e `0` → "data fora do intervalo"; `-1`, `0.5`, `73051` idem; `1` → 1899-12-31, `73050` → 2099-12-31; `2030-02-30`, `2030-02-29`, `2030-13-01` → "data inexistente"; `2028-02-29` ok. No app (E2E meu) a prévia mostra "Nenhuma linha válida para importar" e o erro na linha. Script: saída 1 nos dois casos. |
| D3 | Corrigido | Prévia do app: "2 linha(s) parecem repetir itens que já estão na viagem (importar de novo duplica). Para atualizar um item, use a coluna id." + lista "Atracoes · linha 2". `possiveisDuplicatas` (R11): acha por caixa e espaços; ignora `id` existente; `id` inexistente conta como novo. |
| D4 | Corrigido | `Cidade`, `CHECK_IN`, `Check_Out`, ` Cidade ` casam; `hospedagm` e `Foo` vão para colunas ignoradas; `Cidades` + `cidades` somam as linhas (C9). Observação baixa: `_linha` das abas somadas continua contando em sequência, então o erro cita a linha acumulada, não a da aba de origem. |
| D5 | Corrigido | Script recusa `src/`, raiz, `importacoes-x/`, `package.json` (leitura) e `--viagem package.json`; permite fora do repositório (texto de `SKILL.md` ajustado). Nada gravado em `wt41` (conferido). |
| D6 | Corrigido | (a) symlink fora do repositório apontando para `wt41/src`: `--xlsx link-src/nao.xlsx` → saída 1 "grave dentro de importacoes/ ... src/nao.xlsx"; symlink para `package.json` como entrada → saída 1; symlink para o exemplo em `e2e/fixtures/` → saída 0. (b) BOM: script saída 0; app abre a prévia (E2E "bom"). Nota: `.gitignore` agora é `importacoes` (sem barra), cobre também link simbólico. |
| D7 | Corrigido | Banner "Partes do arquivo foram ignoradas. Abas: Hospedagem, Foguetes. Colunas: cidades · hospedagm." (mobile e desktop). Script também lista as colunas. |
| D8 | Parcial, por decisão | Datas corrigidas (D2). `http`→`https`, `duracao_min` "1h30"→130 e -5→0 seguem no backlog por decisão. Bônus: texto como objeto/lista agora vira vazio, não "[object Object]". |
| D9 | Corrigido | Mensagens vistas no toast (mobile e desktop): "campo "versao" ausente"; "versão "1" está em texto; use o número 1"; backup: "Este é um arquivo de cópia de segurança. Para restaurá-lo, use Mais → Importar JSON (substitui a viagem)."; abas vazias: "Nenhuma aba reconhecida no JSON. Use: Cidades, Transportes, Alimentacao, Atracoes, Outras, Checklist." |
| D10 | Corrigido | Indentação do teste em `importacao-json.test.js:20` conferida com `cat -A`. |

## 2. Regressão (critério 2)
- `.xlsx` gerado como o app exporta (`aoa_to_sheet(planilhaDe(state))`), editado em 3 células, lido por `lerPlanilha` real e mesclado (`regressao.mjs`): R2 cidade atualiza `nightly` 700 e `hospedagem`; R3 atração com `status` vazio vira "Planejado", `link` vazio **preserva** o link, `custo` 95. Sem erros de validação. **Sem regressão.**
- Colar com tab final (status presente e vazio) → "Planejado" (R6). Observação baixa: linha colada mais curta que o cabeçalho (sem tab final) conta como "não enviada" (R7); por decisão D1, mas quem limpar a última célula e colar não limpa o campo.

## 3. Banners e E2E (critério 3)
- `e2e/importacao-json.spec.js`: 8 passed (4 testes × 2 projetos). Cobrem: aviso de duplicata na reimportação (8 linhas) e aviso de abas/colunas ignoradas. **Não cobrem:** erro de data numérica na prévia, atualização parcial por `id` na interface, mensagens novas de versão/backup (cobertas só no domínio).
- Meus E2E (mobile e desktop, 2 passed) confirmam texto e leitura dos banners; captura `qa45b/shots/mobile-duplicata.png` legível em 393 px. Limitação do ambiente: o caminho com acento do `test-results/` não foi exercitado (arquivos em pasta sem acento).

## 4. Achados novos
| ID | Severidade | Descrição |
|---|---|---|
| R1 | **Alto** | D1 permanece no `.xlsx` gerado pelo script. `validar-importacao.mjs:gravarXlsx` troca `undefined` por `''` e escreve todos os cabeçalhos; para o app, célula vazia = "enviada e vazia". Reprodução: `qa45b/parcial.json` (id c1 só com `custo_diaria`; id a1 só com `custo`) → script `--xlsx` → `lerPlanilha` → `validarAba` → `mesclarPlanilha` sobre cidade `{hotel:"Hotel X", café, "Reservado", notes}` e atração `{time:"10:00", "Pago"}`. Obtido: cidade `hotel:""`, `breakfastIncluded:false`, `status:"Planejado"`, `notes:""`; atração `time:""`, `status:"Planejado"`. A skill entrega o `.xlsx` ao usuário como alternativa ao `.json` (SKILL.md:116) e promete "coluna ausente não é alterada". Correção estreita: no script, escrever no `.xlsx` só as colunas enviadas em ao menos uma linha, avisar (e recusar ou preencher) quando uma coluna vem em algumas linhas e falta em outras, e mandar usar o `.json` para atualizações por `id`; teste de regressão que passe o `.xlsx` do script pelo domínio. |
| R2 | Baixo | Colar: linha curta = "não enviada" (R7 acima). |
| R3 | Baixo | `_linha` acumulada em abas repetidas (D4). |
| R4 | Baixo | A lista de duplicatas mostra "Atracoes · linha 2" sem dizer qual item existente é repetido. |

## 5. Testes executados (nesta sessão)
- `npx vitest run src/domain` no worktree: 3 arquivos, **133 passed** (antes 118).
- `npx firebase emulators:exec --only firestore,auth "npx playwright test e2e/importacao-json.spec.js"` com variáveis fictícias: **8 passed**.
- `node qa45/casos.mjs` (D1, D2, D4: C6, C8, C9, C10, C12a-c, C15) contra o worktree: ver seção 1.
- `node qa45b/regressao.mjs` (R1 a R14), `node qa45b/xlsx-parcial.mjs`, 15 chamadas do script (`qa45b`), `qa45b/b-e2e.registro.js` (mobile e desktop).
- `git -C wt41 status -s --ignored` ao final: `!! dist/`, `!! firestore-debug.log`, `!! node_modules` (como antes). Emuladores e preview encerrados; portas 4173, 8080 e 9099 livres. Symlinks de teste removidos de `qa45b/`.

## 6. Não verificado
- Atualização por `id` pela interface (só pelo domínio); leitor de tela e axe; tablet; contraste do banner de aviso; desempenho com 2 MB.
- Arquivo em caminho com acento no Playwright (limitação do ambiente informada pelo Head).

## 7. Condição para aprovar
Corrigir R1 (script e/ou texto da skill, com teste). Os demais itens podem ir para o backlog. Depois disso o parecer passa a APROVADO COM RESSALVAS (D8 adiado, R2 a R4).

## Adendo: reteste de R1 (commit `20478b8`, 2026-11-10)
- **R1: corrigido.** `npx vitest run src/domain`: 4 arquivos, **136 passed** (novo: `skill-planilha.test.js`, 3 testes).
- Reprodução de R1 (`qa45b/parcial.json` → script `--xlsx` → `lerPlanilha` → `validarAba` → `mesclarPlanilha`, `xlsx-parcial.mjs`): saída 0; só `nightly` 700 e `cost` 95 mudam; hotel "Hotel X", café, status "Reservado"/"Pago", notas e hora preservados. Cabeçalhos do .xlsx gerado: Cidades `id, cidade, check_in, check_out, custo_diaria`; Atracoes `id, data, nome, custo`.
- Linhas com `id` e colunas diferentes (`misto.json`: a1 com `custo`, a2 com `status`): saída **1**, "a planilha não foi gerada ... linha 2 (id "a1"): sem "status"; linha 3 (id "a2"): sem "custo" ... importe o .json", e **nenhum .xlsx criado** (`ls` confirma).
- Sem regressão: exemplo sem `id` gera o .xlsx (saída 0, 8 linhas em 6 abas); guarda de caminho segue recusando `src/nao.xlsx` (saída 1).
- Achados novos (baixos): (a) o bloqueio é conservador: item novo com `status` + atualização por `id` sem `status` na mesma aba também recusa o .xlsx (`novo.json`), embora o app não apagasse nada de itens novos; seguro, só restritivo. (b) SKILL §7 ainda diz "os três arquivos" e o `.xlsx` pode não existir nesses casos; ajustar o texto.
- `git -C wt41 status -s --ignored`: `!! dist/`, `!! firestore-debug.log`, `!! node_modules`. Nada criado no worktree; nenhum emulador ou porta usados neste adendo (só vitest e o script).
- **Veredito final: APROVADO COM RESSALVAS.** Nenhum bloqueador ou alto em aberto. Ressalvas: D8 (adiado por decisão: `http`→`https`, `duracao_min`), R2, R3, R4, (a) e (b) acima, e itens "Não verificado" da seção 6.
