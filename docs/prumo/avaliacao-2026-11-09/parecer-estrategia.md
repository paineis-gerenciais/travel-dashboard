# Parecer de estratégia: travel-dashboard

Data: 2026-11-09 · Autor: business-strategy (Prumo) · Demanda: avaliação consultiva, sem issue, N2, somente leitura.
Rótulos: [FATO] com fonte e data de acesso (todas 2026-11-09); [HIPÓTESE]; [RECOMENDAÇÃO]. Esforço: P/M/G. Severidade: Bloqueador/Alto/Médio/Baixo.

## 1. Pergunta e decisão apoiada
Vale investir para tirar o travel-dashboard do uso pessoal (autor e pessoas próximas) e, se sim, em qual caminho: pessoal, código aberto, nicho gratuito ou produto pago? A decisão é do dono do projeto.

## 2. O que o repositório mostra
- [FATO] App React 18 + Vite 5 + Firebase 10 (Auth, Firestore, Hosting) + PWA. Dependências de runtime: firebase, react, react-dom, xlsx (`package.json`). Nenhum SDK de anúncio.
- [FATO] Telas (DEPLOY-REDESIGN.md): Dias, Cidades, Mapa, Custos, Mais. O Mais traz checklist, versões, impressão, exportar/importar planilha e compartilhar.
- [FATO] Colaboração: assinatura em tempo real do documento da viagem (`TripProvider.jsx`, `subscribeTrip`), presença a cada 15 s (`setInterval(beat, 15000)`), feed de atividade e comentários por item (`tripData.js`). Convite por WhatsApp, `mailto:`, compartilhar do sistema ou copiar (DEPLOY-CONVITE-ENVIO.md). Não há envio automático de e-mail.
- [FATO] Mapa: link do Google Maps (`domain/transport.js`) e mapa embutido com Leaflet, tiles do OpenStreetMap e geocodificação pelo Nominatim, com fila de 1 busca por segundo e cache em `localStorage` (`lib/geocode.js`).
- [FATO] Moeda e formatação só em pt-BR (`domain/format.js`, `toLocaleString('pt-BR')`). Não há campo de moeda estrangeira no código lido.
- [FATO] Qualidade: `domain.test.js` tem 111 casos declarados (contagem estática; não executei), há `src/rules/__tests__/rules.test.js` e `e2e/fluxos-criticos.spec.js`, e há 3 workflows de CI.
- [FATO] Não há arquivo LICENSE na raiz (leituras de `LICENSE` e `LICENSE.md` falharam). O repositório é público e sem licença: por padrão vale "todos os direitos reservados". [HIPÓTESE] Esse é o efeito jurídico padrão; confirmar com a documentação do GitHub.
- [FATO] O README descreve só a "Fase 1" (login Google, usuário único, `deploy.yml`) e está defasado em relação ao produto. Isso pesa em qualquer cenário aberto ou comercial.
- [FATO] O login por celular exige o plano Blaze (cartão cadastrado) segundo o próprio repositório (DEPLOY-LOGIN-CELULAR-CONFIG.md). Logo, "custo fixo zero" já não vale como garantia: a conta pode gerar cobrança.
- [HIPÓTESE] Uso real: sem dados no repositório. O roteiro de pesquisa (PESQUISA-ROTEIRO-T1.4.md) existe, mas não há registro de que as 5 a 8 sessões ocorreram. Esse é o maior buraco de evidência.

