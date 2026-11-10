# Parecer de design: travel-dashboard

Data: 2026-11-09 · Papel: ui-product-design · Nível: N2, somente leitura · Sem issue (análise consultiva)

Método: leitura de `src/styles/app.css` (475 linhas), `src/components/ui.jsx`, `App.jsx`, telas e `PrintView.jsx`, mais grep. Nada foi executado nem renderizado. Contrastes calculados à mão (fórmula WCAG 2.x, sRGB), com margem de erro de cerca de ±0,05; refazer com ferramenta antes de corrigir (ver "Não verificado").

Rótulos: [FATO] com caminho:linha; [HIPÓTESE] depende de ver renderizado; [RECOMENDAÇÃO]. Severidade: Bloqueador, Alto, Médio, Baixo.

## 1. Resumo executivo

O redesign (Fases R1/R2) deixou uma base boa: tokens em `:root`, um acento, três níveis de texto, escala curta, app-shell com rolagem no `main`, alvo de toque de 44 px como token. Os três problemas maiores são:

1. **Contraste**: texto de status e de apoio reprova AA em vários pares (ok, warn, danger, text-3, branco sobre a cor das cidades e, no escuro, branco sobre o acento). Alto.
2. **Estilo disperso**: 176 ocorrências de `style={{ }}` em 27 arquivos, e 8 telas legadas (código morto) que usam classes que já não existem no CSS. Médio.
3. **Emoji como ícone**: sem controle de cor, tamanho nem contraste entre plataformas. Médio.

## 2. Inventário de tokens (critério 1)

| Grupo | Tokenizado ([FATO] `app.css`) | Fora do token |
|---|---|---|
| Superfícies | `--bg`, `--surface`, `--surface-2` (:9-11) | `#fff` em print (:341), `rgba(16,24,40,.45)` do fundo do sheet (:278) |
| Texto | `--text`, `--text-2`, `--text-3` (:14-16) | `#000/#333/#555/#666` na impressão (:341-362) |
| Acento | `--accent`, `-soft`, `-strong` (:19-21) | `#fff` sobre acento (:148, :274, :407) |
| Semânticas | `--ok`, `--warn`, `--danger`, `--neutral` + `-soft` (:24-27) | sem `--on-accent`, sem `--info` próprio (usa accent) |
| Linhas | `--line`, `--line-strong` (:29-30) | n/d |
| Tipografia | `--font` (pilha do sistema), `--fs-1..5` = 11/13/15/18/24, `--w-reg/bold` = 400/600 (:33-35) | `16px` nos campos (:168, intencional), `20px` do ícone da aba (:310), `fontSize` inline em 8 pontos (ex.: 12, 13, 40), `line-height` literal 1.5/1.45 |
| Espaço | `--sp-1..6` = 4/8/12/16/24/32 (:38) | `2px`, `6px`, `10px`, `36px`, `40px`, `32px` em vários seletores; inline `gap: 6`, `8`, `padding: 10` |
| Raio | `--r-1..3`, `--r-pill` (:39) | `50%` inline nos pontos do gráfico |
| Sombra | `--shadow`, `--shadow-sheet` (:40-41); escuro só redefine `--shadow` (:66) | `--shadow-sheet` não é redefinida no escuro |
| Movimento | `--dur` 180 ms (:46) | 160 ms (toast, :450), 220 ms e 160 ms em JS (`Dias.jsx:104,174`) |
| Chrome | `--tap` 44, `--nav-h` 64 (:44-45) | `z-index` literal 19, 20, 30, 40, 60, 70 sem escala |
| Breakpoints | um só: `min-width:768px` (:313) | sem tokens (limite do CSS); `max-width:720px` do container fixo (:112) |
| Cidades | 8 pares `--city/--city-soft`, claro e escuro (:371-387) | `palette(i)` em JS, 10+ hex, "mesma do app original" (`src/domain/costs.js:183`): segunda paleta, fora do CSS |

