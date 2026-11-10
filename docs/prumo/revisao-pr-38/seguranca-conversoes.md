# Parecer de segurança: conversões de dados na leitura (PR #38 e PR #39)

- **Demanda:** paineis-gerenciais/travel-dashboard#24 (PR #38) e #25 (PR #39) · N2, gatilho "migração de dados" · **Responsável:** devsecops-engineer · **Data:** 2026-11-10
- **Escopo analisado:** `migratePayments` (#38, worktree `wt38`, commit `f667be3`) e `idLegado` (#39, worktree `wt39`, commit `ac82ecb`), comparados com `origin/main` (`db6799e`). Só o domínio e o store; telas apenas onde mudam o contrato.

## Resumo

**#38: reprovado como está.** Há dois achados altos de integridade financeira, provados no domínio. (1) O modelo antigo trata as confirmações como cumulativas: confirmou R$ 45, a dívida subiu e confirmou R$ 75. A conversão soma as duas (R$ 120) e inverte a dívida (prova 1B). (2) A conversão esvazia `settlementsDone`. Com isso, o rollback e as abas antigas (o PWA não recarrega sozinho) mostram como pendentes os acertos já pagos. Se alguém confirmar de novo, o pagamento é contado duas vezes (prova 2A). Há também um achado médio: sobra R$ 0,01 pendente em viagens que estavam acertadas (provas 1A e 2D). A correção é pequena e foi prototipada fora do repositório: as provas passam (anexo C).

**#39: aprovado com ressalvas.** Os ids são determinísticos e o rollback é seguro. O código antigo preserva os ids. Restam riscos baixos: comentários podem ficar órfãos (aparecem como "Item removido") numa janela curta, e os ids duplicados não são tratados.

## Ameaças consideradas
| Ativo | Ameaça (STRIDE) | Controle existente | Lacuna |
|---|---|---|---|
| Saldos e acertos (`settings.settlementsDone`/`payments`) | Tampering involuntário: conversão com semântica errada | Conversão idempotente por id | Semântica cumulativa ignorada; legado apagado (A1, A2) |
| Saldos e acertos | Repudiation/integridade: cliente antigo grava por cima (última gravação vence) | Nenhum (ADR-0001/#26 vai tratar) | Ressurreição e perda de pagamento (M2) |
| Vínculo comentário ↔ item (`itemKey`) | Integridade referencial | Id determinístico | Id muda se o conteúdo ou a posição mudarem antes da 1ª gravação (B1) |
| Itens da viagem | Exclusão indevida | — | `deleteItem` apaga todos os itens com o mesmo id (B4) |

## Achados

| # | Severidade | Achado | Evidência | Recomendação e custo |
|---|---|---|---|---|
| A1 | **Alto** (#38) | **Dupla contagem de confirmações cumulativas.** No `main`, os saldos nunca descontam confirmações. Confirmar só marca a transferência atual como feita, e chaves vencidas continuam na lista: `toggleSettlementDone` filtra só a mesma chave (`main:src/store/TripProvider.jsx:219-224`). Se a dívida muda e alguém confirma de novo, a lista guarda as duas chaves do mesmo par. A segunda já representa o total. `migratePayments` converte todas em pagamentos (`wt38:src/domain/state.js:151-168`). | [FATO] Prova 1B: `settlementsDone=[pb>pa>4500, pb>pa>7500]`. O `main` mostra "tudo confirmado". O #38 resulta em pagamentos de 45 + 75 e saldo `pa:-4500 pb:4500`, ou seja, a dívida aparece invertida. | [RECOMENDAÇÃO] Converter só as chaves que batem com o acerto **atual**, calculado uma vez, como a tela antiga fazia. Vale a mais recente primeiro. Aceitar diferença de até 1 centavo por despesa (float × maior resto) e usar o valor novo em centavos. Chave vencida não vira pagamento: a tela antiga já a mostrava como pendente. Custo: cerca de 20 linhas em `state.js` (importa `split.js`; não há import circular) e 4 testes. **2 a 3 h.** Protótipo no anexo C. |
| A2 | **Alto** (#38) | **Esvaziar `settlementsDone` quebra o rollback e as abas antigas.** `s.settings.settlementsDone = []` (`wt38:src/domain/state.js:167`). O PWA usa `autoUpdate` com `skipWaiting`/`clientsClaim`, mas o `registerSW.js` gerado só registra o service worker e não recarrega a página (`dist/registerSW.js`; `vite.config.js:6-12` diz "aplicadas na próxima abertura"). Abas e PWAs em segundo plano rodam o bundle antigo por horas ou dias. | [FATO] Prova 1A (rollback): o `main` lê o estado gravado pelo #38 e mostra os 2 acertos como "pendente". O array `payments` continua no objeto, porque o `main` faz spread de `settings` (`main:src/domain/state.js` normalizeState). [FATO] Prova 2A: a aba antiga vê os acertos pendentes e confirma de novo, com novo `at`. O id `mig-<key>-<at>` muda, e o cliente novo cria 4 pagamentos. Saldo final: `pa:3332 pb:3333 pc:-6665`, ou seja, Caio "deve" R$ 66,65 que não deve. | [RECOMENDAÇÃO] (a) **Não esvaziar** `settlementsDone` nesta versão; ele vira só leitura. (b) Converter **uma vez por viagem**, com a marca `settings.paymentsMigrated = true`. Essa marca impede que um "Desfazer" seja desfeito na releitura. (c) Usar o id `mig-<key>`, sem `at`. Com isso, o rollback mostra o mesmo de antes e a aba antiga não vê nada para reconfirmar. Custo: incluído em A1. Remover `settlementsDone` fica para uma versão futura, depois da #26. |
| M1 | Médio (#38) | **Sobra R$ 0,01 depois da conversão.** A chave antiga vem do cálculo em ponto flutuante (33,333… vira 3333). O saldo novo usa o maior resto (alguém fica com 33,34). | [FATO] Provas 1A e 2D: viagens "tudo confirmado" passam a mostrar `pa>pc>1` ("Ana paga para Caio R$ 0,01"). | [RECOMENDAÇÃO] Resolvido pela tolerância com o valor novo (A1). Anexo C: saldos zerados. |
| M2 | Médio (#38, preexistente) | **Gravação de memória antiga por cima ("última gravação vence").** Ids `mig-…` são determinísticos e não duplicam ao reconverter. Porém um pagamento confirmado só no cliente novo se perde, e um pagamento desfeito volta. | [FATO] Prova 2B: ids regenerados iguais (`true`); `uidNOVO` e a despesa `d3` se perdem. Prova 2C: depois de desfazer, sobrescrita antiga → 2 pagamentos de novo. | [RECOMENDAÇÃO] É o defeito de base do modelo de documento único. A correção é a #26 (ADR-0001, gravação por campo). Manter a issue aberta e avisar os membros para reabrir o app (ver Implantação). Sem custo extra aqui. |
| B1 | Baixo (#39) | **Comentário órfão numa janela curta.** O id legado depende da posição e do conteúdo (`wt39:src/domain/state.js:80,93-98`). Ele só é gravado na próxima mutação de um cliente novo; comentário não grava o `state`. Se uma aba antiga editar o item, ou excluir um item anterior, antes dessa gravação, o id muda. | [FATO] Prova 2H: depois de editar o custo pela aba antiga, `attractions:l19tntr81` não acha o item. Prova 2I: excluir o 1º item muda os ids dos seguintes. Prova 2J: depois que o id foi gravado, ele fica estável. O comentário não é apagado: aparece em Mensagens como "Item removido" (`MessagesSheet.jsx:51-55`). | [RECOMENDAÇÃO] Opcional: no hash, usar a ordem de ocorrência entre itens de conteúdo idêntico, em vez da posição absoluta. Assim, inserir ou excluir outros itens não muda o id. Custo: cerca de 1 h. |
| B2 | Baixo (#39) | **Comentários antigos de itens sem id ficam órfãos.** No `main`, item sem id gerava `itemKey` `"<tipo>:undefined"` (template em `main:src/components/screens/Dias.jsx:273,293,311`), e todos os itens sem id do mesmo tipo dividiam essa conversa. Com o #39 nenhum item tem esse id. | [FATO] Prova 2K. Os dados continuam no Firestore e aparecem em Mensagens como "Item removido". | [RECOMENDAÇÃO] Registrar no PR. Não dá para religar com segurança, porque a conversa já era compartilhada. Custo zero. |
| B3 | Baixo (#39) | **O id depende da ordem das chaves do objeto** (`JSON.stringify`). | [FATO] Prova 2E: `{name,cost}` gera `l1ejbdpc0`; `{cost,name}` gera `lozpyz80`. [HIPÓTESE] Todos os clientes leem do mesmo servidor, então a ordem deve coincidir. Risco baixo. | [RECOMENDAÇÃO] Serializar com as chaves ordenadas. Custo: 15 min. |
| B4 | Baixo (#39) | **Ids duplicados não são tratados.** `deleteItem` filtra por id e apaga todas as cópias; `updateItem` edita só a primeira (`wt39:src/store/TripProvider.jsx:126,142`). | [FATO] Prova 2L: 2 itens com `id:'x1'` → 0 restantes. [HIPÓTESE] Só acontece com JSON editado à mão: o app gera `uid()`, e `mesclarPlanilha` desduplica por id. | [RECOMENDAÇÃO] Em `normalizeState`, dar id novo à 2ª ocorrência em diante. Custo: 30 min com teste. |
| B5 | Baixo (#38) | **O parser de chaves legadas é permissivo**: aceita `1e3`, ` 250 ` e `0x10`, e esvazia o restante em silêncio. | [FATO] Prova 3. O `main` só gera chaves `id>id>inteiro` (`settlementKey` usa `Math.round`, `main:src/domain/split.js:212`); com isso, nenhum dado real gerado pelo app é descartado. O que cai fora só existe por JSON editado ou importado. | [RECOMENDAÇÃO] Usar regex estrita `^[^>]+>[^>]+>\d+$`. Com A2(a), nada é apagado. Incluído em A1. |
| B6 | Baixo (#38) | Pagamento para participante removido aparece em "Pagamentos feitos" como "—" e não entra no saldo. | [FATO] Prova 3 (`pX`). O `main` também ignorava esse caso. | Backlog. |

**Reversibilidade do #39.** [FATO] O `main` mantém os ids recebidos (prova 2F). As ações por índice do `main` não dependem deles, e os comentários feitos depois da implantação continuam achando o item, porque o id fica gravado. O rollback é seguro.

**Duplicação no #38 (pergunta 2).** [FATO] Na gravação de memória antiga por cima, os ids `mig-<key>-<at>` são determinísticos e **não duplicam** (prova 2B). A duplicação vem da **reconfirmação** feita na aba antiga, que gera um `at` novo (prova 2A). Ela some com A2.

## Dados pessoais (LGPD)
Os PRs não mudam quem acessa os dados, quais campos são coletados nem por quanto tempo ficam guardados. Os valores de acerto e os nomes dos participantes já eram tratados. Os backups pedidos abaixo, em JSON exportado, contêm dados pessoais dos membros. Eles ficam no computador do dono, **nunca** no repositório, que é público.

## Dependências e segredos
Fora do escopo: nenhum dos dois PRs muda manifesto, regras, `firebase.json` nem workflow. [FATO] `git diff --stat origin/main...HEAD -- firestore.rules firebase.json` saiu vazio nos dois worktrees. As regras não validam o formato de `state`, então `payments`, `paymentsMigrated` e os ids passam sem mudança nas regras.

## Implantação e rollback
1. **Condição de merge do #38:** corrigir A1 e A2 (com M1 e B5 incluídos) e atualizar o teste `migração settlementsDone -> payments` (`domain.test.js:861-882`), que hoje exige `settlementsDone` vazio. Novos testes: as provas 1A, 1B, 2A e 2D como casos.
2. **Ordem:** só front-end, sem publicar regras. O #39 e o #38 mexem em `normalizeState` e no `TripProvider`: mesclar em sequência, rodar `npm test` (3 fusos), `npm run test:e2e` e `npm run build`, e publicar as duas mudanças juntas num único deploy de Hosting, para ter um único ponto de rollback.
3. **Cópia de segurança antes do deploy (dono, de 10 a 15 min):** em cada viagem ativa, **Mais → Exportar JSON** (arquivo local, fora do repositório) e **Versões salvas → nova versão** com o nome `antes-acerto-por-pagamento`. A versão salva no app antigo guarda `settlementsDone` e é o caminho de restauração dentro do próprio app.
4. **Logo depois do deploy:** pedir aos membros que fechem e reabram o app (abas e PWA instalado), porque a página não recarrega sozinha. Opcional, com custo de cerca de 2 h: recarregar a página quando o novo service worker assumir, depois de salvar o que estiver pendente (debounce de 900 ms).
5. **Verificação pós-implantação, em cada viagem com acertos confirmados:** a lista "Acerto" pendente fica igual à de antes (comparar com o JSON); "Pagamentos feitos" tem um item por acerto que estava confirmado; nenhuma viagem que estava "tudo acertado" mostra centavos pendentes; não há pagamento duplicado.
6. **Critério de rollback:** qualquer divergência de saldo ou pendência em relação ao JSON, pagamento duplicado ou erro ao abrir uma viagem.
7. **Como reverter:** Firebase Hosting → Releases → "Rollback" para a versão anterior. Pede autorização do usuário. Com A2 corrigido, o app antigo volta a mostrar as confirmações de antes. Só os pagamentos confirmados depois do deploy não aparecem, e esses são refeitos à mão. **Sem a correção de A2**, há duas saídas: restaurar a versão `antes-acerto-por-pagamento`, que perde as edições feitas depois; ou reconstruir `settlementsDone` a partir dos ids `mig-<key>-<at>`, que contêm a chave e a data originais.

**Checklist para o PR #38:** [ ] A1/A2 corrigidos com testes · [ ] `settlementsDone` preservado · [ ] provas 1A/1B/2A/2D como testes · [ ] backup JSON e versão salva por viagem · [ ] aviso para reabrir o app · [ ] verificação pós-implantação registrada · [ ] #26 aberta para M2.
**Checklist para o PR #39:** [ ] nota sobre comentários "Item removido" (B2) · [ ] decidir B1/B3/B4 (opcionais, cerca de 2 h no total) · [ ] mesmo deploy do #38.

## Não verificado
- O comportamento real do service worker em aparelhos (tempo até a atualização) não foi medido. A conclusão vem da configuração e do `registerSW.js` gerado.
- O protótipo do anexo C não rodou contra a suíte `vitest` do projeto, só contra as provas. A implementação fica com o frontend-engineer, e o QA faz a regressão.
- Não houve teste com o Firestore real nem com emulador, por restrição do contrato. A ordem das chaves (B3) fica como hipótese.
- Não sei quantas viagens reais têm `settlementsDone` com mais de uma chave por par nem quantas têm itens sem id. Isso exige ler a produção, o que pede autorização.

## Anexo A: prova do #38 (`node p38.mjs`)

```js
// Prova #38 (migratePayments). Dados fictícios.
import * as N from '<raiz-do-repositório>/src/domain/state.js';
import * as NS from '<raiz-do-repositório>/src/domain/split.js';
import * as O from '<pasta-de-provas-da-revisão>/main/src/domain/state.js';
import * as OS from '<pasta-de-provas-da-revisão>/main/src/domain/split.js';
const clone = (x) => structuredClone(x);
const ppl = [{ id: 'pa', name: 'Ana' }, { id: 'pb', name: 'Beto' }, { id: 'pc', name: 'Caio' }];
const desp = (id, cost, paidBy) => ({ id, date: '2026-12-01', city: 'X', name: id, cost, status: 'Pago', paidBy });
const base = (others, done) => ({ otherExpenses: others, settings: { participants: ppl, settlementsDone: done } });
const velho = (st) => OS.withSettlementStatus(st, OS.settlements(OS.splitSummary(st))).map((a) => `${a.key}:${a.confirmado ? 'CONFIRMADO' : 'pendente'}`);
const novo = (st) => ({ pendentes: NS.settlements(NS.splitSummary(st)).map((a) => NS.settlementKey(a)), pagamentos: NS.paymentsList(st).map((p) => `${p.id}=${p.valor}`), saldos: NS.splitSummary(st).rows.map((r) => `${r.id}:${r.balanceCents}`).join(' ') });
const confirmaVelho = (st, at) => { const s = clone(st); OS.withSettlementStatus(s, OS.settlements(OS.splitSummary(s))).filter((a) => !a.confirmado).forEach((a) => s.settings.settlementsDone.push({ key: a.key, at })); return s; };

console.log('--- 1A. Reversibilidade: legado com 2 acertos confirmados (R$ 100 pagos por Caio, 3 pessoas)');
let leg = O.normalizeState(base([desp('d1', 100, 'pc')], []));
leg = confirmaVelho(leg, '2026-11-01T10:00:00.000Z');
console.log('main (antes):', velho(leg));
const mig = N.normalizeState(clone(leg));
console.log('#38 depois  :', novo(mig), 'settlementsDone=', JSON.stringify(mig.settings.settlementsDone));
const rb = O.normalizeState(clone(mig));
console.log('ROLLBACK main lendo o gravado pelo #38:', velho(rb), '| payments preservado no objeto?', Array.isArray(rb.settings.payments) && rb.settings.payments.length);

console.log('--- 1B. Múltiplas chaves do mesmo par (confirmações cumulativas do modelo antigo)');
let m = O.normalizeState(base([desp('d1', 90, 'pa')], []));
m.settings.participants = ppl.slice(0, 2);
m = confirmaVelho(m, '2026-11-01T10:00:00.000Z');            // pb>pa>4500
m.otherExpenses.push(desp('d2', 60, 'pa'));                   // dívida sobe para 75
console.log('main após nova despesa:', velho(m));
m = confirmaVelho(m, '2026-11-02T10:00:00.000Z');            // pb>pa>7500
console.log('main após reconfirmar :', velho(m), 'settlementsDone=', m.settings.settlementsDone.map((x) => x.key));
console.log('#38 migrado           :', novo(N.normalizeState(clone(m))));

console.log('--- 2A. Cliente antigo em paralelo vê acerto já migrado como pendente e reconfirma');
const gravadoN = N.normalizeState(clone(leg));                // cliente novo migrou e gravou (qualquer mutação)
const memO = O.normalizeState(clone(gravadoN));               // aba antiga recebe o snapshot
console.log('aba antiga vê:', velho(memO));
const gravadoO = confirmaVelho(memO, '2026-11-11T09:00:00.000Z');
const releitura = N.normalizeState(clone(gravadoO));
console.log('cliente novo relê:', novo(releitura));

console.log('--- 2B. Sobrescrita por aba antiga com memória velha (sem payments)');
const n2 = clone(gravadoN); n2.otherExpenses.push(desp('d3', 30, 'pa'));
n2.settings.payments.push({ id: 'uidNOVO', de: 'pb', para: 'pa', valor: 10, data: '2026-11-11T08:00:00.000Z' });
const stale = clone(leg);                                    // memória da aba antiga, anterior à gravação do novo
const r2 = N.normalizeState(clone(stale));
console.log('ids regenerados iguais aos do 1A?', JSON.stringify(r2.settings.payments.map((p) => p.id)) === JSON.stringify(gravadoN.settings.payments.map((p) => p.id)));
console.log('pagamento uidNOVO sobrevive?', r2.settings.payments.some((p) => p.id === 'uidNOVO'), '| d3 sobrevive?', r2.otherExpenses.some((x) => x.id === 'd3'));

console.log('--- 2C. "Desfazer" no novo + sobrescrita antiga ressuscita o pagamento');
const des = clone(gravadoN); des.settings.payments = des.settings.payments.slice(1);
console.log('após desfazer:', des.settings.payments.length, '| após sobrescrita antiga e releitura:', N.normalizeState(clone(leg)).settings.payments.length);

console.log('--- 2D. Arredondamento: chave antiga (float) x saldo novo (centavos, maior resto)');
let r = O.normalizeState(base([desp('d1', 100, 'pc'), desp('d2', 0.1, 'pa')], []));
r = confirmaVelho(r, '2026-11-01T10:00:00.000Z');
console.log('main:', velho(r)); console.log('#38 :', novo(N.normalizeState(clone(r))));
let r3 = O.normalizeState(base([desp('d1', 100, 'pa')], []));
r3.settings.participants = [ppl[2], ppl[1], ppl[0]];
r3 = confirmaVelho(r3, '2026-11-01T10:00:00.000Z');
console.log('main (pagador por último na lista):', velho(r3)); console.log('#38 :', novo(N.normalizeState(clone(r3))));

console.log('--- 3. Entradas malformadas');
const lixo = [{ key: 'lixo' }, { key: 'pa>pb' }, { key: 'pa>pa>100' }, { key: 'pa>pb>33.5' }, { key: 'pa>pb>-5' }, { key: 'pa>pb>0' }, { key: 'pa>pb>1e3' }, { key: 'pa>pb> 250 ' }, { key: 'pa>pb>0x10' }, { key: 'pa>pX>500', at: 'z' }, { key: 'pa>pb>700' }, { key: 'pa>pb>700' }, null, 'texto'];
const s3 = { cities: [], transports: [], foodItems: [], attractions: [], otherExpenses: [], settings: { participants: ppl, settlementsDone: lixo } };
N.migratePayments(s3);
console.log('migrados:', s3.settings.payments.map((p) => `${p.id}=${p.valor}`));
console.log('settlementsDone depois:', JSON.stringify(s3.settings.settlementsDone));
console.log('pX (participante removido) na lista de pagamentos?', NS.paymentsList(s3).some((p) => p.para === 'pX'), '| entra no saldo?', NS.splitSummary(s3).rows.map((x) => x.balanceCents).join(','));
console.log('main.settlementKey sempre gera inteiro?', OS.settlementKey({ fromId: 'a', toId: 'b', valor: 33.335 }), OS.settlementKey({ fromId: 'a', toId: 'b', valor: 0.1 + 0.2 }));
```

Saída (código de saída 0):

```
--- 1A. Reversibilidade: legado com 2 acertos confirmados (R$ 100 pagos por Caio, 3 pessoas)
main (antes): [ 'pa>pc>3333:CONFIRMADO', 'pb>pc>3333:CONFIRMADO' ]
#38 depois  : {
  pendentes: [ 'pa>pc>1' ],
  pagamentos: [
    'mig-pa>pc>3333-2026-11-01T10:00:00.000Z=33.33',
    'mig-pb>pc>3333-2026-11-01T10:00:00.000Z=33.33'
  ],
  saldos: 'pa:-1 pb:0 pc:1'
} settlementsDone= []
ROLLBACK main lendo o gravado pelo #38: [ 'pa>pc>3333:pendente', 'pb>pc>3333:pendente' ] | payments preservado no objeto? 2
--- 1B. Múltiplas chaves do mesmo par (confirmações cumulativas do modelo antigo)
main após nova despesa: [ 'pb>pa>7500:pendente' ]
main após reconfirmar : [ 'pb>pa>7500:CONFIRMADO' ] settlementsDone= [ 'pb>pa>4500', 'pb>pa>7500' ]
#38 migrado           : {
  pendentes: [ 'pa>pb>4500' ],
  pagamentos: [
    'mig-pb>pa>4500-2026-11-01T10:00:00.000Z=45',
    'mig-pb>pa>7500-2026-11-02T10:00:00.000Z=75'
  ],
  saldos: 'pa:-4500 pb:4500'
}
--- 2A. Cliente antigo em paralelo vê acerto já migrado como pendente e reconfirma
aba antiga vê: [ 'pa>pc>3333:pendente', 'pb>pc>3333:pendente' ]
cliente novo relê: {
  pendentes: [ 'pc>pb>3333', 'pc>pa>3332' ],
  pagamentos: [
    'mig-pa>pc>3333-2026-11-01T10:00:00.000Z=33.33',
    'mig-pb>pc>3333-2026-11-01T10:00:00.000Z=33.33',
    'mig-pa>pc>3333-2026-11-11T09:00:00.000Z=33.33',
    'mig-pb>pc>3333-2026-11-11T09:00:00.000Z=33.33'
  ],
  saldos: 'pa:3332 pb:3333 pc:-6665'
}
--- 2B. Sobrescrita por aba antiga com memória velha (sem payments)
ids regenerados iguais aos do 1A? true
pagamento uidNOVO sobrevive? false | d3 sobrevive? false
--- 2C. "Desfazer" no novo + sobrescrita antiga ressuscita o pagamento
após desfazer: 1 | após sobrescrita antiga e releitura: 2
--- 2D. Arredondamento: chave antiga (float) x saldo novo (centavos, maior resto)
main: [ 'pb>pc>3337:CONFIRMADO', 'pa>pc>3327:CONFIRMADO' ]
#38 : {
  pendentes: [ 'pa>pb>1' ],
  pagamentos: [
    'mig-pb>pc>3337-2026-11-01T10:00:00.000Z=33.37',
    'mig-pa>pc>3327-2026-11-01T10:00:00.000Z=33.27'
  ],
  saldos: 'pa:-1 pb:1 pc:0'
}
main (pagador por último na lista): [ 'pc>pa>3333:CONFIRMADO', 'pb>pa>3333:CONFIRMADO' ]
#38 : {
  pendentes: [ 'pc>pa>1' ],
  pagamentos: [
    'mig-pc>pa>3333-2026-11-01T10:00:00.000Z=33.33',
    'mig-pb>pa>3333-2026-11-01T10:00:00.000Z=33.33'
  ],
  saldos: 'pc:-1 pb:0 pa:1'
}
--- 3. Entradas malformadas
migrados: [
  'mig-pa>pb>1e3-=10',
  'mig-pa>pb> 250 -=2.5',
  'mig-pa>pb>0x10-=0.16',
  'mig-pa>pX>500-z=5',
  'mig-pa>pb>700-=7'
]
settlementsDone depois: []
pX (participante removido) na lista de pagamentos? true | entra no saldo? 1966,-1966,0
main.settlementKey sempre gera inteiro? a>b>3334 a>b>30
```

## Anexo B: prova do #39 (`node p39.mjs`)

```js
// Prova #39 (idLegado). Dados fictícios.
import * as N from '<raiz-do-PR-39>/src/domain/state.js';
import * as O from '<pasta-de-provas-da-revisão>/main/src/domain/state.js';
const clone = (x) => structuredClone(x);
const at = (name, cost, extra = {}) => ({ date: '2026-12-01', city: 'X', name, cost, status: 'Planejado', ...extra });
const leg = { attractions: [at('Museu', 10), at('Torre', 20), at('Museu', 10)], checklist: [{ item: 'Passaporte', done: false }], settings: { participants: [] } };
const ids = (s) => s.attractions.map((x) => x.id).join(',');
const key = (s, i) => `attractions:${s.attractions[i].id}`;

console.log('--- 2E. Determinismo');
const a = N.normalizeState(clone(leg)), b = N.normalizeState(clone(leg));
console.log('ids:', ids(a), '| iguais entre clientes?', ids(a) === ids(b), '| itens idênticos em posições diferentes têm ids distintos?', a.attractions[0].id !== a.attractions[2].id);
console.log('idempotente (normaliza 2x)?', ids(N.normalizeState(clone(a))) === ids(a));
console.log('ordem das chaves muda o id?', N.idLegado('attractions', { name: 'Museu', cost: 10 }, 0), N.idLegado('attractions', { cost: 10, name: 'Museu' }, 0));

console.log('--- 2F. Cliente antigo (main) preserva ids que recebeu?');
console.log('main.normalizeState mantém ids:', ids(O.normalizeState(clone(a))) === ids(a));

console.log('--- 2G. Aba antiga com memória sem ids sobrescreve, conteúdo igual -> mesmos ids');
console.log(ids(N.normalizeState(clone(leg))) === ids(a));

const comentario = key(a, 1);   // comentário feito no cliente novo sobre "Torre" (subcoleção, não grava o state)
console.log('--- 2H. Antes de qualquer gravação do state, aba antiga edita o custo da Torre (por índice)');
const o1 = O.normalizeState(clone(leg)); o1.attractions[1].cost = 25;
const n1 = N.normalizeState(clone(o1));
console.log('comentário', comentario, 'ainda acha o item?', n1.attractions.some((x) => `attractions:${x.id}` === comentario));
console.log('--- 2I. Aba antiga exclui o 1o item (splice por índice): ids dos seguintes mudam');
const o2 = O.normalizeState(clone(leg)); o2.attractions.splice(0, 1);
const n2 = N.normalizeState(clone(o2));
console.log('antes:', a.attractions.slice(1).map((x) => x.id).join(','), '| depois:', ids(n2));
console.log('--- 2J. Mesma edição DEPOIS de um cliente novo ter gravado os ids: estável');
const o3 = O.normalizeState(clone(a)); o3.attractions[1].cost = 25; o3.attractions.splice(0, 1);
console.log('comentário acha o item?', N.normalizeState(clone(o3)).attractions.some((x) => `attractions:${x.id}` === comentario));
console.log('--- 2K. Comentários antigos em itens sem id (main) usavam itemKey', `attractions:${leg.attractions[0].id}`, '-> depois do #39 nenhum item tem esse id:', !a.attractions.some((x) => String(x.id) === 'undefined'));
console.log('--- 2L. Ids duplicados não são tratados (deleteItem filtra por id e apaga todos)');
const dup = N.normalizeState({ attractions: [at('A', 1, { id: 'x1' }), at('B', 2, { id: 'x1' })], settings: {} });
console.log('após deleteItem("x1"):', dup.attractions.filter((x) => x.id !== 'x1').length, 'itens restantes de 2');
```

Saída (código de saída 0):

```
--- 2E. Determinismo
ids: l19t3efp0,l19tntr81,lqwvlw32 | iguais entre clientes? true | itens idênticos em posições diferentes têm ids distintos? true
idempotente (normaliza 2x)? true
ordem das chaves muda o id? l1ejbdpc0 lozpyz80
--- 2F. Cliente antigo (main) preserva ids que recebeu?
main.normalizeState mantém ids: true
--- 2G. Aba antiga com memória sem ids sobrescreve, conteúdo igual -> mesmos ids
true
--- 2H. Antes de qualquer gravação do state, aba antiga edita o custo da Torre (por índice)
comentário attractions:l19tntr81 ainda acha o item? false
--- 2I. Aba antiga exclui o 1o item (splice por índice): ids dos seguintes mudam
antes: l19tntr81,lqwvlw32 | depois: l1j9rq110,l10czi5w1
--- 2J. Mesma edição DEPOIS de um cliente novo ter gravado os ids: estável
comentário acha o item? true
--- 2K. Comentários antigos em itens sem id (main) usavam itemKey attractions:undefined -> depois do #39 nenhum item tem esse id: true
--- 2L. Ids duplicados não são tratados (deleteItem filtra por id e apaga todos)
após deleteItem("x1"): 0 itens restantes de 2
```

## Anexo C: protótipo da correção A1/A2 (fora do repositório; mesmas provas do anexo A apontando para a cópia)

```js
export function migratePayments(s) {
  const atuais = Array.isArray(s.settings.payments) ? s.settings.payments.filter((x) => x && x.id) : [];
  s.settings.payments = atuais;
  if (s.settings.paymentsMigrated) return; // uma vez por viagem; settlementsDone fica intacto
  const antigos = (Array.isArray(s.settings.settlementsDone) ? s.settings.settlementsDone : [])
    .filter((x) => /^[^>]+>[^>]+>\d+$/.test(String(x?.key || '')))
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))); // mais recente primeiro
  const resumo = splitSummary(s);
  const tol = Math.max(1, allCostRows(s).length); // diferença float x maior resto: até 1 centavo por despesa
  const livres = settlements(resumo); // calculado UMA vez, como a tela antiga fazia
  const ids = new Set(atuais.map((x) => x.id));
  antigos.forEach((x) => {
    const [de, para, cents] = x.key.split('>');
    const k = livres.findIndex((a) => a.fromId === de && a.toId === para && Math.abs(a.cents - Number(cents)) <= tol);
    if (k < 0) return; // confirmação vencida: a tela antiga já a mostrava como pendente
    const [a] = livres.splice(k, 1);
    const id = `mig-${x.key}`;
    if (ids.has(id)) return;
    ids.add(id);
    atuais.push({ id, de, para, valor: a.cents / 100, data: x.at || '' });
  });
  s.settings.paymentsMigrated = true;
}
```

Saída de `node p38-proto.mjs` (código de saída 0):

```
--- 1A. Reversibilidade: legado com 2 acertos confirmados (R$ 100 pagos por Caio, 3 pessoas)
main (antes): [ 'pa>pc>3333:CONFIRMADO', 'pb>pc>3333:CONFIRMADO' ]
#38 depois  : {
  pendentes: [],
  pagamentos: [ 'mig-pa>pc>3333=33.34', 'mig-pb>pc>3333=33.33' ],
  saldos: 'pa:0 pb:0 pc:0'
} settlementsDone= [{"key":"pa>pc>3333","at":"2026-11-01T10:00:00.000Z"},{"key":"pb>pc>3333","at":"2026-11-01T10:00:00.000Z"}]
ROLLBACK main lendo o gravado pelo #38: [ 'pa>pc>3333:CONFIRMADO', 'pb>pc>3333:CONFIRMADO' ] | payments preservado no objeto? 2
--- 1B. Múltiplas chaves do mesmo par (confirmações cumulativas do modelo antigo)
main após nova despesa: [ 'pb>pa>7500:pendente' ]
main após reconfirmar : [ 'pb>pa>7500:CONFIRMADO' ] settlementsDone= [ 'pb>pa>4500', 'pb>pa>7500' ]
#38 migrado           : {
  pendentes: [],
  pagamentos: [ 'mig-pb>pa>7500=75' ],
  saldos: 'pa:0 pb:0'
}
--- 2A. Cliente antigo em paralelo vê acerto já migrado como pendente e reconfirma
aba antiga vê: [ 'pa>pc>3333:CONFIRMADO', 'pb>pc>3333:CONFIRMADO' ]
cliente novo relê: {
  pendentes: [],
  pagamentos: [ 'mig-pa>pc>3333=33.34', 'mig-pb>pc>3333=33.33' ],
  saldos: 'pa:0 pb:0 pc:0'
}
--- 2B. Sobrescrita por aba antiga com memória velha (sem payments)
ids regenerados iguais aos do 1A? true
pagamento uidNOVO sobrevive? false | d3 sobrevive? false
--- 2C. "Desfazer" no novo + sobrescrita antiga ressuscita o pagamento
após desfazer: 1 | após sobrescrita antiga e releitura: 2
--- 2D. Arredondamento: chave antiga (float) x saldo novo (centavos, maior resto)
main: [ 'pb>pc>3337:CONFIRMADO', 'pa>pc>3327:CONFIRMADO' ]
#38 : {
  pendentes: [],
  pagamentos: [ 'mig-pb>pc>3337=33.36', 'mig-pa>pc>3327=33.28' ],
  saldos: 'pa:0 pb:0 pc:0'
}
main (pagador por último na lista): [ 'pc>pa>3333:CONFIRMADO', 'pb>pa>3333:CONFIRMADO' ]
#38 : {
  pendentes: [],
  pagamentos: [ 'mig-pc>pa>3333=33.34', 'mig-pb>pa>3333=33.33' ],
  saldos: 'pc:0 pb:0 pa:0'
}
--- 3. Entradas malformadas
migrados: []
settlementsDone depois: [{"key":"lixo"},{"key":"pa>pb"},{"key":"pa>pa>100"},{"key":"pa>pb>33.5"},{"key":"pa>pb>-5"},{"key":"pa>pb>0"},{"key":"pa>pb>1e3"},{"key":"pa>pb> 250 "},{"key":"pa>pb>0x10"},{"key":"pa>pX>500","at":"z"},{"key":"pa>pb>700"},{"key":"pa>pb>700"},null,"texto"]
pX (participante removido) na lista de pagamentos? false | entra no saldo? 0,0,0
main.settlementKey sempre gera inteiro? a>b>3334 a>b>30
```