## 3. Mapa de alternativas (critério 1)
| Alternativa | Faz melhor | Preço (fonte) | Onde o travel-dashboard difere |
|---|---|---|---|
| Planilha Google | Liberdade total, todo mundo conhece | [HIPÓTESE] grátis | Já tem custos, rota e divisão prontos, sem montar fórmulas. A origem do projeto é essa planilha. |
| WhatsApp (grupo) | Já está aberto, zero atrito | [HIPÓTESE] grátis | Informação estruturada por dia e custo, em vez de rolar conversa. O WhatsApp vira só canal de convite. |
| Notion | Flexível, bom para notas | [HIPÓTESE] plano gratuito; não pesquisei | Sem montar template; custos e divisão calculados. |
| Wanderlog | Roteiro com mapa, importação de reservas, offline e PDF no Pro, IA | [FATO] Pro cerca de US$ 40/ano, fontes divergem (US$ 39,99 a 49,99 na App Store). Pro: offline, PDF, sem anúncios, IA ilimitada. https://www.pilotplans.com/compare/wanderlog-alternative-feature-comparison e https://apps.apple.com/us/app/wanderlog/id1476732439 (2026-11-09). Há listagem em pt-BR na App Store BR. | Divisão com acerto em R$ e foco em pt-BR. [HIPÓTESE] Wanderlog é mais forte em descoberta de lugares e escala. |
| TripIt | Reservas por e-mail, alertas de voo | [FATO] Pro cerca de US$ 49/ano. https://tripit.com/es-co/web/pro/pricing e https://apps.apple.com/us/app/-/id311035142 (2026-11-09) | TripIt organiza reservas, não orçamento nem divisão. |
| Google Maps (listas) / Google Travel | Descoberta, mapa, gratuito | [HIPÓTESE] grátis | O app usa o Google Maps só por link. Lista não tem custos nem divisão. |
| Splitwise | Divisão de despesas madura | [FATO] Free limita despesas por dia (3 a 5, número não oficial); Pro na App Store BR a partir de R$ 9,90 (período não identificado). https://getfinny.app/blog/splitwise-pricing-2026 e https://apps.apple.com/br/app/splitwise/id458023433 (2026-11-09) | Divisão ligada ao dia, à cidade e ao orçamento da viagem, sem limite diário. |
| Tricount | Divisão gratuita, ligada ao banco bunq | [FATO] Premium descontinuado; o app novo é gratuito. https://help.tricount.com/articles/what-happened-with-tricount-premium (2026-11-09) | Divisão grátis já existe e é boa. Divisão sozinha não é diferencial. |
| Nomad "Viagem em grupo" | Divisão no app da fintech, grupo de até 15 | [FATO] função de grupo até 15 pessoas. https://www.cartoesdecredito.me/contas/nomad-lanca-ferramenta-para-controle-de-gastos-em-viagens/ (2026-11-09) | Nomad é conta e cartão; não faz roteiro. |
| Quanto Deu? | Divisão rápida no grupo do zap | [FATO] projeto de um desenvolvedor brasileiro, via https://www.tabnews.com.br/sorrizera/criei-meu-proprio-splitwise-depois-de-uma-viagem-e-muitos-gastos-compartilhados-entre-amigos (2026-11-09) | Só divisão. |
| Roadtrippers, TripCase | Viagem de carro; reservas | Não pesquisei. [HIPÓTESE] pouco relevantes para o público brasileiro; confirmar se o TripCase ainda existe. | Fora do foco. |

Leitura:
- [HIPÓTESE] O nicho vazio é "roteiro + custo + divisão + grupo, em pt-BR, sem anúncio nem comissão, em uma ferramenta só". Cada pedaço isolado tem concorrente gratuito bom (Tricount, Wanderlog free, Google Maps). A união é o que ninguém pesquisado entrega. Não verifiquei se existe app brasileiro dedicado: a busca achou Nomad e Quanto Deu?, nenhum faz roteiro. O resultado pode estar incompleto.
- [HIPÓTESE] A dor que vence é "combinar e acertar contas no grupo", não "montar roteiro". A pesquisa da própria Fase 1 já apontava essa aposta.