Contagens [FATO]: `style={{` = 176 ocorrências em 27 arquivos; 129 trazem propriedade visual (cor, tamanho, espaço). Mais concentrados: `PorDia.jsx` 37 (código morto), `Custos.jsx` 28, `Mais.jsx` 13, `Login.jsx` 13. Hex solto em JSX: nenhum; só em `costs.js`. Cores inline usam `var(--…)` (bom).

Falta ainda: `--on-accent`, `--focus`, escala de `z-index`, escala de ícones, `--fs-0` para 12, `--line-input` (ver 6), nomes de cor de gráfico.

## 3. Hierarquia e consistência (critério 2)

Pontos fortes:
- Cabeçalho simples: título + "Salvo/Salvando…" (`App.jsx:81-84`), duas ações à direita. Hierarquia clara.
- Cartão por linha (`.row`) como unidade única de lista; tabelas viraram `Row` nos relatórios (`Custos.jsx:168`).
- Cor tem papel: semânticas para status, neutro para o resto (`app.css:1-6`). Números com `tabular-nums` (:109).
- Botões: primário, padrão, ghost, perigo, sm, ícone (:136-162). Vocabulário completo.

Pontos fracos:
- **Chips como botão sem pista de ação**: `StatusChip` abre menu, mas só o `▾` indica (`ui.jsx:15`). O menu reusa a mesma classe do chip (`ui.jsx:23`), então o item atual e o hover não têm destaque além de `aria-selected` sem estilo. Médio.
- **Botão perigo discreto**: `.btn-danger` só muda a cor do texto (:152). Em "Excluir" dentro de sheet pode ficar com pouco peso; [HIPÓTESE] confirmar visualmente. Baixo.
- **Três famílias de botão-link**: `btn-ghost "Abrir →"` (`Mais.jsx:98-125`, `Custos.jsx:147,157`), `btn-add` tracejado, `btn-icon` com texto "−"/"+". Aceitável, mas "Abrir →" repetido 8 vezes em `Mais` sugere que a linha inteira deveria ser o alvo (Row já aceita `onClick`, mas só no título, `ui.jsx:45`). Médio.
- **Row clicável incompleta**: o título é `button` com `all:unset` (`ui.jsx:45`). Isso remove o contorno de foco do botão (o `:focus-visible` global :164 ainda se aplica, mas o alvo de toque é só a largura do texto, não 44 px). Alto para teclado/toque; confirmar visualmente.
- **Código morto com CSS ausente**: 8 telas (`PorDia`, `Alimentacao`, `Transporte`, `Atracoes`, `Outras`, `Checklist`, `Resumo`, `Roteiro`) não são importadas por nenhum arquivo (grep de `import`/`lazy` sem resultado; `App.jsx:14-18` carrega só 5). Usam `small-btn`, `route-box`, `badge`, `toolbar`, `muted`, `linkbtn`, `<table data-label>`, que não existem em `app.css`. Se alguém religar uma delas, sai sem estilo. Médio (manutenção); remover é do frontend-engineer.
- **Cor por cidade ajuda, com ressalva**: cor como informação (:365-370) é boa decisão e substituiu os temas por seção do app original. Ela mantém a interface neutra e dá localização. Riscos: (a) 8 matizes incluem pares de tom próximo (c4 vermelho, c6 rosa; c2 âmbar parecido com `--warn`; c1 verde igual a `--ok`), então cor de cidade pode ser lida como status; (b) contraste (item 6); (c) só cor distingue cidade em `row-icon` e faixa; `city-tag` traz o nome, `city-edge` não. Recomendação: manter, mas ver 6 e 7.
- **Duas paletas**: cidades (CSS) e gráfico (`palette()` JS, hex diferentes). Barras de Custos "Por cidade" não casam com a cor da cidade em `Dias`. Médio.
- **Identidade do PWA**: `theme_color #0f172a` (`vite.config.js:19`, `index.html:6`) é azul-marinho, mas a barra superior do app é `--surface` branca (claro) ou `#171b21` (escuro). A barra do sistema fica escura sobre cabeçalho branco; `background_color #f5f7fb` difere de `--bg #f6f7f9`. Baixo. Decisão do usuário só se quiser mudar a cor da marca.

