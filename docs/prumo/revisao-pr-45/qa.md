# Parecer de qualidade: PR #45 (travel-dashboard)

- **Demanda:** travel-dashboard#41 · **Responsável:** qa-engineer · **Data:** 2026-11-10
- **Branch:** `feat/41-skill-roteiro-importacao-json` (`bf54be4`, `1f81e4d` sobre `main`)
- **Ambiente:** Node 22.23.4, Vitest 1.6.1, Playwright (mobile Pixel 5 e desktop Chrome), emuladores Firestore e Auth, build de `dist/` com variáveis fictícias. Dados 100% fictícios.
- **Parecer:** REPROVADO (1 defeito alto em aberto: atualização por `id` com colunas omitidas apaga campos).

## Critérios de aceite
| Critério | Resultado | Evidência |
|---|---|---|
| JSON `{formato, versao, abas}` entra pela tela Planilha com a mesma validação, prévia e mesclagem | atendido | E2E `importacao-json.spec.js` 6 passed; exploratório: prévia "Conferência" com "1 a criar" por aba |
| Mesclagem insere e atualiza, nunca apaga | atendido | `mesclarPlanilha` não remove itens; E2E aplica sem remover nada |
| Atualização por `id` mexe só nas colunas enviadas (SKILL.md:83) | **não atendido** | D1 abaixo (casos.mjs C12b) |
| "Importar JSON" recusa o arquivo de importação | atendido | E2E (alert com texto) + leitura de `Mais.jsx:63-66` |
| Script valida com o código do app e só grava `.xlsx` em `importacoes/` | atendido com ressalva | recusa raiz, `src/`, `..`, prefixo parecido; mas grava fora do repositório e atravessa symlink (D5, D6) |
| Exemplo fictício em `e2e/fixtures/importacao-exemplo.json` | atendido | script saída 0, 8 linhas em 6 abas |
| `importacoes/` no `.gitignore` | atendido | `git status` limpo com `importacoes/qa/` cheio |

## Plano de testes e resultado (casos de borda)
| # | Caso | Resultado |
|---|---|---|
| 1 | JSON mal formado | app: toast "Arquivo JSON inválido."; script: saída 1 com posição do erro. OK |
| 2 | `abas: {}` | app: "Nenhuma aba reconhecida. Use o modelo do app."; script saída 1. OK (mensagem fala de "modelo", D9) |
| 3 | `abas` array, JSON `null`, `[1,2]`, versão 2, versão ausente | recusados com toast/erro. Mensagens "versão undefined" e `versao:"1"` → "versão 1 não suportada (esperada: 1)" confusas (D9) |
| 4 | Linha que não é objeto (`"x"`, 5, `[1]`, null) | viram linha vazia e são ignoradas; linha seguinte mantém o número correto. OK |
| 5 | `cafe_incluso: true/false/1`, custo `650.5`, `"650,50"`, `1e3`, `duracao_min` 90.5 | aceitos: true, false, true, 650.5, 650.5, 1000, 91. `cafe_incluso: 2` e `"talvez"` dão erro na coluna. OK |
| 6 | `duracao_min` -5, "1h30" | -5 vira 0; "1h30" vira 130 sem erro (D8) |
| 7 | Data como número | 47000 → 2028-09-04 (série Excel, intencional); **20300610 → "+057481-03" aceito** (D2); 0 → 1899-12-30; `true` → erro; `"2030-02-30"` aceito (já existia) |
| 8 | Aba "Atrações", "cidades", " OUTRAS ", "Alimentação" | reconhecidas. OK |
| 9 | Aba "Foguetes" | script avisa; **app ignora sem avisar** quando há outras abas válidas (D7) |
| 10 | Colunas "Cidade", "Check_in" | chave perdida em silêncio; erro enganoso "cidade: obrigatório" (D4) |
| 11 | Abas "Cidades" e "cidades" no mesmo arquivo | a segunda sobrescreve a primeira, sem aviso (D4) |
| 12 | Coluna desconhecida/typo (`hospedagm`) | ignorada sem aviso (D4) |
| 13 | Mesmo arquivo importado duas vezes | **comportamento conhecido:** sem `id`, cria de novo. Prévia idêntica nas duas vezes ("1 a criar"), sem aviso de duplicata; total de Lisboa passou a 2 cidades e o custo dobrou (R$ 4.080 no painel). O script com `--viagem` avisa; o app não (D3) |
| 14 | `id` existente, colunas omitidas | **falha** (D1) |
| 15 | `id` inexistente | vira item novo; script avisa. OK |
| 16 | `id` numérico/com espaços | `5` → "5", `" x "` → "x". OK |
| 17 | `__proto__`/`constructor` como nome de aba, `id: "__proto__"` | sem poluição; abas vão para ignoradas. OK |
| 18 | Link `http://`, `javascript:`, sem esquema, objeto | http vira https em silêncio; javascript e objeto dão erro; "exemplo.com" vira https. Já existia |
| 19 | Texto como objeto/array | vira "[object Object]" / "x,y" sem erro (D8) |
| 20 | Arquivo com BOM | app: aceita (prévia aberta); **script: recusa** com erro de JSON (D6b) |
| 21 | Arquivo de 2,1 MB | app: "Arquivo JSON grande demais (máximo 2 MB)." OK |
| 22 | Backup do app (`cities`) enviado em Planilha | recusado com "formato diferente de planilha-viagem": correto, mas sem dica (D9) |

