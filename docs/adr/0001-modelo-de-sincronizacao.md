# ADR 0001: Sincronização da viagem por campo, com itens em mapas por id (`schemaVersion: 2`)

- **Data:** 2026-11-10 · **Demanda:** #26 · **Responsável:** software-architect
- **Situação:** proposta (aguarda G2). Opção O1 escolhida pelo dono do produto em 2026-11-09; este ADR detalha a decisão para implementação.
- **Base:** `travel-dashboard`, branch `main`, commit `b5a3ce2`; parecer de arquitetura de 2026-11-09 (seção 4.3, opções O0 a O4; seção 10, ADR proposto). Pressuposto: a issue #25 (ações por id, sem índice) já está implementada quando este ADR for executado.
- **Rótulos:** `[FATO]` com `caminho:linha` ou fonte; `[HIPÓTESE]` depende de execução ou de fonte não consultada; `[RECOMENDAÇÃO]` decisão sugerida.

---

## 1. Contexto

### 1.1 Problema
Grupos de 2 a 6 pessoas editam a mesma viagem ao mesmo tempo e perdem edições sem aviso.

- [FATO] `src/lib/tripData.js:100-102`: `saveTripState` faz `updateDoc(ref, { state, ... })` e substitui o mapa `state` inteiro. Não há pré-condição nem revisão.
- [FATO] `src/store/TripProvider.jsx:88-102`: cada cliente grava o seu `state` local completo 900 ms depois da última mudança.
- [FATO] `TripProvider.jsx:57-58`: o eco da própria gravação é filtrado por `JSON.stringify`; `:60` e `:71-77`: com campo em foco, o remoto fica em `pendingRemote` e é aplicado no `focusout`, por cima do que foi digitado depois; enquanto isso, o debounce grava o estado local sem a mudança do outro.
- [FATO] Teste com duas contas em 2026-11-07 (`E_concorrencia.js`, relatório do QA): 5 de 5 execuções com perda silenciosa.
- [FATO] `src/domain/generate.js:121-134`: `ensureGenerated` roda a cada mutação (`TripProvider.jsx:114-120`). Ele reordena `cities`, cria e remove cafés automáticos com `uid()` aleatório (`generate.js:68-71`), reatribui `city` de refeições, atrações e outras despesas e recalcula `period`. Cada cliente grava esses derivados como se fossem edição.

### 1.2 Forças e restrições
- **Offline é requisito.** [FATO] `src/lib/firebase.js:39-41` usa `persistentLocalCache` com `persistentMultipleTabManager`.
- **Sem backend próprio.** O app fala direto com o Firestore. Não há Cloud Functions.
- **Fronteiras a preservar** (parecer de 09/11, seção 2): domínio puro em `src/domain` (sem Firebase), `lib/tripData.js` como única porta ao banco, telas que recebem listas.
- **Sem troca de stack nem biblioteca nova.** Tudo o que este ADR usa já existe no SDK instalado: `updateDoc` por `FieldPath`, `deleteField`, `writeBatch`, `runTransaction`, `onSnapshot` com `includeMetadataChanges` (ver seção 10).
- **Comentários referenciam itens por id.** [FATO] `tripData.js:203` (`itemKey` = `"foodItems:<id>"`). Os ids existentes precisam sobreviver à migração.
- **Requisitos não funcionais sem número (lacuna):** usuários simultâneos por viagem (o pedido fala em 2 a 6), tamanho típico de viagem (estimativa de ~80 KB, não medida), plano do Firebase e orçamento mensal.

---

## 2. Opções consideradas