## 4. Estados dos componentes (critério 3)

| Componente | Padrão | Foco | Hover | Pressed | Desabilitado | Carregando | Vazio | Erro | Sucesso | Seleção |
|---|---|---|---|---|---|---|---|---|---|---|
| Botão | sim | global :164 | sim | `scale(.99)` | opacity .45 (:147) | **falta** | n/a | n/a | n/a | n/a |
| Campo | sim | borda+halo (:175) | **falta** | n/a | **falta estilo** | n/a | placeholder do navegador | **sem `aria-invalid` nem estilo** | n/a | n/a |
| Chip | sim | global | **falta** | **falta** | n/a | n/a | n/a | n/a | n/a | `aria-selected` sem estilo |
| Row | sim | só no título | **falta** | **falta** | n/a | **falta** | `EmptyState` | n/a | `row-highlight` (:457) | n/a |
| Sheet | sim | foco preso, Esc (`ui.jsx:77-104`) | n/a | n/a | n/a | **falta** | n/a | n/a | n/a | n/a |
| Tabbar | sim | global | desktop só | n/a | n/a | n/a | n/a | n/a | n/a | `aria-current` (:309) |
| Timeline | sim | global | **falta** | **falta** | n/a | n/a | n/a | n/a | n/a | `aria-selected` (:274) |
| Banner | 3 tipos | n/a | n/a | n/a | n/a | n/a | n/a | sim | n/a | n/a |
| Toast | ok/erro | n/a | n/a | n/a | n/a | n/a | n/a | sim | sim | n/a |

[FATO] Faltas principais:
- **Carregando**: só o texto "Carregando…" no `Suspense` (`App.jsx:120`). Sem esqueleto, sem estado de botão "Salvando…" (só o texto do cabeçalho). Médio.
- **Erro de campo**: `app.css` não tem `.field-error`, `[aria-invalid]` nem texto de ajuda; erro de login usa `<p style="color:var(--danger)">` inline (`Login.jsx:187-189`). Médio.
- **Desabilitado**: `opacity:.45` em qualquer `button` (:147), mas `input:disabled` e `select:disabled` não têm regra. Baixo.
- **Foco**: o anel global de 2 px com offset 2 px (:164) é bom. Mas `input:focus` zera o contorno (:175) e confia em borda `--accent` + halo `--accent-soft`; o halo quase não aparece (ver contraste 6). A borda em si muda de 1,25:1 para 4,5:1, então é visível. Aceitável; Baixo.
- **Hover em dispositivo de toque**: `button:hover` fixa o fundo após o toque no celular [HIPÓTESE]; envolver em `@media (hover:hover)`. Baixo.

## 5. Ícones (critério 4)

[FATO] Emoji em: tabbar (`App.jsx:21-25`: 🗓️ 📍 🗺️ 💰 ⋯), cabeçalho (📎 💬 `App.jsx:92,99`), fechar ✕ (`ui.jsx:131`, `AttachmentsSheet.jsx:138`, `Custos.jsx:406`), alça ⠿ (`RouteEditorModal.jsx:86`), ⚙️ 🌙 ☀️ (`TripPicker.jsx:62-65`), `row-icon` em quase toda lista, banners (⚠️ ⛔ ℹ️, `ui.jsx:152`), ▾ no chip.