## Testes executados
| Tipo | Comando ou procedimento | Resultado |
|---|---|---|
| Domínio (autor) | `npx vitest run src/domain` | 2 arquivos, **118 passed** |
| E2E do PR | `npx firebase emulators:exec --only firestore,auth "npx playwright test e2e/importacao-json.spec.js"` | **6 passed** (3 testes × mobile e desktop) |
| Domínio extra (meu) | `node qa45/casos.mjs` (18 grupos de casos, chamando `matrizesDeJson`, `validarAba`, `mesclarPlanilha` do worktree) | saídas acima; D1, D2, D4, D8 reproduzidos |
| Script | 27 chamadas (lista em "Evidências do script") | exit codes conforme esperado, exceto D5/D6 |
| E2E exploratório (meu) | `qa45/qa-e2e.registro.js`, mobile e desktop, mesmo emulador | toasts, duplicata e data numérica confirmados no app |
| Acessibilidade | região do toast: `role="status" aria-live="polite"` sempre montada; captura mobile do toast | toast visível e legível sobre a folha; não rodei axe (não está instalado) |
| Responsividade | toasts em Pixel 5 (393 px) e Desktop Chrome | sem quebra; tablet não testado |
| Desempenho | — | não aplicável (sem tela nova) |

## Evidências do script (saídas)
- Exemplo `--xlsx importacoes/qa/ok.xlsx`: saída 0, "8 linha(s) em 6 aba(s)".
- Mal formado: saída 1 "Expected ',' or ']' ... (line 1 column 91)". Vazio e só aba desconhecida: saída 1 "nenhuma aba reconhecida". `[1,2]` e `null`: saída 1 "formato diferente".
- Sem argumentos e opção desconhecida: saída 2 com uso.
- Guarda: `raiz-nao.xlsx`, `src/nao.xlsx`, `importacoes/../src/nao.xlsx`, `importacoes/qa/../../nao2.xlsx`, `importacoes-outra/nao.xlsx`, `importacoes` (a própria pasta): todos saída 1 "grave a planilha dentro de importacoes/". Nada gravado.
- `--viagem` com cópia fictícia: reimportar o exemplo dá "2 a criar, 0 a atualizar" + aviso "parece duplicar ... id c1/a1"; `id zzz` dá aviso "não existe na viagem"; viagem inexistente: saída 1.
- **Furos da guarda:** `--xlsx /tmp/.../fora.xlsx` e `--xlsx /home/user/...` gravaram (saída 0); `--xlsx importacoes/qa/link-src/x.xlsx` com `link-src` → `../../src` gravou em `src/` (apaguei os arquivos de teste e o symlink).