| Opção | Como | Prós | Contras | Custo e esforço | Riscos | Situação |
|---|---|---|---|---|---|---|
| O0 Manter e mitigar | Corrigir ids (#25), encurtar o buffer de foco, gravar ao perder o foco | Barato, sem migração | Mantém "a última gravação vence" no documento inteiro: duas edições em itens diferentes na mesma janela ainda se apagam; edição offline ainda reenvia a viagem inteira e apaga o que os outros fizeram | P (1 a 2 dias) | Perda continua, só fica mais rara | Descartada: não resolve D1(a) nem D1(c) do parecer |
| O0b "Rebase" com contador `rev` (parecer de 07/11) | Fila de mutações locais reaplicada sobre o remoto; gravar só se `rev` não mudou | Mantém o formato atual | A gravação condicional exige transação, e transações não funcionam offline. Sem a condição, volta a ser O0 | M (1,5 a 3 dias) | Mesmo problema de O3 | Descartada |
| **O1 Mapas por id + gravação por campo** | `state.<tipo>.<id>` (mapa) com `ord`; `updateDoc` por caminho; exclusão com `deleteField()`; conversão mapa ↔ lista na leitura | Conflito só no mesmo campo do mesmo item. Funciona offline: o SDK enfileira as escritas por campo. Continua com 1 documento e 1 leitura por abertura. O cache do SDK vira a fonte da verdade, e saem o eco por JSON, o buffer e o debounce global | Migração v1 → v2. Leitura de dois formatos. Regras novas de geração (itens virtuais) | M (8 a 9 dias com testes; seção 7) | Clientes antigos gravando v1 sobre v2 (mitigado pela regra de formato da seção 3.9); conflito no mesmo campo continua silencioso | **Escolhida** |
| O2 Subcoleção por item | `trips/{id}/items/{itemId}` | Granularidade máxima, sem teto de tamanho | ~260 leituras por abertura contra 1 hoje; versões, importação e cascata viram lotes de até 500 operações; regras mais complexas; geração automática exige ids determinísticos de qualquer forma | G (2 a 3 semanas) | Custo de leitura multiplicado; muita mudança no store | Em espera. Gatilho: documento acima de ~300 KB medido, ou permissão por item |
| O3 Transação por ação | `runTransaction` em cada gravação | Sem perda com conexão | [FATO] o SDK instalado diz: "Unlike transactions, write batches are persisted offline" (`@firebase/firestore/dist/index.d.ts:2982`). Transação não roda sem rede | M | Quebra o uso offline, que é requisito | Descartada |
| O4 CRDT (ex.: Yjs) | Documento CRDT persistido no Firestore | Fusão automática, até de texto | Dependência nova, dado binário, depuração difícil, sem necessidade demonstrada | G | Manutenção | Descartada |

A mais simples que atende é O1. O0 é mais simples, mas não atende.

---

## 3. Decisão

[RECOMENDAÇÃO] Adotar O1 com as regras abaixo. Cada subseção responde a uma das questões da demanda.

**Princípios**
1. **O banco guarda só o que o usuário decidiu.** Ordem de cidades, cafés automáticos, `city` derivada da data, `period` da atração e título automático são calculados na leitura e nunca gravados.
2. **Cada gravação toca só os campos que a ação mudou**, num único `updateDoc` com N caminhos. Um `updateDoc` atinge um documento só e é atômico.
3. **O domínio continua com listas.** A conversão mapa ↔ lista e o cálculo de operações são funções puras em `src/domain/` (testáveis no `vitest` atual). `lib/tripData.js` só traduz as operações para `FieldPath`/`deleteField` e fala com o Firestore.
4. **A tela mostra o snapshot do SDK.** A escrita local aparece de imediato pela compensação de latência. Não há estado paralelo "otimista" no React, exceto o rascunho do campo de texto em digitação (seção 3.4.3).

### 3.1 Formato v2 do documento `trips/{tripId}` (questão 1)

```
trips/{tripId}
  ownerId, ownerEmail, name, memberUids[], createdAt, updatedAt, updatedAtMs   // sem mudança
  schemaVersion: 2                     // NOVO. Ausente = 1 (formato atual)
  migratedAt: timestamp, migratedBy: uid   // NOVO, só informativo, gravado na migração
  state: {
    cities:        { <id>: { id, ord, city, emoji, start, end, hotel, nightly, status, notes,
                             breakfastIncluded, link?, paidBy?, split? } },
    transports:    { <id>: { id, ord, date, time, originCity, originPlace, destCity, destPlace,
                             mode, duration, cost, status, notes, link?, paidBy?, split? } },
    foodItems:     { <id>: { id, ord, date, city, type, place, cost, status,
                             link?, paidBy?, split?, autoBreakfast? } },
    attractions:   { <id>: { id, ord, date, city, time, name, cost, status, link?, paidBy?, split? } },
    otherExpenses: { <id>: { id, ord, date, city, name, cost, status, link?, paidBy?, split? } },
    checklist:     { <id>: { id, ord, category, item, responsible, priority, status, notes, done, link? } },
    settings: {
      travelers, manualTitle, title, subtitle, currentVersionId, costView,   // campos escalares
      participants:    { <id>: { id, ord, name } },
      documents:       { <id>: { id, ord, label, url } },
      payments:        { <id>: { id, de, para, valor, data } }   // ver nota do Head abaixo
    }
  }
```

Exemplo (dados fictícios):
```json
{
  "schemaVersion": 2,
  "state": {
    "cities": { "m3k9x1abc": { "id": "m3k9x1abc", "ord": 0, "city": "Cidade A", "start": "2027-03-01", "end": "2027-03-04", "breakfastIncluded": true, "status": "Reservado", "nightly": 300 } },
    "foodItems": { "auto-bf-2027-03-03": { "id": "auto-bf-2027-03-03", "ord": 0, "date": "2027-03-03", "autoBreakfast": true, "paidBy": "p1x" } },
    "checklist": {}, "transports": {}, "attractions": {}, "otherExpenses": {},
    "settings": { "travelers": 2, "manualTitle": false, "title": "", "subtitle": "…", "currentVersionId": null, "costView": "categoria",
      "participants": { "p1x": { "id": "p1x", "ord": 0, "name": "Pessoa 1" } },
      "documents": {}, "payments": { "pg1": { "id": "pg1", "de": "p2y", "para": "p1x", "valor": 150, "data": "2027-03-05T10:00:00.000Z" } } }
  }
}
```

> **Nota do Head (2026-11-10):** este ADR foi escrito sobre o `main` (`b5a3ce2`), em que os acertos confirmados ficam em `settings.settlementsDone` (lista de chaves). O PR #38 (issue #24) troca esse campo por `settings.payments`, uma lista de pagamentos `{id, de, para, valor, data}`, com migração idempotente. No v2, `payments` vira mapa por id, como os demais itens; `settlementsDone` só é lido na conversão de dados legados. As linhas que citam `settlementsDone` e `toggleSettlementDone` abaixo valem para `payments`, `confirmSettlement` e `undoPayment` depois do merge do #38.

**Regras do formato**
- **Chave = `id` do item, e o `id` também fica dentro do valor.** Na leitura, entrada sem `id` ou com `id` diferente da chave é um "item zumbi" e é descartada (ver 3.7, exclusão × edição). O próximo cliente que gravar inclui `deleteField()` para os zumbis que vê (coleta oportunista, no mesmo `updateDoc`).
- **Ids válidos:** `^[A-Za-z0-9_-]{1,64}$` e diferentes de `__…__`. `uid()` (`state.js:31-33`) e `auto-N` (`split.js:24`) já cumprem a regra. Id inválido vindo de JSON, planilha ou versão antiga ganha um `uid()` novo na conversão.
- **Caminhos sempre com `FieldPath`** (`updateDoc(ref, new FieldPath('state','foodItems',id,'cost'), 50, …)`), nunca com string pontuada. Motivo: `settlementKey` usa `>` (`split.js:212-214`), e a forma em string tem restrições de caracteres (`Paths must not contain '~', '*', '/', '[', or ']'`, `@firebase/firestore/dist/index.esm2017.js:20049`).
- **Valores atômicos dentro do item:** `link` (`{url,label}`) e `split` (`{participantId: pct}`) são gravados inteiros. Duas pessoas mudando percentuais de participantes diferentes no mesmo item: vale a última. É aceitável, porque a UI edita o rateio como uma unidade.
- **Campos ausentes ou `undefined`** viram `deleteField()`. `split` vazio é normalizado para ausente na leitura, como hoje (`state.js:127`).
- **Campos derivados que nunca são gravados** (constante única `DERIVED_FIELDS` no domínio): `attractions.*.period`; `settings.title` quando `manualTitle` é falso; os campos espelhados do café automático enquanto `autoBreakfast` é verdadeiro (`place`, `city`, `type`, `status`); qualquer chave iniciada por `_` (ex.: `_virtual`).
- **`city` de refeições, atrações e outras despesas:** o valor gravado é o que o usuário escolheu ao criar ou mover o item (`addFoodItem`, `setOtherDate`). Na leitura, a tela continua vendo `cityForDate(state, date) || city` (`generate.js:127-131`). O valor derivado não é regravado.
- **Versões salvas (`versions/{id}`) e exportação JSON continuam no formato de lista** (formato do domínio). Desvio consciente do parecer de 09/11, que propunha versões em v2. Motivo: versões são fotos imutáveis, sem edição concorrente, e assim não precisam de migração. Exportar, importar e carregar versão passam pela mesma conversão.

### 3.2 Itens gerados automaticamente (questão 2)

[RECOMENDAÇÃO] **Geração só na leitura, com id determinístico. O item é gravado só quando alguém o edita.**

- O café automático vira um item **virtual**: id `auto-bf-<AAAA-MM-DD>` (um por data, como o `Map` por data de `generate.js:37`), marcado `_virtual: true` na lista entregue às telas. Os campos espelhados (local = hotel, cidade, tipo "Café da manhã", status da hospedagem) são calculados a cada leitura.
- **Regra de supressão inalterada:** se já existe café manual na data (`foodOrder(type) === 1` e sem `autoBreakfast`), não há virtual (`generate.js:66-67`).
- **Edição de um café automático = materialização por campo.** O `updateDoc` grava, cada um no seu caminho: `id`, `date`, `ord: 0`, `autoBreakfast` e o campo editado.
  - Se o campo é `place`, `cost`, `type` ou `status`, grava `autoBreakfast: false` e também o valor atual de `place`, `city`, `type`, `status` e `cost` (vira item manual, como hoje em `TripProvider.jsx:130-132`).
  - Se é outro campo (`paidBy`, `split`, `link`), grava `autoBreakfast: true` e só esse campo. Na leitura, o registro gravado é mesclado ao virtual de mesmo id, e os campos espelhados continuam vindo do hotel.
  - Dois clientes materializando o mesmo café ao mesmo tempo escrevem nos mesmos caminhos, com os mesmos valores derivados. Não há duplicata, e os campos diferentes se somam.
- **Desmarcar o café da cidade:** os registros com `autoBreakfast: true` em datas não desejadas ficam ocultos na leitura (o efeito visual de hoje, `generate.js:53`) e são apagados pela coleta oportunista.
- **Excluir um café automático:** continua sem efeito duradouro (ele volta), como hoje. Fora do escopo; uma marca `suppressed` pode vir depois.
- **Transportes "Casa" (`autoHome`):** `removeAutoHomeTransports` (`generate.js:96-111`) passa a rodar só na migração e na normalização de dados importados. Não é mais geração.

Alternativas descartadas:
- **(a) Gravar os gerados com id determinístico a cada mudança.** Todo cliente regravaria cafés quando o hotel ou o status mudam. Isso multiplica escritas e cria disputa com a materialização e com a limpeza ao desmarcar.
- **(b) Só o dono gera e grava.** O dono pode estar offline ou ausente, e os outros ficam sem cafés.

Dependência: a correção de fuso (D3 do parecer: datas em UTC) precisa estar feita antes. Senão, clientes em fusos diferentes calculam datas e ids `auto-bf-*` diferentes. Como os virtuais não são gravados, o efeito ficaria restrito à materialização.

### 3.3 Ordem (questão 3)

- **Cidades:** ordenadas por data na leitura (`sortCitiesByDate`, `generate.js:14-24`). A ordem não é gravada. O `ord` da cidade só desempata.
- **Refeições, atrações, transportes e outras despesas:** as telas já ordenam por data e hora (ex.: `Dias.jsx:137`, `Custos.jsx:176-214`). O `ord` só desempata e preserva a ordem de inserção.
- **Checklist, participantes e documentos:** a ordem é a de inserção (não há UI de reordenar hoje). É o `ord` que a garante.
- **Paradas de rota:** [FATO] não são persistidas; vivem no estado local de `RouteEditorModal.jsx:11-13`. Nada muda.
- **Valor de `ord`:** número. Na migração, recebe o índice na lista v1 (0, 1, 2…). Item novo recebe `Date.now()` no cliente que cria, então fica depois dos migrados. A conversão mapa → lista ordena por `(ord, id)`, o que dá ordem estável mesmo com empate. Se um dia houver reordenação pelo usuário, o item movido recebe a média dos `ord` vizinhos (1 campo gravado).

### 3.4 Ações do store como operações de campo (questão 4)

#### 3.4.1 Mecanismo único
[RECOMENDAÇÃO] Manter o estilo atual das ações (`mutate(fn)` sobre uma cópia da visão) e trocar o final: em vez de `setState` mais debounce, calcular `diffToOps(antes, depois)` e enviar as operações.

- `src/domain/syncOps.js` (puro):
  - `diffToOps(antes, depois)` → lista de `{ op: 'set' | 'delete', path: string[], value? }`. Compara coleções por id e itens campo a campo. Ignora `DERIVED_FIELDS`, aplica a materialização (3.2) a itens `_virtual` e inclui os zumbis a coletar.
  - `applyOps(stateV2, ops)` → estado v2 resultante, para os testes de comutatividade (seção 6).
- `lib/tripData.js`: `applyTripOps(tripId, ops)` → um `updateDoc(ref, ...pares FieldPath/valor, 'updatedAt', serverTimestamp(), 'updatedAtMs', Date.now())`.
- `ensureGenerated` **não roda dentro de `mutate`**: roda só na leitura (`deriveView`). Assim o diff vê só o que a ação mudou.
- **Vantagem:** as ~30 ações mudam pouco (já recebem id depois da #25), e há um único ponto testável. Sem o diff, cada ação precisaria de um construtor de caminhos próprio, com risco de esquecer um campo.

#### 3.4.2 Tabela de ações

| Ação (`TripProvider.jsx`) | Operações geradas (um `updateDoc`) | Observação |
|---|---|---|
| `addCity`, `addTransport`, `addFoodItem`, `addAttraction`, `addOther`, `addChecklist`, `addDocument`, `addParticipant` | `set state.<tipo>.<novoId>` = item completo, com `id` e `ord` | Item inteiro num caminho só |
| `seedChecklist` | N × `set state.checklist.<id>` | 14 caminhos no mesmo `updateDoc` |
| `updateItem(kind, id, key, v)`, `setRowField`, `setCityField`, `setDocumentField` | `set state.<kind>.<id>.<key>` | Em café virtual: materialização (3.2). `time` não grava `period` (derivado) |
| `setCityStart(id, v)` | `set …start` e, se necessário, `set …end` | Mesma gravação, atômica |
| `setCityEnd(id, v)` | `set …end` (validado localmente) | |
| `setOtherDate(id, date, city)` | `set …date`, `set …city` | |
| `toggleChecklist(id, checked)` | `set …done`, `set …status` | |
| `deleteItem(kind, id)`, `removeDocument` | `delete state.<kind>.<id>` | |
| `removeEmptyFood` | N × `delete state.foodItems.<id>` | Calculado sobre a visão atual |
| `deleteCity(id, removeRelated)` | `delete state.cities.<id>` + `delete` de cada item relacionado (regra de `deleteCityCascade`, `generate.js:140-161`) | Itens que outra pessoa criar na cidade no mesmo instante não entram na lista e sobrevivem. Aceito e documentado |
| `renameParticipant(id, name)` | `set state.settings.participants.<id>.name` | Campo de texto, com rascunho (3.4.3) |
| `setParticipants(list)` | Diff da lista: `delete` dos ausentes, `set …name` dos alterados, `set` dos novos | |
| `ensureParticipants(lista)` | `set state.settings.participants.auto-N` = `{id, ord, name}` | Ids `auto-N` são determinísticos: dois clientes gravam o mesmo valor |
| `removeParticipant(id)` | `delete …participants.<id>` + para cada item: `set …paidBy = ''` se apontava para ele; `set …split` sem a chave | Atribuição concorrente a quem foi removido vira referência solta, já tratada na leitura (`state.js:111-116`: id desconhecido → `''`) |
| `confirmSettlement(acerto)` / `undoPayment(id)` (PR #38; antes `toggleSettlementDone`) | `set state.settings.payments.<id>` = `{id, de, para, valor, data}` ou `delete` | Confirmação de pagamento de item = `updateItem(…,'status','Pago')` |
| `setTravelers`, `setCostView`, `setSubtitle` | `set state.settings.<campo>` | |
| `regenerateTitle` | `set …manualTitle = false` (o título passa a ser derivado) | |
| `replaceState`, `clearCurrent` | Gravação do `state` inteiro (3.5) | Substituição explícita, confirmada pelo usuário |

**`writeBatch`:** nenhuma ação do `state` precisa, porque tudo está num documento só. `writeBatch` entra só em `createTrip` e na duplicação (documento da viagem + `members/{uid}`, hoje dois `setDoc` separados em `tripData.js:71-83`). A migração usa transação (3.6).

**Feed de atividade** (`logActivity`): continua separado e sem atomicidade com o `state`. Os rótulos passam a vir da visão do momento da ação, e não de um fechamento antigo (corrige E3 do parecer).

#### 3.4.3 Campos de texto: rascunho e debounce por campo
- Um hook `useFieldDraft(path, valorRemoto)` guarda o rascunho enquanto o campo tem foco ou há gravação agendada. A tela mostra o rascunho; fora disso, mostra o snapshot.
- A gravação sai 500 ms depois da última tecla [HIPÓTESE: valor a calibrar] e é forçada no `blur`, na desmontagem, em `pagehide` e em `visibilitychange` oculto (fecha também D4 do parecer).
- Mudanças remotas em outros campos aparecem na hora. Mudança remota no mesmo campo, durante a digitação, não interrompe quem digita. Ao gravar, vale a última que chega ao servidor.
- Seleções, caixas de marcar e botões gravam na hora, sem debounce.
- Somem: `saveTimer`, `suppress`, `editing`, `pendingRemote`, `lastSyncedJson` e `applyRemote` (`TripProvider.jsx:35-102`).

### 3.5 Substituições e cópias em massa (questão 5)

| Operação | Hoje | Em v2 |
|---|---|---|
| Importação por planilha (`SheetImportSheet.jsx:99-100`) | `mesclarPlanilha` + `replaceState` | `mesclarPlanilha` (sem mudança) gera a lista nova; `diffToOps(visão, mesclado)` grava só as colunas alteradas dos itens existentes e os itens novos inteiros. Nunca apaga, como hoje (`sheet.js:3-9`). Edições concorrentes de outras pessoas em campos fora da planilha sobrevivem |
| Importar JSON (`Mais.jsx:55-70`) | Substitui tudo | Normaliza (`normalizeState` + limpeza de legado, ids válidos) → `toV2` → um `updateDoc` com `state` inteiro e `schemaVersion: 2`. Substituição total, confirmada pelo usuário |
| Limpar viagem (`Mais.jsx:173`) | `blankState` | `updateDoc` com `state = toV2(blankState())`. Mantém o comportamento atual (zera também `settings`) |
| Carregar versão (`VersionsModal.jsx:49-54`) | `loadVersion` → `replaceState` | Igual ao JSON: a versão continua em lista; normaliza → `toV2` → `state` inteiro |
| Salvar ou sobrescrever versão | Grava a lista da tela | Grava a lista da visão sem chaves `_*` e sem itens `_virtual` (`toPortable`) |
| Duplicar viagem (`TripsProvider.jsx:64-70`) | `cloneTripState` → `createTrip` | `cloneTripState` (ids novos) → `toV2` → `createTrip` com `schemaVersion: 2`, em `writeBatch` com `members/{uid}` |
| Criar viagem (`tripData.js:68-85`) | `blankState` em lista | `toV2(seed ?? blankState())`, `schemaVersion: 2`, `writeBatch` |
| Exportar JSON / planilha | Lista da tela | `toPortable(visão)`: formato de hoje, sem campos internos |

Na substituição total, escritas por campo de outra pessoa que cheguem depois se aplicam por cima. Se o item não existe mais, elas viram zumbi e são descartadas. É o comportamento esperado de "substituir tudo".

**Normalização de cafés legados** (migração, JSON, versões antigas): item com `autoBreakfast: true` e id que não começa com `auto-bf-` é descartado, porque será regerado. Se ele tiver `paidBy`, `split` ou `link`, esses campos vão para um registro `auto-bf-<data>` com `autoBreakfast: true`. Comentários ligados ao id antigo desses cafés ficam órfãos (risco baixo, seção 4).

### 3.6 Migração v1 → v2 (questão 6)

[RECOMENDAÇÃO] **Migração na abertura, por qualquer membro com conexão, numa transação que só converte se o documento ainda for v1.**

- **Quando:** o `TripProvider` recebe um snapshot com `schemaVersion !== 2` e `metadata.fromCache === false` (dado confirmado pelo servidor). Ele chama `migrateTripToV2(tripId)` uma vez por abertura.
- **Por que na abertura e não na primeira gravação:** assim o caminho de gravação por campo só existe para documentos v2. Gravar por caminho em `state.cities.<id>` num documento em que `cities` é lista teria efeito indefinido. E converter na primeira gravação misturaria migração com a edição do usuário.
- **Por que qualquer membro e não só o dono:** o dono pode nunca mais abrir a viagem, e os outros ficariam presos no formato antigo.
- **Transação (`runTransaction`):**
  1. Lê `trips/{id}`. Se já for `schemaVersion: 2`, sai (outro cliente migrou).
  2. Converte com funções puras: `normalizeState` → `removeAutoHomeTransports` → normalização de cafés legados → `migrateParticipants` → `toV2` (`ord` = índice, ids preservados, ids inválidos trocados).
  3. Cria `versions/{novo}` com `name: "Cópia automática antes da atualização"`, os metadados de versão (`tripData.js:105-114`) e o `state` v1 **original, sem conversão**.
  4. Atualiza a viagem: `state` = v2, `schemaVersion: 2`, `migratedAt`, `migratedBy`, `updatedAt`, `updatedAtMs`.
- **Dois clientes ao mesmo tempo:** [FATO] "If any document read within the transaction has changed, Cloud Firestore retries the `updateFunction`" (`index.d.ts:2247-2250`). O segundo cliente relê, vê `schemaVersion: 2` e não faz nada. A cópia da tentativa perdedora é descartada com o resto da transação. Bônus: `migrateParticipants` deixa de gerar `uid()` diferentes em cada cliente (D5 do parecer), porque a conversão roda uma vez.
- **Sem conexão e viagem ainda v1:** a tela mostra os dados convertidos em memória, em **modo somente leitura**, com aviso para conectar (pergunta 1 da seção 9). A migração tenta de novo no próximo snapshot com `fromCache === false`.
- **Leitura dos dois formatos:** a leitura de v1 (`normalizeState` + conversão) **fica permanente**. É código puro, pequeno e já testado, e viagens não abertas por meses precisam continuar abrindo. O que sai depois de 2 versões menores é o caminho de **volta** (`downgradeTripToV1`, seção 8). A leitura de v1 pode ser reavaliada quando uma contagem no console mostrar zero documentos sem `schemaVersion: 2`.
- **Clientes antigos (app v1 em aba aberta ou PWA desatualizado):** o app v1 lê um documento v2 como viagem vazia (`state.js:72-76`: o que não é array vira `[]`). Na próxima edição, ele gravaria o `state` inteiro em lista por cima do v2. Duas defesas:
  1. **Obrigatória:** regra de formato nas regras do Firestore (3.9), que recusa `state` em lista quando `schemaVersion` é 2.
  2. **Recomendada, Etapa 0:** uma versão do app atual que, ao ver `schemaVersion > 1`, não aplica o snapshot, não grava e mostra "Esta viagem foi atualizada. Recarregue o app.". Ela sai antes da v2, para dar tempo ao `autoUpdate` do PWA.

### 3.7 Offline (questão 7)

- [FATO] Escritas feitas sem rede ficam na fila do cache persistente e sobrevivem ao recarregar. `waitForPendingWrites` cita "previously issued writes (including those written in a previous app session)" (`index.d.ts:2858-2860`). A promessa de `updateDoc` "won't resolve while you're offline" (`index.d.ts:2808-2809`). Por isso a UI **não pode esperar a promessa** para mostrar estado; ela só trata a rejeição.
- **Compensação de latência como fonte da verdade:** [FATO] `hasPendingWrites` é "True if the snapshot contains the result of local writes … that have not yet been committed" (`index.d.ts:2415-2422`). A tela é sempre `deriveView(fromV2(snapshot))`. A escrita local aparece no snapshot local, e o servidor confirma depois.
- **Reconexão:** as operações por campo são enviadas na ordem e se somam às dos outros. No mesmo campo, vale **a última que chega ao servidor**, e não a feita por último no relógio. Quem ficou horas offline "vence" nos campos que editou. É o limite aceito de O1 (pergunta 3 da seção 9).
- **Exclusão × edição:** se A apaga um item e B (online ou offline) edita um campo dele, a escrita de B recria `state.<tipo>.<id>` só com aquele campo, sem `id`. Vira zumbi, é descartada na leitura e coletada depois. **A exclusão vence.** [HIPÓTESE] o Firestore cria os mapas intermediários ao gravar um caminho aninhado inexistente; conferir no emulador (seção 6, E5).
- **Cascata offline:** a lista de itens relacionados é calculada sobre a visão local. O que outros criaram no período sobrevive.
- **Escrita recusada no servidor** (membro revogado, viagem apagada, regra de formato): o SDK desfaz a mudança local e a promessa rejeita. A UI mostra "Erro" e registra com `logError` (hoje vai só para `console.error`, `TripProvider.jsx:97-98`).
- **Contenção:** [HIPÓTESE] o Firestore recomenda cerca de 1 escrita por segundo sustentada por documento. Com rascunho de 500 ms por campo e 2 a 6 editores, picos de algumas escritas por segundo devem gerar atraso, não perda. Medir (seção 6).

### 3.8 Indicador "Salvo / Salvando / Sem conexão / Erro" (questão 8)

`subscribeTrip` passa a usar `onSnapshot(ref, { includeMetadataChanges: true }, …)` e entrega `{ hasPendingWrites, fromCache }` ao store. O `dirty` atual (`TripProvider.jsx:31`, `App.jsx:83`) é substituído por `syncStatus`:

| Prioridade | Condição | Estado | Texto sugerido (final com ux-research) |
|---|---|---|---|
| 1 | Última `updateDoc` rejeitou e ainda não houve confirmação posterior | `erro` | "Erro ao salvar" (toque abre o Diagnóstico) |
| 2 | `fromCache && hasPendingWrites`, ou `navigator.onLine === false` com pendências | `offline-pendente` | "Sem conexão · alterações guardadas no aparelho" |
| 3 | `fromCache && !hasPendingWrites` por mais de 3 s, ou evento `offline` | `offline` | "Sem conexão" |
| 4 | `hasPendingWrites` ou rascunho de campo agendado | `salvando` | "Salvando…" |
| 5 | Caso contrário | `salvo` | "Salvo" |

- `erro` sai quando chega um snapshot com `hasPendingWrites === false` posterior à falha.
- Modo somente leitura (3.6) tem aviso próprio.
- [HIPÓTESE] `fromCache` pode ficar verdadeiro brevemente com rede, na abertura. Por isso há o atraso de 3 s; calibrar no E2E.

### 3.9 Regras do Firestore e índices (questão 9)

**O que não muda:** a regra de `update` (A, B e C em `firestore.rules:48-66`) compara só `ownerId` e `memberUids`. As gravações por campo continuam passando por ela. Subcoleções ficam iguais.

**O que entra:** uma checagem de formato, aplicada só quando `state` ou `schemaVersion` mudam, para não afetar convites e revogação.
```
function shapeOk(d) {
  let s = d.get('state', {});
  let v = d.get('schemaVersion', 1);
  return (v == 2 && s.get('cities', {}) is map && s.get('transports', {}) is map
            && s.get('foodItems', {}) is map && s.get('attractions', {}) is map
            && s.get('otherExpenses', {}) is map && s.get('checklist', {}) is map)
      || (v != 2 && s.get('cities', []) is list);
}
function shapeUnchangedOrOk() {
  return !request.resource.data.diff(resource.data).affectedKeys().hasAny(['state', 'schemaVersion'])
      || shapeOk(request.resource.data);
}
// allow create: … && shapeOk(request.resource.data)
// allow update: if signedIn() && shapeUnchangedOrOk() && ( A || B || C )
```
- A regra aceita os dois formatos, desde que coerentes com `schemaVersion`. Ela serve à migração, ao caminho de volta e ao app atual sem mudança. Por isso **pode ser publicada antes da v2**.
- Ela bloqueia o cliente antigo que tente gravar listas sobre um documento v2.
- Não faz `get()`, então não gera leitura extra.
- O texto final e os testes ficam com o devsecops-engineer.
- **Tamanho:** [HIPÓTESE] limite de 1 MiB por documento. O id repetido na chave acrescenta ~15 bytes por item: ~4 KB em 260 itens. O documento estimado continua perto de 85 KB. [RECOMENDAÇÃO] mostrar o tamanho do `state` no Diagnóstico e registrar aviso acima de 300 KB, que é o gatilho de O2.
- **Índices:** isentar `state` da indexação de campo único. Com mapas, cada campo de cada item vira caminho indexável. [HIPÓTESE] o limite é de 40 mil entradas de índice por documento, e a isenção de um mapa vale para os subcampos. Nenhuma consulta usa `state` hoje: `subscribeMyTrips` filtra só `memberUids` (`tripData.js:40`).
```json
{
  "indexes": [],
  "fieldOverrides": [
    { "collectionGroup": "trips",    "fieldPath": "state", "indexes": [] },
    { "collectionGroup": "versions", "fieldPath": "state", "indexes": [] }
  ]
}
```
- **Ordem de publicação:** regras e índices primeiro (compatíveis com o app atual), Etapa 0, depois o app v2.

---

## 4. Consequências

**Positivas**
- Edições em itens diferentes, ou em campos diferentes do mesmo item, nunca se apagam, online ou offline.
- Edição offline longa deixa de apagar o trabalho dos outros: reenvia só os campos tocados.
- A cópia automática "antes da atualização" dá a cada viagem um ponto de retorno visível na tela de versões.
- O store fica mais simples: saem eco por JSON, buffer de foco, `suppress`, debounce global e dois `structuredClone` por tecla (E2 do parecer).
- Derivados deixam de ser gravados. Isso elimina disputa de cafés automáticos, de ordem de cidades e de título, e reduz escritas sem sentido.
- `diffToOps`, `toV2`/`fromV2` e a derivação viram funções puras testáveis no `vitest` atual (avança C2 do parecer).
- O fim do debounce global e o rascunho forçado em `pagehide` fecham D4.
- `migrateParticipants` converge para ids únicos (D5).

**Negativas e custos**
- Leitura de dois formatos e regra de formato a manter.
- Itens virtuais e a mescla com registros materializados são um conceito novo. Precisam de testes e de comentário no código.
- Conflito no mesmo campo continua silencioso, e vence a gravação que chega por último, não a mais recente no relógio.
- Exclusão vence edição concorrente: a edição de quem não sabia da exclusão some sem aviso.
- A cascata de cidade não alcança itens criados ao mesmo tempo por outra pessoa.
- Comentários ligados a cafés automáticos legados (ids aleatórios) ficam órfãos após a migração.
- Primeira abertura de cada viagem após a atualização grava 2 documentos (viagem e cópia).
- Ids vindos de planilha ou JSON passam a ser validados e podem ser trocados. Reimportar uma planilha com id inválido cria item novo em vez de atualizar.
- Esforço maior que o estimado no parecer (4 a 6 dias): 8 a 9 dias com Etapa 0, regras e E2E (seção 7).

---

## 5. Plano de migração e publicação

1. **Pré-requisitos:** #25 (ações por id) e correção de fuso (D3) na `main`. E2E com dois contextos de navegador disponível (H2 do parecer).
2. **Regras e índices** com `shapeOk` e `fieldOverrides`, publicados antes do app. São compatíveis com o app atual.
3. **Etapa 0** (app atual com guarda de `schemaVersion > 1`) publicada. Esperar alguns dias para o `autoUpdate` do PWA espalhar. [HIPÓTESE] O prazo exato depende do uso; o Head pode acompanhar pela versão no feedback, se o `APP_VERSION` real (T4) já estiver feito.
4. **App v2:** cada viagem migra na primeira abertura com conexão. Viagens nunca abertas ficam v1 e continuam abrindo.
5. **Acompanhamento** por 2 versões menores: erros de gravação no Diagnóstico, tamanho do documento, relatos. Depois, remover o caminho de volta (seção 8).

---

## 6. Plano de testes (questão 10)

**Unitários (`vitest`, `src/domain`, entram no `npm test` atual)**
- `toV2`/`fromV2`: ida e volta preserva itens, ids e campos, com igualdade após ordenar por `(ord, id)`. `ord` = índice na migração. Ids inválidos são trocados. Zumbis (sem `id` ou com `id` ≠ chave) são descartados. `split` vazio vira ausente. `settlementsDone` lista ↔ mapa. Participantes e documentos.
- Migração v1: `autoHome` intocado é removido; cafés legados viram virtuais ou registros `auto-bf-*` com `paidBy`/`link`; participantes por nome viram ids; uma execução só gera ids estáveis.
- `deriveView`: cafés virtuais com id `auto-bf-<data>`; supressão por café manual; mescla do registro materializado com `autoBreakfast: true` (espelhados vêm do hotel); ocultação ao desmarcar; ordem das cidades; `city` e `period` derivados.
- `diffToOps`, uma bateria por linha da tabela 3.4.2: caminhos esperados; nenhum caminho em `DERIVED_FIELDS`; materialização por campo; cascata de cidade.
- **Comutatividade:** para pares de ações em itens ou campos diferentes, a partir do mesmo estado, `applyOps(applyOps(s, a), b)` = `applyOps(applyOps(s, b), a)`, e as duas mudanças estão presentes. Inclui exclusão × edição (resultado: item ausente).

**Regras (emulador, `npm run test:rules`)**
- Membro grava `state.foodItems.<id>.cost` num documento v2: permitido.
- Gravação de `state` em lista num documento v2: negada.
- Criação v2 coerente: permitida. Criação com `schemaVersion: 2` e listas: negada.
- Aceite de convite (C) e revogação (B) num documento v1 com formato estranho: continuam permitidos, porque `state` não muda.
- Não membro: negado, como hoje.

**E2E (Playwright, emulador, 2 ou 3 contextos de navegador; cada cenário repetido 5 vezes, como o teste que falhou 5 de 5)**
- **E1 Itens diferentes em menos de 1 s:** A muda o custo de uma atração e B o local de uma refeição, com menos de 1 s de intervalo. Um terceiro contexto recarrega e vê as duas mudanças.
- **E2 Campo em foco:** B foca o hotel da cidade 1 e digita devagar; A muda o subtítulo e marca um item do checklist; B tira o foco. O terceiro contexto vê o subtítulo e o checklist de A e o texto completo de B. A tela de B nunca perde teclas.
- **E3 Offline e reconexão:** B fica offline (gancho de teste `window.__E2E_OFFLINE__` com `disableNetwork`/`enableNetwork`, sob `VITE_USE_EMULATORS`; é mais determinístico que `context.setOffline`), edita 3 campos, cria 1 item, apaga 1 item e recarrega a página ainda offline. Enquanto isso, A edita outros itens. B volta. O indicador vai de "Sem conexão · alterações guardadas no aparelho" a "Salvo". O terceiro contexto vê a união.
- **E4 Mesmo campo:** A e B gravam valores diferentes no mesmo campo. Os dois clientes convergem para o mesmo valor, sem erro.
- **E5 Exclusão × edição:** A apaga um item enquanto B edita um campo dele. O item some nos dois clientes, e nenhum item parcial aparece. Conferir no emulador que o zumbi foi coletado.
- **E6 Migração concorrente:** semear uma viagem v1 com cafés automáticos, `autoHome` e participantes por nome; abrir em 2 contextos ao mesmo tempo. Resultado esperado: exatamente 1 cópia "antes da atualização", `schemaVersion: 2`, mesmos ids e mesma contagem de itens (sem cafés duplicados), comentários existentes ainda ligados.
- **E7 Café automático:** A marca café incluso; A e B editam ao mesmo tempo o `paidBy` e o `link` do mesmo café virtual. Resultado: um registro só, com os dois campos.
- **E8 Planilha concorrente:** A importa uma planilha que altera 5 itens enquanto B edita o `paidBy` de um deles. As duas mudanças ficam.
- **E9 Indicador e erro:** revogar B pelo dono enquanto B está offline; B volta e edita. A tela de B mostra "Erro ao salvar" e desfaz.

**Critério de aceite do ADR implementado:** E1 a E8 passam 5 de 5. Testes unitários e de regras verdes. Nenhuma escrita em caminhos de `DERIVED_FIELDS` (contar no emulador durante o E2E).

---

## 7. Esforço por etapa

[HIPÓTESE] Estimativa para um engenheiro que conhece o código, com a #25 e a correção de fuso já prontas.

| Etapa | Conteúdo | Quem | Esforço |
|---|---|---|---|
| 0 | Guarda `schemaVersion > 1` no app atual, com aviso e recarga | frontend-engineer | 0,5 dia |
| 1 | `src/domain/schemaV2.js`: `toV2`, `fromV2`, validação de ids, `ord`, zumbis, limpeza de legado; testes | frontend-engineer | 1 dia |
| 2 | `src/domain/syncOps.js` (`diffToOps`, `applyOps`, `DERIVED_FIELDS`) e `deriveView` (cafés virtuais, derivados), refatorando `ensureGenerated`; testes e comutatividade | frontend-engineer | 1,5 a 2 dias |
| 3 | `lib/tripData.js`: `subscribeTrip` com metadados, `applyTripOps` (`FieldPath`/`deleteField`), `replaceTripState`, `migrateTripToV2` (transação e cópia), `createTrip`/duplicação em `writeBatch`, erros para `logError` | frontend-engineer | 1 dia |
| 4 | `TripProvider.jsx`: remover debounce, eco e buffer; `useFieldDraft`; `syncStatus`; modo somente leitura; ligar nos campos de texto | frontend-engineer | 1,5 dia |
| 5 | `firestore.rules` (`shapeOk`), `firestore.indexes.json`, testes de regras | devsecops-engineer (revisão) + engenheiro | 0,5 dia |
| 6 | E2E E1 a E9 | qa-engineer + frontend-engineer | 1,5 dia |
| 7 | Publicação faseada, Diagnóstico com tamanho do documento, atualização de `DEPLOY-FASE2.md:162-165` e do README | Head + engenheiro | 0,5 dia |
| | **Total** | | **8 a 9 dias** |

---

## 8. Caminho de volta (questão 11)

- **Antes de qualquer viagem migrar** (v2 publicada há pouco ou só em prévia): reverter o deploy do app. As regras novas aceitam os dois formatos e podem ficar.
- **Depois de migrações:** publicar uma versão "volta" com `downgradeTripToV1(tripId)`. É uma transação simétrica à migração: lê v2, `fromV2` → lista → `state` v1, `schemaVersion: 1`. A regra `shapeOk` já permite. As edições feitas em v2 são preservadas. As cópias "antes da atualização" continuam nas versões salvas para quem preferir voltar ao estado anterior.
- **Prazo:** `fromV2` e `downgradeTripToV1` ficam prontos (testados e marcados no repositório) por 2 versões menores após a v2; depois saem.
- **Nada é apagado na migração**, exceto cafés automáticos ainda intocados e transportes `autoHome` vazios. Os dois são regeneráveis ou já eram removidos na leitura hoje. O `state` v1 original fica na cópia.

**O que NÃO muda**
- Stack e dependências: React, Vite e Firebase 10.x, sem biblioteca nova.
- Um documento por viagem e uma leitura por abertura.
- Autenticação, convites, `members`, `presence`, `comments` (o `itemKey` por id continua válido), `activity` e `feedback`.
- Formato das versões salvas, da exportação JSON e da planilha.
- Funções do domínio que recebem listas (custos, datas, divisão, planilha, `cloneTripState`) e as telas.
- `subscribeMyTrips` e as regras de acesso (A, B e C).

---

## 9. Perguntas em aberto para o dono do produto

1. **Viagem ainda no formato antigo, aberta sem internet:**
   - **(a) recomendada:** somente leitura até conectar uma vez. Sem risco de perda; acontece só na primeira abertura após a atualização.
   - (b) Permitir edição no modo antigo. Ao reconectar, essa edição pode ser recusada e perdida.
2. **Cópia automática "antes da atualização" nas versões salvas de cada viagem:**
   - **(a) recomendada:** criar. Dá um ponto de volta por viagem; aparece uma versão a mais na lista.
   - (b) Não criar. A lista fica limpa, e a volta depende só da transação inversa.
3. **Duas pessoas mudando o mesmo campo do mesmo item:**
   - **(a) recomendada nesta etapa:** vale a última gravação que chega, sem aviso. Esforço zero; é raro com o conflito restrito a um campo.
   - (b) Mostrar "Fulano alterou este campo" por alguns segundos. Custa 1 a 1,5 dia a mais e passa pela ux-research.

---

## 10. Verificação

- [FATO] SDK instalado: `firebase` 10.14.1 (`node_modules/firebase/package.json:3`), `@firebase/firestore` 4.7.3 (`node_modules/@firebase/firestore/package.json:3`); `package.json:20` declara `^10.12.2`. Licença Apache-2.0 (cabeçalho em `@firebase/firestore/dist/index.d.ts:2821-2835`). Lido em 2026-11-10.
- [FATO] API usada, conferida nas definições de tipo do SDK instalado (`@firebase/firestore/dist/index.d.ts`), em 2026-11-10:
  - `updateDoc` com `FieldPath` variádico (`:2811`);
  - `deleteField` (`:365`);
  - `writeBatch` persistido offline, máximo de 500 escritas (`:2977-2988`);
  - `runTransaction` com nova tentativa se o documento lido mudou e máximo de 500 escritas (`:2247-2265`);
  - `SnapshotMetadata.hasPendingWrites` e `fromCache` (`:2413-2430`);
  - `includeMetadataChanges` (`:2403`);
  - `waitForPendingWrites` cobrindo sessões anteriores (`:2853-2869`);
  - `disableNetwork` (`:374`);
  - restrição de caracteres em caminhos com string (`index.esm2017.js:20049`).
- [HIPÓTESE] Não conferidos na fonte: `firebase.google.com` não resolve nesta sessão (`ENOTFOUND`, 2026-11-10). São eles: limite de 1 MiB por documento, 40 mil entradas de índice, ~1 escrita/s sustentada por documento, herança da isenção de índice pelos subcampos de um mapa e criação de mapas intermediários por caminho aninhado.

---

## 11. Não verificado (checklist para o Head ou o engenheiro)

- [ ] Limites e comportamento do Firestore em https://firebase.google.com/docs/firestore/quotas, https://firebase.google.com/docs/firestore/query-data/index-overview (isenções em mapas) e https://firebase.google.com/docs/firestore/manage-data/add-data (campos aninhados). É preciso liberar `firebase.google.com` na rede da sessão.
- [ ] Tamanho real dos documentos: no DevTools, com uma viagem real, `new Blob([JSON.stringify(state)]).size`; repetir depois da conversão v2.
- [ ] Caminho aninhado sobre item apagado cria mapa parcial (zumbi): no emulador, `deleteField` em `state.foodItems.x` e depois `updateDoc` em `state.foodItems.x.cost`; ler o documento.
- [ ] Chave de mapa com `>` (`settlementKey`) por `FieldPath`: gravar e ler no emulador.
- [ ] Gravação por caminho num documento v1 (lista) é recusada pela regra `shapeOk`, no emulador.
- [ ] Atraso de `fromCache` na abertura com rede, para calibrar os 3 s do indicador.
- [ ] Escritas por segundo com 3 contextos digitando ao mesmo tempo (painel de uso ou contagem no emulador), contra o limite de ~1/s por documento.
- [ ] Debounce de 500 ms por campo: percepção em Android de entrada.
- [ ] Comentários existentes em cafés automáticos (antes de migrar): contar no console os `comments` cujo `itemKey` aponta para itens com `autoBreakfast: true`.