Problemas:
- **Aparência varia por plataforma** (Apple, Google, Samsung, Windows): estilo, peso e tamanho mudam; alguns são coloridos, outros monocromáticos. 🗓️ e ⚙️ com seletor de variação (U+FE0F) caem em glifo de texto em alguns sistemas [HIPÓTESE].
- **Sem controle de cor**: não herdam `--text-3` nem `--accent`; o estado ativo da aba só muda o rótulo, não o ícone. Contraste do emoji não é calculável. Médio.
- **Tamanho**: 20 px na aba (:310), `fs-3` (15 px) no `row-icon`. Alvo dentro de 44 px, ok.
- **Acessibilidade**: usados com `aria-hidden` e rótulo (bom, `App.jsx:110,113`). ✕ e ⋯ como texto podem ser lidos pelo leitor de tela onde não há `aria-label` (`PorDia` morto; `Custos.jsx:403` tem).
- **Impressão**: emoji não aparece em `PrintView` (bom).

Recomendação [RECOMENDAÇÃO], em ordem de preferência:
- **A (recomendada)**: conjunto SVG inline próprio, de 16 a 20 ícones (dias, cidades, mapa, custos, mais, anexo, mensagem, fechar, alça, engrenagem, lua, sol, alerta, perigo, info, check, seta, mais/menos, rota), `stroke="currentColor"`, grade de 24 px, traço de 1,75 px. Fontes possíveis: Lucide (licença ISC) ou Phosphor (MIT), copiando só os SVGs usados, sem dependência nova. Custo: cerca de 3 a 6 KB no bundle; esforço M (componente `Icon` + troca em ~40 pontos). Verificar licença na fonte na hora de copiar.
- **B**: pacote `lucide-react` com tree-shaking. Custo: dependência nova (gatilho de dependência a avaliar pelo devsecops-engineer), tamanho por ícone similar. Esforço P.
- **C**: manter emoji. Custo zero, mantém inconsistência.
Trocar emoji por SVG muda a aparência, mas não a identidade (cores, tipografia e layout ficam). Marcar como **decisão do usuário** o uso de `row-icon` por categoria (emoji colorido tem valor de reconhecimento rápido nas listas; pode ficar só ali).

## 6. Responsividade (critério 5)

- **Breakpoints**: um só, 768 px (:313). Celular de 375 a 400 px, tablet e desktop dividem o mesmo layout com folga; container máximo 720 px. Suficiente para o produto [FATO]; sem ponto intermediário para tablet em paisagem [HIPÓTESE] (coluna de 720 px com muito espaço vazio). Baixo.
- **Tabbar** vira barra superior no desktop (:316-324); `order:1` é o mesmo do `appbar`, então a ordem depende do DOM (`App.jsx:79-105`). Funciona, mas é frágil. Baixo.
- **Alvo de toque**: `--tap` 44 (:44) é a regra, mas há exceções [FATO]: `.btn-sm` 36 px (:154) usado em "Abrir →", ✕, anexos; `.chip` 32 px (:215); `.timeline-day` 40 x 40 (:269); checkbox 22 px (:176); `Row` clicável com título `all:unset`. WCAG 2.2 AA (2.5.8) exige 24 px, então passa; contra a própria meta de 44 px, não. Médio (Anexo/✕ no cabeçalho são `btn-sm btn-icon`: largura 44, altura 36).
- **Tabelas de relatório**: nos relatórios ativos não há tabela, só `Row` (`Custos.jsx:168`); resolveu o problema do celular. As tabelas antigas (`<table data-label>`) estão no código morto.
- **Teclado iOS**: campos com `font-size:16px` (:168) evitam zoom; `Sheet` encolhe por `visualViewport` (`ui.jsx:109-117`) e `.sheet-footer` é sticky (:433-439); histórico em `DEPLOY-LOGIN-CELULAR-CONFIG.md:71-72` e `DEPLOY-AJUSTES-POS-FASE1.md:132`. Boa solução. [HIPÓTESE] Sem verificação em aparelho real.
- **`.sheet` `max-height:88vh`** (:282) é sobrescrito por JS para 92% da viewport visual; valores diferentes entre CSS e JS (88% vs 92%). Baixo.
- **App-shell com rolagem no main** (:86-95): resolve a barra solta no iOS. Pontos de atenção: `overscroll-behavior:contain` impede o gesto "puxar para atualizar" do PWA (aceitável); `100vh` com fallback `100dvh` (bom). O `Dias` usa `contain:layout paint` e `translateX` no cartão (:421) e `touchAction: pan-y` inline.
- **Rolagem horizontal da página**: `Timeline` rola dentro do próprio contêiner (:263). Nada força rolagem da página [HIPÓTESE, confirmar em 360 px].
- **Texto pequeno**: 11 px (`--fs-1`) em rótulo de aba, chip, "Salvo" e cidade da timeline (:217, :305, :266). Abaixo do que a maioria das diretrizes considera legível para texto funcional. Médio. Sugestão: subir `--fs-1` para 12 px.

