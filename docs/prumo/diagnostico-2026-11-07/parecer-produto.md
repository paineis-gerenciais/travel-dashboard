# Parecer de produto: maturidade do travel-dashboard

Data: 2026-11-07. Somente leitura. Fontes: README.md, 17 DEPLOY-*.md, PESQUISA-ROTEIRO-T1.4.md, grep em src/. Sem PRD, sem issues, sem dado de uso.

## Resposta curta
O projeto virou uma ferramenta de planejamento e orçamento de viagem em grupo, com 15 PRs em 40 dias e nenhum ciclo de aprendizado fechado. Entregou muito. Não mediu nada. "Evoluir" hoje seria aposta, pelo próprio critério do autor (DEPLOY-FASE1-COMPLETA.md §6).

## Achados (5)

### 1. [FATO] O problema declarado mudou e nunca foi reescrito
- README.md descreve "migração do dashboard de planejamento de viagem" para React + Firebase e cita Fase 2 (compartilhamento) e Fase 3 (visual) como "próximas fases". Ambas já foram entregues, mais mais de dez levas fora do plano. O README está desatualizado: diz 22 testes (hoje 111) e "10 telas" (hoje 5 destinos).
- O problema que o código serve hoje: coordenar a viagem de um grupo e controlar o dinheiro (divisão, rateio, acerto, comentários, convite). Aparece só como "aposta de diferenciação" em PESQUISA-ROTEIRO-T1.4.md §3 ("coordenação familiar + orçamento"), citando `consultoria_estrategica_v1.md`, que não está no repositório.
- [HIPÓTESE] A aposta (coordenação + orçamento) é a dor real. Nenhuma evidência no repositório.
- [RECOMENDAÇÃO] Escrever o problema em uma frase, sem solução, e a meta de uso. Hoje não existe lugar com essa frase.

### 2. [FATO] A condição que "destrava a Fase 2" nunca foi cumprida
- T-1.4 (5 a 8 entrevistas) e a síntese `pesquisa_usuarios_v1.md` não existem no repositório. Não há leitura de analytics registrada.
- Mesmo assim, a Fase 2 (compartilhamento), a 5 (comentários, atividade, "Por dia"), o redesign, a divisão com rateio e anexos foram construídos. A condição declarada ("sem ela, a Fase 2 volta a ser aposta") foi ultrapassada sem registro de decisão.
- [FATO] O roteiro pede amostra com pelo menos uma pessoa que não usa o app e só conta sinal que aparece em 3 ou mais sessões.

### 3. [FATO] Código sem uso e funcionalidade sem dono
- Nenhum `import` encontrado (grep em src/) para Alimentacao, Atracoes, Outras, PorDia, Roteiro, Transporte, Resumo, Checklist (screens/) nem para EmbeddedMap. O App.jsx carrega só Dias, Cidades, Mapa, Custos e Mais.
- Ressalva: Resumo e Checklist existem como destino em "Mais" segundo DEPLOY-REDESIGN.md; pode haver lógica reimplementada. Os arquivos de tela em si não têm importador.
- Consequência: `leaflet`, `lib/geocode.js` (Nominatim) e `localStorage` de cache permanecem no código sem tela que os use. DEPLOY-FASE5 §5.D e §5.E (paleta minimalista) foram aposentados no redesign, e as decisões "manter ou não" ficaram sem desfecho escrito.
- Login por celular: existe em Login.jsx, mas depende do plano Blaze (DEPLOY-LOGIN-CELULAR-CONFIG.md §1). O mesmo documento chama o login por e-mail de "mais acessível". Não há registro de que o Blaze foi ativado, nem de uso.
- Item 2.0 (migração de dados antigos) ficou fora e nunca foi retomado (DEPLOY-FASE2.md). `migracao/` não está no repositório.
- [RECOMENDAÇÃO] Decidir, por funcionalidade, "manter, medir ou remover", com dono (hoje só há um autor).

