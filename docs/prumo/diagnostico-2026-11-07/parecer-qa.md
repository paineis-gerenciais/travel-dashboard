# Parecer de qualidade: travel-dashboard (diagnóstico de maturidade, sem PR)

- **Demanda:** sem issue (vetada pelo usuário) · N2 · **Responsável:** qa-engineer · **Data:** 2026-11-07
- **Parecer:** APROVADO COM RESSALVAS para uso com um editor por viagem; REPROVADO para uso com dois editores na mesma viagem (1 defeito de severidade alta, reproduzido 5 de 5 vezes).
- **Defeitos por severidade:** bloqueador 0 · alto 1 · médio 2 · baixo 1.
- **Ambiente:** build de teste apontando para emuladores (Firestore 8080, Auth 9099), `vite preview` na 4173, Chromium do Playwright (headless), Lighthouse 13.6.0. Dados fictícios (qa-a/qa-b@exemplo.com). Medições locais; o desempenho NÃO representa produção. Linha de base (111 + 17 + 18 testes) foi rodada pelo Head e não foi repetida.
- **Scripts:** `docs/prumo/diagnostico-2026-11-07/qa-scripts/` (lib.js, A_axe.js, B_teclado.js, C_resp.js, D_perf.js, E_concorrencia.js; resultados em `*_result*.json|log`). Rodar: `cd /home/user/travel-dashboard && NODE_PATH=$(npm root -g) node <script>`.

## A. Acessibilidade automatizada (axe 4.10.3, tags wcag2a, wcag2aa, wcag21aa; PrintView excluído)

Comando: `node qa-scripts/A_axe.js` (resultado completo em `qa-scripts/A_result.json`). Mesma regra e mesmas contagens nas duas larguras, salvo onde indicado.

| Tela | 360×800 | 1366×768 |
|---|---|---|
| Login (sem logar) | 0 | 0 |
| Minhas viagens | 0 | 0 |
| Dias (1 cidade, 3 dias) | 1 serious: color-contrast, 7 nós, `.appbar-title > .tiny.t3` | idem, 7 nós |
| Cidades | 1 serious: color-contrast, 7 nós, `.tiny` | idem, 8 nós |
| Custos | 1 serious: color-contrast, 10 nós, `.tiny` | idem, 11 nós |
| Mais | 1 serious: color-contrast, 6 nós, `.appbar-title > .tiny.t3` | idem, 7 nós |
| Folha Compartilhar | 1 serious: color-contrast, 6 nós (mesmo seletor) | idem |
| Folha Planilha | 1 serious: color-contrast, 6 nós (mesmo seletor) | idem |

Nenhuma violação critical, moderate ou minor. Mensagem do axe: contraste 2,94:1 (primeiro plano `#8e97a5` sobre `#ffffff`, fonte 11 px; exigido 4,5:1). Origem: variável `--text-3` em `src/styles/app.css:16`, usada pela classe `.t3`. [FATO]
Nas folhas, a violação listada vem da tela por trás do diálogo (o axe varre a página inteira; o fundo não fica inerte, ver defeito 3), não de elemento da folha.
Observação: no onboarding a 360 px o axe acusou 1 serious (`.stack > .t2`, 3,85:1 sobre `#eff0f1`) que não apareceu a 1366 px; provavelmente é transição de fundo da animação de entrada. Não virou defeito (não reproduzi isolado). [HIPÓTESE]
Lighthouse (acessibilidade, tela de login, mobile): nota 0,98; única reprovação: `landmark-one-main` (defeito 4).
Não testado: tema escuro (o tema escuro tem `--text-3: #717d8d` sobre `#171b21`; não rodei axe nele).

## B. Teclado (só Tab, Shift+Tab, Enter, Esc, a partir de Dias)

Comando: `node qa-scripts/B_teclado.js` (`B_result.json`). Captura: `qa-capturas/teclado-foco-aba-360.png` e `-1366.png`.