## Defeitos encontrados
| ID | Severidade | Descrição | Passos para reproduzir | Esperado × obtido | Onde |
|---|---|---|---|---|---|
| D1 | **Alto** | Atualizar item existente por `id` enviando só algumas colunas **zera** as outras colunas da planilha (status, custo, hospedagem, notas, hora, café). A prévia só diz "N a atualizar". | 1) Viagem com cidade `{id:c1, hotel:"Hotel X", nightly:650, breakfastIncluded:true, status:"Reservado"}` e atração `{id:a1, cost:90, status:"Pago", time:"10:00"}`. 2) JSON `Cidades:[{id:"c1",cidade:"Lisboa",check_in:"2030-06-10",check_out:"2030-06-13",custo_diaria:700}]`, `Atracoes:[{id:"a1",data:"2030-06-11",nome:"Museu",custo:95}]`. 3) `validarAba` + `mesclarPlanilha` (o que "Aplicar" faz). | Esperado (SKILL.md:83, "mande só as colunas que mudam"): só `nightly`/`cost` mudam. Obtido: cidade fica `hotel:""`, `breakfastIncluded:false`, `status:"Planejado"`, `notes:""`; atração fica `status:"Planejado"` (era Pago), `time:""`. Campos fora da planilha (paidBy, split, link) sobrevivem. | `src/domain/sheet.js:162-164` (todas as colunas do ESQUEMA viram cabeçalho; chave ausente vira `''`) + `sheet.js:240-258` (vazio vira padrão, não "não enviado"); contrato em `SKILL.md:83` |
| D2 | Médio | Número em coluna de data vira data inválida e é aceito. `data: 20300610` (AAAAMMDD, erro plausível de modelo de IA) → `"+057481-03"`; o painel mostra "A viagem passa por Lisboa, de undefined/03/+057481 a 13/06/2030". `0` → 1899-12-30. | Importar `{"Outras":[{"data":20300610,"nome":"x"}]}` em Mais → Planilha e aplicar. O script também diz "ok". | Esperado: erro de data (ou limite de faixa). Obtido: prévia "1 a criar" e datas do painel corrompidas. O ramo de número existia (xlsx), mas o JSON o torna fácil de acionar | `src/domain/sheet.js:191-197` (`parseDataCelula`, sem limite de faixa); `sheet.js:164` |
| D3 | Médio | Reimportar o mesmo arquivo duplica tudo e a prévia não avisa. Comportamento conhecido (linha sem `id` = item novo), mas duplicar cidades dobra o custo total. | Importar `importacao-exemplo.json`, aplicar, importar de novo: ambas as prévias dizem "N a criar · 0 a atualizar". | Esperado: aviso de possível duplicata como o script faz com `--viagem`. Obtido: nenhum aviso. Sugestão: aviso na prévia ou, no mínimo, texto "importar duas vezes duplica" | `SheetImportSheet.jsx:57-69`; script `validar-importacao.mjs:131-145` |
| D4 | Médio | Chaves do JSON são casadas exatamente; o que não casa some sem aviso: `"Cidade"`/`"Check_in"` (caixa), typos (`hospedagm`) e duas abas que normalizam para o mesmo tipo (`Cidades` + `cidades`: a segunda substitui a primeira inteira). Com chave de caixa errada, o erro é "cidade: obrigatório", que engana (o dado estava no arquivo). | JSON `{"cidades":[{"Cidade":"Lisboa","Check_in":"2030-01-01","check_out":"2030-01-03"}]}` → erros de `cidade` e `check_in`. | Esperado: casar sem diferenciar caixa (como o cabeçalho do xlsx, `validarAba:299`) e avisar colunas/abas desconhecidas ou repetidas. Obtido: perda silenciosa | `src/domain/sheet.js:157-166` |
| D5 | Baixo | A guarda do script permite gravar fora do repositório (`/tmp`, `/home`), mas `SKILL.md:106` e a issue dizem "só dentro de `importacoes/`". O E2E usa isso de propósito (`e2e/importacao-json.spec.js:57`). | `node ... exemplo.json --xlsx /tmp/x.xlsx` → grava. | Esperado/obtido divergem do texto; ajustar o texto ou a guarda | `validar-importacao.mjs:153-154`; `SKILL.md:106` |
| D6 | Baixo | (a) Guarda por caminho textual, não por `realpath`: symlink dentro de `importacoes/` aponta para `src/` e grava lá. Exige symlink plantado, risco baixo. (b) Script recusa JSON com BOM (editor do Windows), enquanto o app aceita. | (a) `ln -s ../../src importacoes/qa/link-src`; `--xlsx importacoes/qa/link-src/x.xlsx`. (b) arquivo com `\xEF\xBB\xBF` no início. | (a) esperado: recusar. (b) esperado: aceitar como o app | `validar-importacao.mjs:153-154`; `:54` |
| D7 | Baixo | O app ignora abas desconhecidas sem avisar (`ignoradas` é calculado em `matrizesDeJson` e descartado). Ex.: aba "Hospedagem" com 10 linhas some enquanto "Cidades" importa. | JSON com `Cidades` válida + `Hospedagem` | Esperado: aviso na prévia. Obtido: nada | `SheetImportSheet.jsx:83-92` |
| D8 | Baixo | Coerções silenciosas já existentes, agora fáceis de acionar pelo JSON: `duracao_min` "1h30" → 130 e -5 → 0; texto como objeto → "[object Object]"; `http://` vira `https://`; `"2030-02-30"` aceito. | casos 6, 18, 19 | Esperado: erro. Obtido: valor aceito | `sheet.js:200-204,248-256` |
| D9 | Baixo | Mensagens: "Nenhuma aba reconhecida. Use o modelo do app." não serve a quem enviou JSON (não há modelo JSON); versão ausente mostra "versão undefined"; `"1"` (texto) mostra "versão 1 não suportada (esperada: 1)"; backup do app enviado em Planilha não aponta "Mais → Importar JSON". O toast some em 3,2 s (padrão do app) e leva uma frase longa. | casos 2, 3, 22 | Mensagens mais claras | `SheetImportSheet.jsx:89,98`; `sheet.js:150-152`; `ui.jsx:206` |
| D10 | Baixo | Teste do autor com indentação fora do padrão (linha do `expect(contagem)`). ESLint não roda (sem arquivo de configuração no repositório). | — | — | `src/domain/__tests__/importacao-json.test.js:26` |