### 4. [FATO] Decisões adiadas "até ter dados": nenhuma condição foi cumprida
| Decisão | Onde | Condição de reabertura declarada | Cumprida? |
|---|---|---|---|
| Central de mensagens virar chat | FASE1-COMPLETA §5 | "medir com analytics, e só então decidir" | Não. Sem leitura de analytics registrada |
| Aba "Por dia" × abas por categoria | FASE5 notas | comparar as duas antes de promover uma | Superada pelo redesign (Por dia virou Dias) sem comparação registrada |
| Paleta minimalista × colorida | FASE5 notas | testar as duas | Superada: redesign adotou paleta única sem teste registrado |
| Gravar por item (fim do last-write-wins) | FASE2 notas | "só se isso incomodar na prática" | Sem relato de incômodo registrado. Não se sabe se há edição simultânea real |
| E-mail automático de convite | CONVITE-ENVIO | "pessoas que você não conhece pessoalmente" | Não. Sem indício de segundo grupo de usuários |
| Push real | FASE1-COMPLETA §5 | Fase 2 (back-end) | Não. Fase 2 entregue sem push |
| Cloud Storage para anexos (Caminho B) | ANEXOS-LINK-FRASE | "decisão em aberto", sem gatilho | Sem gatilho definido |
| Percentual/rateio por item, hospedagem na divisão | FASE1-COMPLETA §5 | "se incomodar no uso" | Já entregues em AJUSTES-POS-FASE1, sem relato de motivo |

### 5. [FATO] O backlog não existe e as entregas respondem a si mesmas
- 0 issues, 0 releases. `fase1_backlog_v2.md` e `plano_melhorias_graduais_v2.md` ficam fora do repositório. Não há como saber o que está aberto, nem por quê.
- As levas recentes de correção (AJUSTES-EDICAO-ACERTO, CORRECAO-NUMEROS, AJUSTES-POS-FASE1, PLANILHA) corrigem regressões de levas anteriores ("regressões minhas", "mesma causa do problema anterior"). Isso aponta custo de manutenção alto frente ao uso.
- Cada DEPLOY lista "Testar na prévia" com itens manuais em duas contas. Não há registro de que foram executados.
- [FATO] Um lado do pedido ("evoluir em 6 meses") conflita com os dados: sem linha de base de uso, nenhuma entrega é mensurável, porque o objetivo de produto nunca foi expresso em métrica.
- [HIPÓTESE] Poucas pessoas usam (informação do usuário), e uma delas é o próprio autor. Se for só o autor, o produto é ferramenta pessoal, e as perguntas de produto mudam.

## A confirmar (hipóteses sobre usuários; não viram achado)
| Hipótese | Dado que confirmaria | Como obter |
|---|---|---|
| Quantas pessoas ativas, quantas viagens, quantas com 2 ou mais membros | usuários ativos, `share_*`/convites no Analytics | Console Firebase > Analytics, ou contagem de documentos em trips/members |
| Divisão de despesas, comentários, anexos, PDF e planilha são usados | contagem dos eventos `attachments_opened`, `feedback_*`, `document_added` etc. (já instrumentados, allowlist em analytics.js) | Relatório de eventos; DebugView só confirma que disparam |
| Login por celular é usado | eventos de login por método | Firebase Auth > Usuários (provedores) |
| Existe edição simultânea que perde dados | relato de usuário ou log | 3 entrevistas do roteiro T-1.4 |
| Coordenar e controlar custo são as dores reais | falas espontâneas em 3 de 5 sessões | Parte A do roteiro T-1.4 (mínimo 3 entrevistas, incluindo 1 não usuário) |
| Feedback in-app recebido | documentos na coleção `feedback` | Console Firestore |

## Sinais que justificariam evoluir
- Um segundo grupo (fora do círculo do autor) usando sem ajuda.
- Pedido concreto e repetido (por exemplo, convite sem WhatsApp) vindo de pessoa que não é o autor.
- N viagens ativas por mês acima de zero, com 2 ou mais membros editando.
- Relato de perda de dado por edição simultânea.
- [RECOMENDAÇÃO] Fixar N antes, por exemplo 3 viagens ativas com 2 ou mais pessoas em 30 dias, a confirmar com o usuário.

## Próximo incremento mínimo
[RECOMENDAÇÃO] Se "evoluir" for mantido, o incremento é registrar o problema, ler o Analytics e fazer 3 entrevistas do T-1.4 com pelo menos 1 não usuário, antes de qualquer funcionalidade.

## Não verificado
- Resultado do E2E e do CI (tema de outro parecer).
- Dados de Analytics, Firestore (`feedback`, `trips`) e Console Firebase: sem acesso.
- Se Resumo/Checklist têm lógica equivalente em Mais.jsx (só confirmei ausência de import dos arquivos de screens/).
- Se `leaflet` e `geocode.js` entram no bundle de produção (comando: `npm run build` e inspecionar `dist/assets`).
- Se o plano Blaze está ativo; se as listas "Testar na prévia" foram executadas; conteúdo dos documentos ausentes.
- Não li o código-fonte além dos greps citados nem validei os números de testes.