## 7. Modo escuro, impressão e contraste (critério 6)

Cobertura [FATO]: o escuro redefine superfícies, texto, acento, semânticas, linhas, sombra e as 8 cores de cidade (:49-67, :380-387). `color-scheme:dark` presente. Lacunas: `--shadow-sheet` e o `rgba` do fundo do sheet iguais ao claro; `.toast-error` e `.btn-primary` com `#fff` fixo; `meta theme-color` único.

Razões de contraste, calculadas à mão. Limites: 4,5:1 texto normal; 3:1 texto grande e elementos gráficos.

| Par (texto sobre fundo) | Onde | Razão | AA |
|---|---|---|---|
| `--text` #16181d sobre `--bg` #f6f7f9 | corpo | ~16,6 | sim |
| `--text-2` #5b6472 sobre #fff / `--bg` / `--surface-2` | `.t2`, `.row-sub`, rótulos | 6,0 / 5,6 / 5,4 | sim |
| **`--text-3` #8e97a5 sobre #fff / `--bg`** | rótulo de aba inativa (11 px), "Salvo", `.tiny.t3`, `.money-zero`, cancelado | **2,95 / 2,75** | **não** |
| #fff sobre `--accent` #2f6df6 | `.btn-primary`, dia selecionado | 4,53 | sim, por pouco |
| `--accent` #2f6df6 sobre `--bg` #f6f7f9 | aba ativa em desktop, links | 4,22 | **não** (sobre branco 4,53) |
| `--accent-strong` #1b4fd0 sobre `--accent-soft` #e8f0ff | chip Reservado, banner info | 5,96 | sim |
| **`--ok` #0f9d58 sobre `--ok-soft` #e6f5ec** | chip Pago/Concluído | **3,11** | **não** (11 px) |
| **`--danger` #d1372f sobre `--danger-soft` #fdecea** | chip Cancelado, banner danger | **4,27** | **não** |
| **`--warn` #b7791f sobre `--warn-soft` #fdf3e2** | banner de aviso | **3,31** | **não** |
| **`--neutral` #64748b sobre `--neutral-soft` #eef1f5** | chip Planejado/Pendente | **4,20** | **não** |
| #fff sobre `--danger` #d1372f | toast de erro | 4,88 | sim |
| **#fff sobre cor da cidade (dia selecionado)** | `.timeline-day` (:399-408) | c0 4,53; c1 3,51; c2 3,64; c3 4,2; c4 3,92; c5 3,67; c6 3,94; c7 3,09 | **7 de 8 não** |
| cor da cidade sobre `--city-soft` (`city-tag`) | etiqueta | c1 ≈3,1; c2 ≈3,3; c7 ≈2,9; demais ≈3 a 4 [estimado] | **provável não** |
| Borda de campo `--line` #e3e6ec sobre #fff | input | ~1,25 | **não** (1.4.11 pede 3:1 para o limite do controle) |
| Escuro: `--text` #e8ebf0 sobre `--bg` #0f1216 | corpo | ~15,7 | sim |
| Escuro: `--text-2` #a2acba sobre `--surface` #171b21 | apoio | ~7,5 | sim |
| Escuro: **`--text-3` #717d8d sobre `--surface`** | aba inativa, "Salvo" | **~4,1** (sobre `--bg` ~4,5) | **não** por pouco |
| Escuro: **#fff sobre `--accent` #5c8dff** | `.btn-primary`, dia selecionado | **~3,1** | **não** |
| Escuro: **#fff sobre `--danger` #f0645c** | toast de erro | **~3,1** | **não** |
| Escuro: `--ok` #3ac07d sobre #12241b; `--danger` #f0645c sobre #2d1715 | chips | ~7,0; ~5,4 | sim |
| Impressão: `#000`, `#333`, `#555`, `#666` sobre `#fff` | PDF | 21; 12,6; 7,5; 5,7 | sim |