1. Barra inferior: os 5 botões (Dias, Cidades, Mapa, Custos, Mais) recebem foco visível por teclado nas duas larguras: `:focus-visible` verdadeiro, `outline: solid 2px rgb(47,109,246)`, offset 2 px (regra em `app.css:164`). Captura confirma o anel azul. [FATO]
2. Folha (Mais → Abrir Compartilhar, aberta com Tab+Enter, 3 Tab para chegar ao botão):
   - Foco inicial vai ao painel (`DIV Compartilhar`, dentro do dialog). 15 Tab seguidos: foco circula só entre Fechar, campo e Convidar, nunca sai do dialog. [FATO]
   - Esc fecha (dialogs = 0) e o foco volta ao botão "Abrir Compartilhar". [FATO]
   - FALHA: com a folha recém-aberta, 1 Shift+Tab leva o foco para fora do dialog (3 Shift+Tab seguidos: "Limpar", "Sair", "Trocar", todos da tela de fundo). Repete nas duas larguras. Ver defeito 3.
3. Controles clicáveis que não são botão/link: `grep -rnPzo '<(div|span|li|td|tr|p|section|article|img|svg|label|h[1-6])\b[^<>]*?onClick' src/components` retorna só 2 elementos reais, ambos fundos de dispensa por clique: `src/components/ui.jsx:19` (`span.chip-backdrop`, fecha o menu de status) e `ui.jsx:120` (`div.sheet-backdrop`, fecha a folha); mais `ui.jsx` painel com `onClick={(e)=>e.stopPropagation()}` (não é controle). Os 190 `onClick` restantes estão em `button`. A folha tem Esc e botão Fechar; para o menu de status (`StatusChip`) não verifiquei se Esc fecha. Sem defeito.

## C. Responsividade (360×800 e 1366×768, DPR 1, fullPage false)

Comando: `node qa-scripts/C_resp.js` (`C_result.json`). Capturas em `qa-capturas/<tela>-<largura>.png`: login, onboarding, minhas-viagens, dias, cidades, custos, mais (cada uma em 360 e 1366).
- `document.documentElement.scrollWidth > innerWidth`: falso em todas as 14 combinações (360/360 e 1366/1366). Nenhum elemento visível fora da janela (`nForaDaTela: 0`). [FATO]
- Inspeção visual de Dias e Custos a 360 e Dias a 1366: sem sobreposição. Título longo da viagem é cortado com reticências, correto. Em 360 px os botões "Anterior" e "Próximo" quebram a seta para a linha de baixo (cosmético, baixo; não conto como defeito).
- Não verifiquei largura de tablet (768 px): fora do pedido.

## D. Desempenho local (indicativo; servidor na mesma máquina; NÃO é medição de produção)

Comando: `node qa-scripts/D_perf.js` (`D_result.json`; service worker bloqueado, 3 repetições, contexto novo). Sem throttling.

| Tela | domContentLoaded | loadEventEnd | FCP | Transferido (total) | JS |
|---|---|---|---|---|---|
| Login | 51, 58, 60 ms | 51, 58, 60 ms | 64 ms | 202,8 kB | 198,6 kB (index 23,3; react 44,5; firebase 130,4; registerSW 0,4) |
| Dias (viagem salva, 3 dias) | 50, 53, 67 ms | 50, 53, 67 ms | 60 ms | 221,7 kB | 217,5 kB (+ chunks Dias 5,1; Cidades 2,3; MoneyInput 2,9; LinkField 1,2; index.esm 7,4) |

CSS 4,2 kB. O chunk `xlsx` (429 kB brutos / 143 kB gzip) NÃO é carregado em Login nem em Dias, apenas sob demanda. [FATO] Os tamanhos são os transferidos (comprimidos): o `vite preview` serviu os arquivos comprimidos, coerentes com o gzip do build.
Lighthouse (`npx --yes lighthouse http://localhost:4173`, login, mobile com throttling simulado): desempenho 0,94, acessibilidade 0,98; FCP 1,0 s, LCP 3,1 s, TBT 30 ms, CLS 0, TTI 3,1 s, total 218 KiB; "JavaScript não usado" estimado em 103 KiB. Arquivo: `qa-lighthouse.json`. Esses valores são sintéticos e locais.

## E. Edição simultânea (duas contas, mesma viagem)

