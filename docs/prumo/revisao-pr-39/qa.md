# Parecer de qualidade: PR #39 (fix/25-edicao-por-id, commit ac82ecb)

- **Demanda:** #25 · **Responsável:** qa-engineer · **Data:** 2026-11-10
- **Parecer:** APROVADO
- **Contagem de defeitos:** bloqueador 0 · alto 0 · médio 0 · baixo 3 (backlog)

Ambiente: worktree `wt39` (main atual mesclado), emuladores Firestore e Auth (`--project demo-fake`), Chromium (Playwright) 1280x900, build de teste com variáveis fictícias. Dados fictícios. Scripts em `qa3839/` (`qa39-registro.mjs`, `lib.mjs`, `run.sh`). Controle: o mesmo script contra o build de `wt38` (código sem a #25).

## Critérios de aceite
| Critério (issue #25) | Resultado | Evidência |
|---|---|---|
| Todas as ações de item, cidade e checklist recebem `id`; nenhuma recebe posição | atendido | `grep` em `src/` por `actions.updateItem|deleteItem|setCity*|deleteCity|toggleChecklist|setOtherDate`: todas as chamadas passam `x.id`/`c.id`/`id`; nenhum `[index]` de `cities`, `checklist` ou itens fora do domínio. Comportamento confirmado no navegador (T1 a T3) |
| Todas as folhas de edição guardam o `id` | atendido | `Cidades.jsx`, `Dias.jsx` (`{kind, id}`), `Mais.jsx` (Checklist e "Anexar link"). Folha some se o item some (`Dias.jsx:351`) |
| Teste de jornada: cidade nova, check-in anterior com a folha aberta, folha continua na cidade nova e a outra não muda | atendido | E2E do PR passa em mobile e desktop com o PR (20 passed). Falha sem a correção: o mesmo spec contra o build sem a #25 dá `Expected "2030-06-01", Received "2030-06-10"` nos 2 projetos |
| Teste de domínio/store: excluir por id remove o item certo depois de reordenar | atendido para cidades; itens e checklist só por jornada | `domain.test.js`: "exclui pelo id certo depois de uma reordenação (inclusive a cascata)" e "id inexistente não remove nada" (cidades). A exclusão de item e checklist por id (`TripProvider.deleteItem`) não tem teste automático; verificada nos meus T2.*.3 e T3.4 |

## Testes executados
| Tipo | Comando ou procedimento | Resultado |
|---|---|---|
| Unitários (do autor) | `npx vitest run src/domain` em `wt39` | 120 passed |
| Jornada do autor | `npm run test:e2e -- --project demo-fake` | 20 passed (21,8 s), inclui o novo nos dois projetos |
| Novo E2E contra código sem a correção | spec copiado de `wt39` rodado contra o build de `wt38` (`-g reordenada`) | 2 failed, como o PR afirma |
| Jornada do QA (item por id, 2 contextos) | `firebase emulators:exec --project demo-fake --only firestore,auth "qa3839/run.sh wt39 39 qa39-registro.mjs wt39"` | 29 verificações, 0 falhas |
| Controle | o mesmo script contra `wt38` (`... run.sh wt38 38 qa39-registro.mjs wt38`) | 29 verificações, 20 falhas, que mostram o defeito original (ver abaixo) |
| Acessibilidade e responsividade | não houve mudança de marcação nem de estilo; não refeitas | ver "Não verificado" |

### O que o teste do QA cobre (todos com colaborador mudando a lista com a folha aberta)
- **Cidades (T1):** folha aberta em Porto; colaborador insere "Faro" no início; a folha continua em Porto; a hospedagem digitada grava em Porto; "Excluir só a cidade" remove Porto e preserva as demais; com o diálogo de exclusão aberto e outro reordenando, "Excluir cidade e itens ligados" remove só Lisboa e os itens dela.
- **Transporte, alimentação, atração e outras despesas (T2, via Dias):** folha do 2º item aberta; colaborador insere um item no início; a folha continua no mesmo item; editar grava no item certo; "Excluir item" remove o item certo. As 4 telas passam e sem `pageerror`.
- **Checklist (T3, via Mais):** marcar com a busca ativa marca o item certo (status Concluído); renomear após inserção remota grava no item certo; "Anexar link" aberto com inserção remota grava o link em "Passaporte"; "Excluir" remove só o escolhido.
- **"Mover":** o app não tem ação de mover nas telas ativas (só `setOtherDate`, usado só na tela antiga `Outras.jsx`, que não é mais roteada). Tratei "mover" como reordenação por mudança remota, acima.

### Controle (código sem a #25), prova de que o teste pega o defeito
- Folha de Porto passou a mostrar Lisboa; hospedagem digitada foi gravada em Lisboa; "Excluir" removeu Lisboa e manteve Porto.
- Em atração, refeição, transporte e outras despesas: após uma inserção remota a folha mostrou o item vizinho ("Torre de Belém" no lugar de "Castelo São Jorge", etc.), a edição foi gravada no item errado e "Excluir item" ficou sem efeito no item pretendido.
- "Anexar link" do checklist foi gravado em "Protetor solar" em vez de "Passaporte".

## Viagem legada sem ids, dois contextos (pedido específico)
Documento gravado pelo admin sem nenhum `id` (3 cidades, 3 atrações, 3 refeições, 3 transportes, 3 despesas, 3 itens de checklist), com os usuários A e B como membros. Comentários ligados ao id derivado pelo domínio (`idLegado`) do 2º item de atração, refeição e transporte.
- **T4.1:** nos dois contextos o comentário aparece só no 2º item de cada tipo ("1 comentário(s)"). Logo os dois clientes derivaram os mesmos ids, e iguais ao que o domínio calcula (`attractions=lbqumse0,lsvyppj1,lr5vskk2`, `foodItems=l1sdpl3h0,lcy562e1,lit6eij2`, `transports=l1hc3jfr0,l1i98zs61,l2toita2`).
- **T4.3:** A renomeia a atração 2; o documento passa a ter ids em todas as 6 coleções, iguais aos do domínio; B vê o item renomeado ainda com o comentário.
- **T4.4:** B edita a atração 3 e exclui a 1; o documento fica `Castelo EDITADO | Oceanário EDIT`; A deixa de mostrar o item excluído e não troca de item.
- **Comentário em item sem id (registrado, T4.2):** no código sem a #25 todos os itens sem id compartilhavam a chave `attractions:undefined` e mostravam o mesmo comentário (o controle mostrou "2 comentário(s)" nas três atrações). Com a #25 cada item ganha chave própria; o comentário antigo gravado em `attractions:undefined` deixa de aparecer nos itens e, em Mensagens, aparece como "O item comentado não existe mais". Comentários de itens que já tinham id não mudam.

## Defeitos encontrados
| Sev. | Descrição | Passos para reproduzir | Esperado x obtido | Responsável sugerido |
|---|---|---|---|---|
| Baixo (D1) | Comentários antigos gravados com chave `<tipo>:undefined` (item que nunca teve id) ficam órfãos depois da #25 | Seed: atrações sem id + comentário `attractions:undefined`; abrir Dias e Mensagens (`qa39-registro.mjs` T4.2) | Esperado manter o comentário visível ou migrar a chave. Obtido: some dos itens e aparece como "item removido". [HIPÓTESE] pode não existir dado real assim, já que os criadores sempre gravam `uid()`; vale checar na produção real (fora do meu escopo) | autor / data-bi (verificar se há dados; se houver, migrar a chave) |
| Baixo (D2) | Folha aberta num item legado sem id fecha sozinha, sem aviso, se o conteúdo do item mudar no documento por quem não grava ids (o id derivado depende do conteúdo e da posição, `state.js:93`) | Doc legado; abrir a folha da atração 2; o admin apaga os ids e muda o nome (`qa39-registro.mjs` T4.5) | Esperado folha estável. Obtido "folha fechou sozinha". Só ocorre com documento que perdeu os ids (importação ou cliente que não os preserva); um cliente anterior à #25 preserva os ids que já existem | autor (backlog; some depois que todo documento tiver sido salvo uma vez) |
| Baixo (D3) | Cobertura de teste automático estreita: o E2E novo cobre só cidades e só com 1 usuário; itens do dia e checklist por id e a reordenação por colaborador não têm E2E. O PR já aponta "duas contas" para a #26 | n/a | Esperado teste para itens e checklist. Obtido só domínio e cidades. Os blocos T2 e T3 de `qa39-registro.mjs` podem ser adaptados (mudança remota simulada por admin) | qa-engineer / autor (junto com a #26) |

## Não verificado
- Acessibilidade (teclado, foco, contraste) e responsividade a 360/768 px: o PR não muda marcação, estilo nem rótulos; não repeti. O foco ao fechar a folha por exclusão não foi conferido.
- Duas contas reais conectadas ao mesmo tempo com edições concorrentes campo a campo (escopo da #26). Usei colaborador simulado por admin (gravação do documento inteiro).
- Telas antigas (`Alimentacao`, `Atracoes`, `Checklist`, `Outras`, `PorDia`, `Transporte`): sem rota ativa em `App.jsx`; só lidas.
- Ordem das chaves do objeto no Firestore entre versões do SDK (o id derivado usa `JSON.stringify` do item). Nos dois contextos, mesmo SDK e navegador, os ids foram iguais. [HIPÓTESE] seguro enquanto o Firestore devolver as chaves em ordem estável.
- Desempenho e prévia do PR no Firebase real (proibido pelo escopo).

## Riscos remanescentes
- O id legado é gravado só no primeiro salvamento. Se um cliente que não preserva ids gravar o documento antes disso, os ids são recalculados e podem mudar (D2).
- Persistência dos ids depende do efeito de salvamento existente. Observei em 2 rodadas que o documento às vezes é regravado ao abrir a viagem (sem edição) e às vezes não, mas isso não afeta a correção, pois os ids são sempre recalculados do mesmo modo.
