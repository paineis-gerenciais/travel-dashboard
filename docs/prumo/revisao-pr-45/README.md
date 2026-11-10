# Revisões do PR #45 (issue #41)

Rastro das revisões cruzadas da skill `roteiro-viagem` e da importação de JSON. Tudo com dados fictícios.

| Arquivo | O que é |
|---|---|
| `seguranca.md` | devsecops-engineer, sobre `1f81e4d`: **aprovado com ressalvas** (M1 e M2 médios; B1 a B3 baixos) |
| `qa.md` | qa-engineer, sobre `1f81e4d`: **reprovado** (D1 alto; D2 a D4 médios; D5 a D10 baixos) |
| `qa-reteste.md` | qa-engineer, sobre `2c9aea4`: **reprovado** (R1 alto, no `.xlsx` do script); adendo sobre `20478b8`: **aprovado com ressalvas** |
| `provas-seguranca/` | Entradas hostis e scripts de medição da revisão de segurança (`gen.mjs` gera os arquivos grandes, que não foram versionados) |
| `provas-qa/rodada-1/`, `provas-qa/reteste/` | Casos de domínio e E2E exploratórios do QA (`*-e2e.registro.js` são registros; não estão na pasta `e2e/` e não rodam na suíte) |

## Como as correções foram feitas
| Achado | Correção | Commit |
|---|---|---|
| M1 agente com leitura de arquivos e acesso à web | `pesquisador-destino` sem `Read`; skill e agente tratam conteúdo de página como dado | `a6b9914` |
| M2, B1, D5, D6 guarda de caminhos | script só lê e grava em `importacoes/` dentro do repositório, comparando caminhos reais; BOM aceito | `2c9aea4` |
| B3 objeto com `toString` falso | célula só aceita valor simples | `a6b9914` |
| B2 link com usuário e senha | já corrigido no PR #36 (issue #18) | — |
| D1 coluna ausente zerava campos | "não enviada" não altera o item (JSON, `.xlsx`, Colar) | `402a6f7` |
| D2, D3, D4, D7, D9, D10 | datas absurdas recusadas; aviso de duplicatas; colunas sem caixa e acento; avisos de abas e colunas ignoradas; mensagens | `402a6f7` |
| R1 `.xlsx` do script zerava campos | planilha leva só as colunas usadas e não é gerada quando apagaria dados | `20478b8` |

Os caminhos `<raiz-do-repositório>` e `<pasta-temporária-da-sessão>` substituem os caminhos absolutos da sessão em que as revisões rodaram. Para reexecutar um script, troque o prefixo pela raiz do seu clone.

**Incidente de processo:** durante a revisão de segurança, a limpeza apagou a pasta de trabalho do QA, que rodava em paralelo no mesmo worktree (`importacoes/qa/`). Nenhum arquivo versionado foi afetado, e o QA refez as execuções. Lição: cada delegação paralela recebe uma pasta fora de áreas compartilhadas.