Severidade:
- **Alto**: chips de status e banners (texto de status reprova em 4 dos 6 pares claros; é a informação principal de Planejado/Reservado/Pago/Cancelado). `--text-3` usado em texto funcional (aba inativa). `btn-primary` e dia selecionado no escuro.
- **Médio**: cor da cidade com texto branco; borda de campo; accent sobre `--bg`.
- **Baixo**: `palette()` dos gráficos: barras com #10b981, #f59e0b, #84cc16 têm menos de 3:1 contra o fundo claro (estimativa), mas cada barra tem rótulo e percentual ao lado, então a informação não depende só da cor.

Correção sugerida (valores a validar com ferramenta): escurecer `--ok`, `--warn`, `--danger`, `--neutral` e `--text-3` no claro e usar sombreamento para o texto de chip (por exemplo `--ok-text`); criar `--on-accent` (no escuro, texto escuro `#0b1220` sobre `#5c8dff`); aplicar para o dia selecionado texto sobre a cor da cidade pela variante `--city-strong` ou fundo `--text` com faixa da cidade.

Impressão [FATO]: `@page A4`, margem 14 mm, esconde app, mostra `.print-doc` (:334-363); tipos em pt (11 / 10,5 / 9), preto e cinza com contraste suficiente, `break-inside:avoid` por dia. `PrintView` tem `aria-hidden="true"` (`PrintView.jsx:53`); isso não afeta o PDF visual, mas o conteúdo é invisível para leitor de tela e sem marcação de tabela. Pontos [HIPÓTESE]: quebras de página em dia longo (`break-inside:avoid` num bloco maior que a página é ignorado); no tema escuro, `color-scheme:dark` pode tingir campos, mas o PDF só mostra `.print-doc`, sem campos; emoji ausente (bom); links em `.print-link` 9 pt com `word-break:break-all`, legível. Sem cores de status na impressão: o status (Pago/Cancelado) depende de texto (confirmar em `PrintView`). Baixo.

## 8. Proposta: design system mínimo (critério 7)

Princípio: manter a identidade atual (azul `#2f6df6`, neutros, pilha de fontes do sistema, cantos 8/12/16, cor por cidade). Não há proposta de identidade nova. Mudanças de **valor** de cor para atender contraste são ajustes de acessibilidade, que alteram o tom levemente: **decisão do usuário** (aprovar a nova tonalidade de ok/warn/danger/neutral/text-3).

**Tokens (arquivo único `src/styles/tokens.css` ou `docs/design/tokens.md`, esforço P):**
- Mantidos: tudo de :7-47 e :49-67.
- Novos: `--on-accent`, `--focus` (ring), `--line-input` (3:1), `--ok-text`/`--warn-text`/`--danger-text`/`--neutral-text` (texto de chip e banner), `--city-strong`, `--z-chip`/`--z-bar`/`--z-sheet`/`--z-toast`, `--fs-0` 12 px (e `--fs-1` ≥ 12), `--icon-sm/md/lg` 16/20/24, `--dur-fast`/`--dur`, `--chart-1..8` alinhado a `--city-*`.
- Regra: nada de `style={{ }}` com cor ou espaço; usar utilitários (`.stack`, `.row-between`, novo `.cluster`, `.mt-*`).