## 4. Cenários de evolução (critério 2)
| | A. Pessoal/familiar bem acabada | B. Código aberto com comunidade | C. Nicho grátis com doação ou freemium | D. Pago B2C ou B2B2C |
|---|---|---|---|---|
| Esforço | P | M a G | G | G |
| Custo em dinheiro (12 meses) | R$ 50 a 500 | R$ 50 a 500 | R$ 150 a 7.400 (ver seção 5) | idem C, mais taxas de pagamento e contador |
| Horas/mês [HIPÓTESE] | 2 a 4 | 10 a 20 | 20 a 30 | 40 a 80 |
| Prós | Sem suporte nem risco jurídico. Resolve o problema real do autor. | Credibilidade, contribuições, lock-in aceitável. Combina com "sem anúncio, sem comissão". | Dá para testar demanda com pouco gasto. | Única via com receita relevante. |
| Contras | Sem impacto além do círculo. | Exige licença, README atual, guia de contribuição e tempo de revisão. Quem hospeda o próprio Firebase precisa configurar tudo (Auth, regras, Blaze). Dinheiro quase nulo. | Doação costuma render pouco [HIPÓTESE]. Tempo de suporte cresce antes da receita. | Pagamentos e dados de terceiros disparam gatilhos de escalonamento da Prumo (aprovação, devsecops, N2 ou mais). Concorrentes gratuitos limitam o preço. |
| O que precisa ser verdade | Nada além da vontade do autor. | Pessoas além do autor querem rodar ou contribuir. | 3 ou mais pessoas fora do círculo usam sem ajuda e voltam em outra viagem. | Disposição a pagar medida (não declarada) e um recurso que o grátis não cobre. |
| Recurso pago plausível | n/a | n/a | Várias moedas com conversão, PDF/impressão premium, anexos hospedados (hoje só por link). [HIPÓTESE] sem validação. | Agências pequenas e grupos de excursão: link do cliente, marca própria, lista de participantes. [HIPÓTESE] sem evidência de demanda. |

Referências de preço: Wanderlog cerca de US$ 40/ano e TripIt cerca de US$ 49/ano (seção 3). Um preço brasileiro plausível seria R$ 79 a 149 por ano por organizador. [HIPÓTESE] sem pesquisa.

### Recomendação
[RECOMENDAÇÃO] **Seguir em A agora, preparando B-leve, e só tentar C se a validação de 90 dias passar.** Evitar D por enquanto.

Justificativa:
1. A evidência de demanda é nula fora do círculo do autor [HIPÓTESE do Head, sem dados]. Investir em C ou D antes disso é apostar sem sinal.
2. O custo de validar é baixo: a pesquisa já está roteirizada e o app já está publicado. Falta executar.
3. D abre gatilhos de escalonamento (pagamentos, dados de terceiros, custo recorrente) e concorre com Tricount gratuito e Wanderlog gratuito. A margem de erro é pequena.

B-leve (esforço P): licença, README atual e um aviso de "uso por conta e risco". Escolha de licença é decisão do autor com apoio jurídico. [HIPÓTESE] MIT ou Apache-2.0 para máxima adoção; AGPL-3.0 se quiser impedir que um terceiro venda o app fechado.

### Três sinais em 90 dias
| Sinal | Confirma se | Refuta se |
|---|---|---|
| 1. Retenção entre viagens | 3 ou mais grupos fora do círculo próximo criaram uma viagem e voltaram a editar em 30 dias | Todos os usos novos morrem após o primeiro dia |
| 2. Dor dominante | 3 ou mais das 5 a 8 entrevistas citam "combinar e acertar contas" espontaneamente | O pedido dominante é descoberta de roteiro ou preço de passagem |
| 3. Disposição de pagar | 2 ou mais pessoas aceitam pré-pagar ou pedem recurso de moeda ou PDF sem serem provocadas | Ninguém pagaria nem pelo recurso pedido |

Como medir sem inventar dados: o Firebase Analytics já está instrumentado, com lista de chaves permitidas e sem dados pessoais (`lib/analytics.js`). O sinal 1 pode sair de contagem de viagens e membros (`members`). [HIPÓTESE] A definição exata de "ativo" fica com o data-bi-engineer.

## 5. TCO em 12 meses (critério 3)
Premissas de cada cenário são hipóteses, a menos que haja fonte. O cálculo usa o que o código faz hoje.