Acessibilidade e mensagens (critério 3): o aviso de erro de JSON é anunciado por região `role="status" aria-live="polite"` e o texto é compreensível ("Arquivo JSON inválido."; "Arquivo JSON não reconhecido: versão 2 não suportada (esperada: 1)"). O `alert` de "Importar JSON" é claro e indica o caminho certo ("Planilha → Enviar planilha preenchida") e o efeito ("cria e atualiza ... sem apagar nada"). Ressalvas: a região fica fora da folha `aria-modal`, e não testei com leitor de tela (D9 e "Não verificado").

## Não verificado
- Leitor de tela (anúncio real do toast sobre folha modal) e axe: não instalado.
- Tablet (768 px) e contraste do toast vermelho: só inspeção visual em 393 px e desktop.
- Seleção de `Atrações` etc. na tela de lista após importar (apenas Cidades e painel).
- Atualização por `id` pela interface (usei o domínio, que é o que `aplicar` chama).
- Desempenho com arquivo próximo de 2 MB (testei só a recusa acima de 2 MB).
- Pesquisa real da skill e do agente (fora de escopo); conteúdo de `pesquisador-destino.md` só lido.
- Segurança (privacidade, injeção): fora do escopo; nada a registrar além do symlink (D6a).

## Riscos remanescentes
- D1 afeta exatamente o fluxo que a skill promete ("viagem que já existe: atualizar pelo `id`"): status "Pago" pode voltar para "Planejado" sem o usuário perceber.
- A skill pode produzir os erros D2 e D4 sem que o script os apanhe (o script usa o mesmo código).

## Condição para aprovar
Corrigir D1 (ou, no mínimo, trocar a orientação em `SKILL.md:83` para "envie a linha completa" **e** avisar na prévia que colunas vazias sobrescrevem) com teste de regressão no domínio; corrigir D2 (erro para número fora da faixa de data). D3 e D4 podem ir para issue aberta; D5 a D10 para o backlog.

## Limpeza
`importacoes/qa/` removida; arquivos de teste em `src/` e fora do repositório removidos; `git status -s` vazio ao final. Ignorados e preexistentes ao meu trabalho: `dist/`, `firestore-debug.log` (gerados pelo build e pelo emulador).

## Nota pós-aviso do Head (pasta `importacoes/` apagada pela revisão de segurança)
A pasta `importacoes/` do worktree foi apagada por outra revisão depois das minhas execuções; as saídas acima foram colhidas antes. Reexecutei amostras no commit `1f81e4d`, com arquivos em `qa45/` e sem `importacoes/`: JSON mal formado (saída 1), data numérica 20300610 (saída 0, D2 confirmado), `--xlsx src/nao.xlsx` (saída 1, guarda atual), `--xlsx` fora do repositório (grava, D5 confirmado) e `casos.mjs` C12b (D1 confirmado). Os resultados avaliam a guarda e a pasta de saída **atuais**; D5 e D6 podem mudar com a alteração prevista pelo Head. `git status -s` vazio.
