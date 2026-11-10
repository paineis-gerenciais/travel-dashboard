# Custos estimados da IA no travel-dashboard

- **Data:** 2026-11-09 · **Situação:** estimativa. Nenhuma chamada real à API foi feita: esta sessão não tem chave.
- **Fontes:** preços oficiais em https://platform.claude.com/docs/en/about-claude/pricing e busca na web a US$ 10 por mil buscas em https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool, ambos consultados em 2026-11-09. Dólar: PTAX de venda do Banco Central em 2026-11-09, R$ 5,5146.
- **Custo de quem:** de cada pessoa que cadastrar a própria chave. O valor central é o mais provável; a faixa vai do cenário baixo ao alto.

## Resultado

| Uso | Claude Opus 5.5 | Claude Sonnet 5.5 | Claude Haiku 5.5 |
|---|---|---|---|
| Lançar um gasto por frase | US$ 0,01 (R$ 0,06); faixa US$ 0,0066 a 0,02 | US$ 0,0050 (R$ 0,03); faixa US$ 0,0033 a 0,0077 | US$ 0,0002 (R$ 0,0011); faixa US$ 0,0002 a 0,0003 |
| Pesquisar um dia de roteiro, com busca na web | US$ 0,27 (R$ 1,48); faixa US$ 0,09 a 1,11 | US$ 0,16 (R$ 0,86); faixa US$ 0,06 a 0,59 | US$ 0,06 (R$ 0,30); faixa US$ 0,03 a 0,10 |
| Organizador, por viagem | US$ 3,56 (R$ 19,65); faixa US$ 1,40 a 13,61 | US$ 2,02 (R$ 11,15); faixa US$ 0,90 a 7,20 | US$ 0,67 (R$ 3,67); faixa US$ 0,42 a 1,30 |
| Participante, por viagem | US$ 0,33 (R$ 1,83); faixa US$ 0,20 a 0,52 | US$ 0,15 (R$ 0,83); faixa US$ 0,10 a 0,23 | US$ 0,0061 (R$ 0,03); faixa US$ 0,0050 a 0,01 |
| Organizador, por ano | US$ 10,69 (R$ 58,96); faixa US$ 4,19 a 40,83 | US$ 6,07 (R$ 33,45); faixa US$ 2,69 a 21,60 | US$ 2,00 (R$ 11,00); faixa US$ 1,27 a 3,90 |
| Grupo de 4, por ano, todos usando IA | US$ 13,68 (R$ 75,44); faixa US$ 5,97 a 45,55 | US$ 7,42 (R$ 40,94); faixa US$ 3,59 a 23,69 | US$ 2,05 (R$ 11,30); faixa US$ 1,31 a 3,99 |

Leitura rápida:
- **Lançar por frase custa centavos em qualquer modelo.** No Opus 5.5, 30 lançamentos numa viagem custam cerca de R$ 1,83.
- **A pesquisa de roteiro concentra o custo.** O que mais pesa são as buscas na web e o texto que elas trazem, não o modelo.
- **Só quem pesquisa precisa de chave.** Participantes podem lançar gastos pelas regras locais, sem IA e sem custo; a IA fica para quem quiser.

## Como foi calculado

1. **Pedidos reais.** Os textos que o app mandaria estão nesta pasta: instruções (`sistema-frase.txt`, `sistema-roteiro.txt`), formato de resposta (`esquema-*.json`), contexto de exemplo (`contexto-*.txt`) e uma resposta típica (`saida-*.json`). O tamanho foi medido em caracteres.
2. **Tokens.** `[HIPÓTESE]` 2,6 caracteres por token no cenário central (2,2 a 3,2). O tokenizador dos modelos 4.7 em diante gera cerca de 30% mais tokens que o anterior, segundo a página de preços. Com uma chave, a contagem exata sai do serviço de contagem de tokens da API.
3. **Raciocínio.** Os modelos atuais pensam antes de responder, e esse raciocínio é cobrado como saída. Faixas usadas: lançamento por frase de 0 a 400 tokens; pesquisa de roteiro de 300 a 3.000.
4. **Busca na web.** `[HIPÓTESE]` De 3 a 8 buscas por pedido (central 5), com 1.500 a 6.000 tokens de resultado por busca (central 3.500). O exemplo da documentação mostra uma busca com 6.039 tokens de entrada. A cada etapa o modelo relê o que já acumulou, então buscas em sequência custam mais que buscas em paralelo. O cenário alto supõe 8 buscas em sequência, sem filtragem.
5. **Uso.** `[HIPÓTESE]` Por viagem: 10 dias pesquisados, 5 ajustes com metade das buscas, 30 lançamentos por frase por pessoa. Por ano: 3 viagens, grupo de 4. O script `estima.py` refaz a conta com outros números.

## O que muda o custo

| Alavanca | Efeito |
|---|---|
| Limite de buscas por pedido | Maior efeito na pesquisa de roteiro: com as demais premissas centrais, passar de 8 para 3 buscas leva o custo de US$ 0,45 para US$ 0,16 por dia pesquisado no Opus 5.5, cerca de um terço |
| Modelo | Na pesquisa, Sonnet 5.5 custa cerca de 60% do Opus 5.5 e Haiku 5.5 cerca de 20%; no lançamento por frase a diferença é de centavos |
| Filtragem dinâmica dos resultados | Disponível nos modelos atuais; aproxima o custo do cenário baixo |
| Cache do início do pedido | Ganho pequeno: as instruções do lançamento por frase têm cerca de 900 tokens, acima do mínimo de 512 para cache |

## Não incluído

- IOF e taxa do cartão na compra de créditos em dólar.
- Créditos gratuitos que contas novas recebem para testar a API.
- Inferência restrita aos Estados Unidos, que custa 1,1 vez mais; o app não precisa dela.

## Como medir de verdade

Com a chave de alguém e sua autorização, um teste de 10 lançamentos e 5 pesquisas de roteiro no Opus 5.5 custa cerca de US$ 1,45, e no máximo US$ 5,71. Cada resposta traz os tokens de entrada e de saída e o número de buscas, o que substitui as hipóteses dos itens 2 a 4.