### 5.1 Premissas
| # | Premissa | Base | Conservador | Fonte |
|---|---|---|---|---|
| P1 | Sessões por usuário ativo por mês | 4 | 8 | [HIPÓTESE] |
| P2 | Duração da sessão | 10 min | 10 min | [HIPÓTESE] |
| P3 | Escritas por sessão | 60: ~40 batimentos de presença (1 a cada 15 s), ~15 gravações do documento (debounce de 900 ms), alguns eventos de atividade e comentários | 90 | Código: `TripProvider.jsx`, `tripData.js` |
| P4 | Leituras por sessão | 100: documento da viagem, atividade sem limite de documentos, presença, comentários, mais ecos de gravações de colegas conectados | 150 | Código + [HIPÓTESE] |
| P5 | Regras com `get()` do documento da viagem | Contam como leitura extra por operação; já embutido em P4 | idem | `firestore.rules` linhas 17 a 20; [HIPÓTESE] sobre a cobrança, verificar na doc do Firebase |
| P6 | Pico de sazonalidade | 3x a média diária (janeiro, julho, feriados) | 3x | [HIPÓTESE] |
| P7 | Cota gratuita do Firestore | 50.000 leituras e 20.000 escritas por dia | idem | [FATO] https://www.activepieces.com/blog/firebase-pricing-2026-plans-costs-and-free-limits (2026-11-09), que cita a página do Firebase; fonte de segundo nível |
| P8 | Preço acima da cota | US$ 0,06 por 100 mil leituras e US$ 0,18 por 100 mil escritas | idem | [HIPÓTESE]. Fontes divergem: US$ 0,03 a 0,06 por leitura (https://blog.back4app.com/firestore-pricing/). Usei o valor mais alto. Região e preço de escrita não confirmados. |
| P9 | SMS | 20% dos usuários entram por celular, 2 SMS por ano cada | 40%, 4 SMS | [HIPÓTESE] |
| P10 | Preço do SMS no Brasil | US$ 0,05 | US$ 0,05 | [FATO] de segundo nível, https://www.metacto.com/blogs/the-complete-guide-to-firebase-auth-costs-setup-integration-and-maintenance (2026-11-09). Os 10 SMS/dia grátis têm leitura conflitante entre fontes; ignorei. |
| P11 | Hospedagem | ~3 MB por usuário ao mês (instalação e atualização do PWA); acima de 10 GB/mês, US$ 0,15/GB | 6 MB | [HIPÓTESE]. Tamanho do pacote não medido; preço a confirmar. |
| P12 | Domínio | R$ 40/ano (.com.br) | idem | [HIPÓTESE] |
| P13 | Câmbio | R$ 5,50 por US$ | idem | [HIPÓTESE] |
| P14 | E-mail transacional (só se houver convite automático, a partir de 1.000 usuários) | 0 até 1.000; US$ 20/mês em 10.000 | US$ 20/mês | [HIPÓTESE] |

Por usuário ativo por mês (base): 4 x 60 = 240 escritas e 4 x 100 = 400 leituras. Por dia, 8 escritas e 13 leituras por usuário (média de 30 dias).

### 5.2 Onde o nível gratuito deixa de bastar (Firestore)
Fórmula: usuários = cota diária ÷ operações por usuário por dia (÷ 3 para o pico).
- Base: escritas 20.000 ÷ 8 = 2.500 usuários na média; ÷ 3 = ~830 no pico. Leituras 50.000 ÷ 13 = ~3.800; ~1.280 no pico. **A escrita estoura primeiro: entre ~800 e ~2.500 usuários ativos.**
- Conservador (P1 = 8, P3 = 90): 24 escritas por usuário por dia → 830 na média, ~280 no pico. **Entre ~300 e ~800.**
- [FATO] O gargalo de escrita vem em boa parte da presença: 40 de 60 escritas por sessão. [HIPÓTESE] Reduzir o batimento é a alavanca mais barata. A escolha técnica fica com o software-architect.
- [FATO] Mesmo antes disso, o SMS exige Blaze e cartão (DEPLOY-LOGIN-CELULAR-CONFIG.md). O "zero real" acaba no primeiro SMS cobrado.

### 5.3 Custo em dinheiro, 12 meses
Cálculo do excedente (base, 10.000 usuários): escritas 10.000 x 8 = 80.000 por dia, excedente 60.000, x 30 = 1,8 milhão por mês x US$ 0,18/100 mil = US$ 3,24 por mês. Leituras 133.000 por dia, excedente 83.000, x 30 = 2,5 milhões x US$ 0,06/100 mil = US$ 1,50 por mês. Total Firestore ~US$ 4,70 por mês (~US$ 56 por ano). Conservador: ~US$ 18 por mês (~US$ 215 por ano).

| Item (US$/ano) | 100 base | 100 cons. | 1.000 base | 1.000 cons. | 10.000 base | 10.000 cons. |
|---|---|---|---|---|---|---|
| Firestore (excedente) | 0 | 0 | 0 | ~3 | ~56 | ~215 |
| Hosting | 0 | 0 | 0 | 0 | ~36 | ~72 |
| SMS (P9, P10) | 2 | 8 | 20 | 80 | 200 | 800 |
| E-mail transacional | 0 | 0 | 0 | 0 a 240 | 240 | 240 |
| Domínio (R$ 40 ≈ US$ 7) | 7 | 7 | 7 | 7 | 7 | 7 |
| **Total em dinheiro** | **~9** | **~15** | **~27** | **~90 a 330** | **~540** | **~1.330** |
| Em R$ (x 5,50) | ~50 | ~85 | ~150 | ~500 a 1.800 | ~3.000 | ~7.300 |

Observação: na coluna "10.000 base" o e-mail entra por P14 (US$ 240) e muda o total em relação à soma só de infraestrutura (~US$ 300).

### 5.4 Tempo de manutenção (a parte cara)
- [HIPÓTESE] 100 usuários: 2 a 4 h/mês (~36 h/ano). 1.000: 6 a 10 h/mês, com suporte e correções (~90 h/ano). 10.000: 20 a 40 h/mês, o que já é meio período (~360 h/ano).
- A R$ 100/h (custo de oportunidade, [HIPÓTESE]): 100 usuários ~R$ 3.600; 1.000 ~R$ 9.000; 10.000 ~R$ 36.000 por ano.
- **Leitura:** o dinheiro de infraestrutura é irrisório diante do tempo. O custo real é suporte, evolução e conformidade.

### 5.5 Receita de referência (cenário D, só para dimensionar)
[HIPÓTESE] Se 3% dos usuários ativos pagarem R$ 99 por ano: 100 usuários = R$ 300; 1.000 = R$ 2.970; 10.000 = R$ 29.700 por ano, antes de taxas de pagamento (3% a 5%, [HIPÓTESE]) e impostos. Com R$ 100/h, o resultado só cobre o tempo de suporte perto de 10.000 usuários ativos. Chegar a esse número exige canal de aquisição que não existe hoje.

## 6. Riscos (critério 4)
| # | Risco | Prob. | Severidade | Mitigação | Esforço |
|---|---|---|---|---|---|
| R1 | Nominatim: o uso comercial ou de escala fere a política. Resumo da política em fontes secundárias: máximo de 1 req/s, identificação do app, cache, bloqueio por IP em abuso, sugestão de provedor próprio ou comercial para uso pesado. [FATO] segundo https://www.openstreetmap.org/user/pnorman/diary/398773 e https://lists.openstreetmap.org/pipermail/geocoding/2013-June/000825.html (2026-11-09); a página oficial não abriu (domínio bloqueado). [FATO] Um navegador não consegue definir User-Agent próprio; o app depende do Referer, e o código não identifica a aplicação além disso. [HIPÓTESE] Os tiles têm política própria e a atribuição precisa estar visível. | Média | Alto em C/D; Baixo em A | Manter fila e cache; trocar por provedor pago ou instância própria antes de abrir ao público; conferir atribuição OSM no mapa | M |
| R2 | Google Maps por link: [HIPÓTESE] link `maps/dir/?api=1` é recurso documentado e não usa chave nem cobra; verificar os termos antes de qualquer uso comercial. | Baixa | Baixo | Conferir termos; manter só links | P |
| R3 | LGPD: com terceiros, o autor vira controlador ou operador de nomes, e-mails, telefones e dados de viagem (que revelam rotina e ausência de casa). Sem política de privacidade nem fluxo de exclusão de conta conhecido nos arquivos lidos. Tema jurídico: decisão do usuário, não da estratégia. [HIPÓTESE] Em A (círculo próximo) o risco é menor, não nulo. | Alta se C/D | Alto | Política de privacidade, base legal, exclusão e exportação de dados, aviso de retenção; parecer jurídico antes de C/D | M a G |
| R4 | Lock-in do Firebase: dados no Firestore, regras em linguagem própria, Auth do Google. [FATO] O app exporta e importa planilha (`xlsx`, `domain/sheet.js`), o que baixa o lock-in do dado do usuário. Migrar o back-end seria reescrita. | Média | Médio | Manter a camada `lib/tripData.js` como porta única; exportação sempre disponível. Decisão técnica: software-architect. | M |
| R5 | Conta Blaze sem teto: [FATO] alertas de orçamento avisam, mas não interrompem o consumo (https://www.activepieces.com/blog/firebase-pricing-2026-plans-costs-and-free-limits, 2026-11-09). Abuso de SMS (fraude de tráfego) pode gerar fatura. [HIPÓTESE] Região permitida e App Check reduzem o risco. | Média | Alto | Alertas de orçamento, limite de regiões de SMS, App Check; revisão do devsecops-engineer | P a M |
| R6 | IA generativa de roteiros (Google, ChatGPT, Wanderlog AI): [FATO] Wanderlog já inclui assistente de IA, com uso ilimitado no Pro (https://www.pilotplans.com/compare/wanderlog-alternative-feature-comparison, 2026-11-09). [HIPÓTESE] A IA substitui "montar o roteiro", não "combinar o grupo e acertar contas". Concorrer em roteiro é perder; o app deve ser o lugar onde o roteiro gerado vira plano e orçamento do grupo. | Alta | Médio | Posicionar em coordenação e custos; aceitar roteiro vindo de qualquer fonte | P |
| R7 | Sazonalidade: [HIPÓTESE] uso concentrado em planejamento (meses antes) e na viagem; picos em janeiro e julho, vales no resto. Retenção entre viagens é baixa por natureza. Afeta cota diária (P6) e receita recorrente. | Alta | Médio | Anual em vez de mensal; foco em "próxima viagem" e em grupos recorrentes (família, turma) | P |
| R8 | Dependência xlsx ^0.18.5 na importação de planilha: [HIPÓTESE] versões 0.18.x têm vulnerabilidades conhecidas (prototype pollution e ReDoS) e o pacote npm não recebe correções recentes. Verificar. | Média | Médio a Alto (importa arquivo do usuário) | Rodar `npm audit`; avaliar alternativa ou isolar a importação. Decisão: devsecops-engineer e software-architect. | P a M |
| R9 | Ausência de licença: impede reuso legal por terceiros e deixa a intenção do autor ambígua. | Certa | Baixo em A; Médio em B | Escolher licença antes de convidar contribuições | P |
| R10 | Escala de leitura do feed: [FATO] `subscribeActivity` e `subscribeAllComments` leem a coleção inteira antes de ordenar no cliente (`slice`), então o custo cresce com o histórico da viagem. | Média | Baixo | Item técnico para o software-architect; não defino aqui | P |
| R11 | Concentração em uma pessoa (2 autores, 31 commits em 2 meses, conforme o Head): [HIPÓTESE] fator de ônibus 1 para qualquer uso com terceiros. | Alta | Médio | Documentação e licença em B; em A, aceitar | M |
| R12 | Falta de evidência de uso e de pesquisa executada | Certa | Alto para C/D | Executar o roteiro T1.4 antes de qualquer investimento | P |

## 7. Posicionamento e mensagem (critério 5)
**Frase:** "Roteiro, custos e divisão de despesas do grupo num só lugar, em português, sem anúncio e sem comissão."

Três argumentos comprováveis hoje pelo código:
1. **Roteiro, custo e acerto juntos.** O estado da viagem tem dias, cidades, transporte, hospedagem, refeições, atrações e despesas; custos e a divisão são calculados em módulos de domínio puros, com testes (`domain/costs.js`, `domain/split.js`, `domain.test.js` com 111 casos declarados; item cancelado fora do total, conforme DEPLOY-REDESIGN.md). Verificável rodando `npm test`.
2. **Grupo em tempo real, com acesso restrito aos membros.** Edição ao vivo, presença, comentários por item e feed de atividade, com regras de Firestore só para membros e testes de regras (`firestore.rules`, `src/rules/__tests__/rules.test.js`). O convite sai por WhatsApp ou e-mail do próprio usuário. Verificável com `npm run test:rules`.
3. **Sem anúncio, sem comissão, com privacidade por construção e saída fácil.** Não há SDK de anúncio nas dependências; a analítica só aceita chaves de categoria e contagem (`lib/analytics.js`); a viagem sai em planilha, impressão e versões. Funciona offline como PWA. Verificável em `package.json` e `lib/analytics.js`. [HIPÓTESE] "Sem comissão" é fato de modelo de negócio, não de código; vale enquanto o autor não fechar acordos de afiliados.

Cuidado: [FATO] DEPLOY-CONVITE-ENVIO.md registra que o app não envia e-mail sozinho. Não prometer "convite automático por e-mail".

## 8. Alternativas "não fazer" e "adquirir pronto"
- **Não fazer (parar de evoluir):** custo próximo de zero; o app continua útil ao autor. Perde-se a chance de aprender com usuários reais. Combina com A.
- **Adquirir pronto:** Wanderlog (grátis ou ~US$ 40/ano) cobre o roteiro; Tricount (grátis) cobre a divisão. A combinação dos dois resolve boa parte do problema sem custo de manutenção. Isso é o argumento mais forte contra C e D e precisa ser respondido pela pesquisa: o que o grupo perde ao juntar os dois?

## 9. Condições que invalidam a recomendação
- Se a pesquisa mostrar que os grupos já resolvem bem com Wanderlog + Tricount, encerrar em A e não investir em B-leve além da licença.
- Se 3 ou mais pessoas fora do círculo usarem e voltarem sem ajuda, subir para C, com antes o parecer de LGPD e a troca do geocodificador (R1, R3).
- Se o tempo do autor for inferior a ~4 h/mês, ficar em A e não abrir a terceiros.

## 10. Próximo passo barato
Executar 5 a 8 sessões do roteiro `PESQUISA-ROTEIRO-T1.4.md` (inclua ao menos uma pessoa que não usa o app) e olhar a contagem de viagens, membros e retorno no Firebase Analytics. Custo: poucas horas e zero de infraestrutura. Paralelamente, adicionar uma licença e atualizar o README (esforço P).

## 11. Limites desta análise
- Páginas oficiais do Firebase e da OSM Foundation não abriram nesta sessão (domínio fora da lista de rede). Preços e política vêm de fontes secundárias e precisam de conferência.
- Não executei código nem abri o app publicado; contagens de teste são estáticas.
- Não pesquisei Notion, Roadtrippers, TripCase, Google Travel nem preços de domínio, câmbio e e-mail transacional.

## 12. Fontes (acessadas em 2026-11-09)
- https://www.pilotplans.com/compare/wanderlog-alternative-feature-comparison
- https://apps.apple.com/us/app/wanderlog/id1476732439
- https://tripit.com/es-co/web/pro/pricing
- https://apps.apple.com/us/app/-/id311035142
- https://getfinny.app/blog/splitwise-pricing-2026
- https://apps.apple.com/br/app/splitwise/id458023433
- https://help.tricount.com/articles/what-happened-with-tricount-premium
- https://www.cartoesdecredito.me/contas/nomad-lanca-ferramenta-para-controle-de-gastos-em-viagens/
- https://www.tabnews.com.br/sorrizera/criei-meu-proprio-splitwise-depois-de-uma-viagem-e-muitos-gastos-compartilhados-entre-amigos
- https://www.activepieces.com/blog/firebase-pricing-2026-plans-costs-and-free-limits
- https://blog.back4app.com/firestore-pricing/
- https://www.metacto.com/blogs/the-complete-guide-to-firebase-auth-costs-setup-integration-and-maintenance
- https://www.openstreetmap.org/user/pnorman/diary/398773
- https://lists.openstreetmap.org/pipermail/geocoding/2013-June/000825.html