**Componentes (10), com estados:**

| # | Componente | Existe? | Estados a completar |
|---|---|---|---|
| 1 | `Button` (primary, secondary, ghost, danger; sm/md; icon) | CSS sim | carregando, desabilitado com contraste, alvo 44 em `sm` (padding invisível) |
| 2 | `Icon` (SVG) | não | tamanhos, `currentColor`, `aria-hidden` ou título |
| 3 | `Field` + `Input/Select/Textarea` + `MoneyInput` | parcial | erro (`aria-invalid` + mensagem), desabilitado, hover, ajuda, `--line-input` |
| 4 | `StatusChip` | sim | contraste, hover, item atual no menu, setinha como ícone |
| 5 | `Row` (lista) | sim | linha toda clicável, hover/pressed, carregando (esqueleto), 44 px |
| 6 | `Card` / `Metric` | sim | carregando (esqueleto) |
| 7 | `Sheet` / `Modal` | sim | carregando, erro; alinhar 88/92 vh |
| 8 | `Banner` + `Toast` | sim | ícone SVG, contraste, fechar |
| 9 | `TabBar` + `AppBar` | sim | ícone ativo (preenchido ou cor), badge de contagem |
| 10 | `Timeline` (dias) + `CityTag` | sim | contraste do selecionado, hover, foco |

Estados transversais: `EmptyState` (existe), `Skeleton` e `InlineError` (novos).

**Ordem de adoção e esforço:**

| Ordem | Passo | Esforço | Severidade tratada |
|---|---|---|---|
| 1 | Corrigir contraste (tokens de texto de status, `--text-3`, `--on-accent`, dia selecionado, borda de campo) | P | Alto |
| 2 | Remover as 8 telas legadas e o CSS ausente (após confirmar que nada as importa) | P | Médio |
| 3 | Escala de `z-index`, `--fs-0`, `--icon-*`, `--focus`, alvo 44 nos botões `sm` | P | Médio |
| 4 | Estados faltantes: erro de campo, carregando (botão e esqueleto), hover/pressed de `Row` e chip, `@media (hover:hover)` | M | Médio |
| 5 | Ícones SVG (opção A) e `Row` clicável por inteiro | M | Médio |
| 6 | Mover `style={{ }}` para classes/utilitários (176 pontos; começar por `Custos`, `Mais`, `Login`) | G | Médio |
| 7 | Unir paleta de gráfico e cidade; `theme-color` por esquema; documentar em `docs/design/tokens.md` | M | Baixo |

Esforço: P = até meio dia, M = 1 a 3 dias, G = mais de 3 dias [estimativa].

## 9. Decisões e justificativas

- Manter cor por cidade: carrega informação e preserva a identidade; ajustar contraste, não o conceito.
- Subir texto mínimo para 12 px: legibilidade em celular, sem mudar a escala.
- SVG em vez de emoji: consistência e controle de cor/contraste, não estética.
- Ajuste de tonalidade de status: exigido por contraste (WCAG 2.2 AA); aprovação do usuário por mexer em cores visíveis.

## 10. Não verificado (precisa de captura de tela ou ferramenta)

1. Todas as razões de contraste: recalcular com ferramenta (por exemplo `npx wcag-contrast <fg> <bg>` ou verificador WebAIM), claro e escuro.
2. Renderização em 360 px e 1280 px: rolagem horizontal, tabbar, timeline, quebra de texto longo nos `Row`.
3. Aparência real dos emoji em Android, iOS e Windows.
4. Foco por teclado em `Row` clicável (`all:unset`), chip e menu do chip.
5. Teclado no iOS em sheets (retestar `.sheet-footer`) e o swipe do cartão `Dias`.
6. Prévia de impressão (Ctrl+P) em A4 com roteiro longo e no tema escuro.
7. Confirmar por busca que as 8 telas legadas não são importadas (inclusive por teste ou import dinâmico).