### Mecanismo (leitura de `src/store/TripProvider.jsx:41-102`)
- Cada cliente assina o documento da viagem em tempo real (`subscribeTrip`). Um snapshot igual a `lastSyncedJson` (JSON do último estado gravado ou recebido) é tratado como eco e ignorado.
- Enquanto o usuário está num campo (`editing.current`, ligado por `focusin` em INPUT/SELECT/TEXTAREA), o estado remoto não é aplicado: fica em `pendingRemote`.
- Ao sair do campo (`focusout`), `pendingRemote` é aplicado por `applyRemote`, que substitui o estado local inteiro (`setState`) com `suppress=true`.
- A gravação é por debounce de 900 ms e envia o estado INTEIRO: `saveTripState` faz `updateDoc(doc, { state, ... })` (`src/lib/tripData.js:100`), sem transação, sem comparar versão, sem mesclar por campo.
- Resultado: última gravação vence para a viagem inteira; e remoto bufferizado substitui edição local ainda não gravada. [FATO sobre o código]

### Execução (`E_concorrencia.js`; logs `E_result_run1.log`, `E_result_run2_variante.log`)
Viagem com cidade Lisboa, 2030-05-01 a 05-04, diária 100,00 (valor `nightly` salvo = 100). B foca em Cidade; A muda diária para 200 (20000 centavos digitados) e clica Concluir; 3 s; B digita " Norte" e dá Tab; 3 s; leitura do Firestore (REST do emulador) e da tela; reload dos dois. Esperado sem bug: "Lisboa Norte" e R$ 600,00 (3 × 200) nos dois.

**Cenário do Head (B dá Tab logo após digitar), 2 execuções:**
```
+ 8072 ms  (1) B com foco em Cidade; valor="Lisboa"
+ 8132 ms  (2) A preencheu Custo por diária = 20000
+ 8179 ms  (2) A clicou Concluir; aguardando 3 s
+11359 ms  Firestore após A: [{"city":"Lisboa","nightly":"200"}]
+11366 ms  B ainda no campo, diária no dialog de B = 100,00   (remoto de A não chegou à tela de B)
+11414 ms  (3) B digitou " Norte"; valor local="Lisboa Norte"
+11424 ms  (3) B Tab; valor do campo="Lisboa"                 (10 ms depois: texto digitado sumiu)
+14449 ms  Firestore após 3 s: [{"city":"Lisboa","nightly":"200"}]
+23032 ms  (4) após reload  A e B: "Lisboa", R$ 600,00
```
Rodada 2 idêntica (Firestore final `Lisboa/200`; ambos "Lisboa", R$ 600,00). Resultado: a diária de A sobrevive, o " Norte" de B é descartado em silêncio. Os dois ficam iguais, mas B perdeu o que digitou e não recebeu aviso. 2 de 2. [FATO]
Causa provável: o Tab dispara `applyRemote(pendingRemote)` antes dos 900 ms; a troca de estado reexecuta o efeito de persistência e o `clearTimeout` do cleanup cancela o save de B. [HIPÓTESE coerente com os valores; não instrumentei o código]

**Variante (B espera 1,5 s com foco no campo antes do Tab), 3 execuções (rodadas 3, 4, 5):**
```
+55909 ms  B digitou " Norte"
+57410 ms  (1,5 s depois) Firestore: [{"city":"Lisboa Norte","nightly":"100"}]   (save de B sobrescreveu a diária de A: 200 voltou a 100)
+57429 ms  B Tab; campo de B volta a "Lisboa"
+62193 ms  tela antes do reload  A: "Lisboa Norte", R$ 300,00   |  B: "Lisboa", R$ 600,00
+68977 ms  após reload  A e B: "Lisboa Norte", R$ 300,00
```
Rodadas 4 e 5 idênticas. Resultado: a edição de A (diária 200) é perdida nos dois lados; durante alguns segundos A e B veem valores diferentes dos gravados (B mostra a versão de A, enquanto o servidor tem a de B). 3 de 3. [FATO]

**Conclusão:** hipótese do Head confirmada: nos 5 testes, ao menos uma das duas edições foi perdida em silêncio; nenhum caso entregou "Lisboa Norte" e R$ 600,00. Nada de flakiness: resultado idêntico em cada cenário. A frequência real em uso não é conhecida (sem dado de uso); o cenário exige duas pessoas editando a mesma viagem em janelas de segundos. O app mostra um indicador de presença (bolinha com "1", captura `concorrencia-B-rodada1.png`), mas nenhum aviso de conflito.

## Defeitos encontrados
| # | Severidade | Descrição e evidência | Quem é afetado | Correção mínima e esforço |
|---|---|---|---|---|
| 1 | **Alto** | Perda silenciosa de dados em edição simultânea (seção E; 5 de 5). Gravação do estado inteiro sem controle de versão + `pendingRemote` que substitui edição local. | Quem compartilha uma viagem e edita ao mesmo tempo que outra pessoa. Com um só editor não ocorre (não medi). | Mínimo: em `saveTripState`, gravar só o que mudou desde `lastSyncedJson` (diff de 3 vias aplicado sobre o estado remoto mais recente, ou `updateDoc` com caminhos por campo) e, no `focusout`, reaplicar o delta local sobre o remoto em vez de descartá-lo. Esforço médio, 2 a 4 dias com testes (o E2E de duas contas pode reaproveitar `E_concorrencia.js`). Alternativa mais barata, 0,5 a 1 dia, só reduz o risco: avisar na tela quando um remoto chega durante a edição. |
| 2 | Médio | Contraste 2,94:1 de `--text-3` (#8e97a5) sobre branco, texto de 11 px, 6 a 11 nós por tela em todas as telas pós-login, nas duas larguras (seção A). WCAG 1.4.3. | Pessoas com baixa visão ou com tela ao sol. | Trocar `--text-3` em `app.css:16` por cerca de `#687180` (≈4,9:1 sobre branco, cálculo meu); reexecutar `A_axe.js` e checar o tema escuro. Esforço: 30 min. |
| 3 | Médio | Foco escapa do diálogo com Shift+Tab logo após abrir (seção B.2): o painel (`tabindex=-1`) tem o foco, mas o laço de `ui.jsx` só prende quando o foco está no primeiro ou no último item. Fundo sem `inert`/`aria-hidden`. WCAG 2.4.3. | Quem navega por teclado ou leitor de tela. | Em `ui.jsx` (efeito do Sheet), tratar `document.activeElement === el` como "primeiro" no Shift+Tab (1 linha) e, melhor, marcar o fundo como `inert` enquanto a folha está aberta. Esforço: 1 a 2 h com teste. |
| 4 | Baixo | Tela de login sem landmark `main` (Lighthouse `landmark-one-main`, nota de acessibilidade 0,98). | Leitor de tela na tela de login. | Envolver o conteúdo de `Login.jsx` em `<main>`. 15 min. |

## Pontos fortes comprovados
- Sem rolagem horizontal nem elemento fora da janela nas 14 telas × larguras medidas (360 e 1366).
- Login e "Minhas viagens" com 0 violações axe; nenhuma violação critical nem moderate em nenhuma tela; as serious são todas de uma regra só, uma variável CSS.
- Foco visível (outline 2 px) nos 5 botões da barra inferior; Esc fecha a folha e devolve o foco ao botão de origem; 15 Tab não tiram o foco da folha.
- Zero `div`/`span` clicáveis fora de 2 fundos de dispensa; os 190 `onClick` restantes estão em botões.
- Carga local leve: 203 kB (login) e 222 kB (Dias) transferidos; `xlsx` (143 kB gzip) fica fora das telas medidas; Lighthouse desempenho 0,94 e CLS 0.

## Não verificado (e por quê)
- Produção, rede real e dispositivos reais: só emulador e Chromium local; desempenho é indicativo.
- Tema escuro, largura de tablet, leitor de tela, zoom de 200% e reflow: fora do pedido.
- Esc no menu de status (`StatusChip`); outras telas (Mapa, Atrações, Alimentação, Checklist, Versões, Mensagens) no axe.
- Frequência da perda de dados em uso real: sem dados de uso, nada afirmado.
- Causa exata dos casos 1 e 2 do cenário E (cancelamento do debounce): coerente com o código, sem instrumentação.
- Ruído observado: erros de console do Analytics/Installations com a chave fictícia no build de teste (400 "API key not valid"); é artefato do ambiente, não defeito do produto.

## Evidência de limpeza
Emuladores e preview encerrados (portas 8080, 9099, 9150, 4000 e 4173 sem resposta); removidos `firestore-debug.log`, `firebase-debug.log`, `ui-debug.log` do repositório. `cd /home/user/travel-dashboard && git status --short` retornou saída vazia.
