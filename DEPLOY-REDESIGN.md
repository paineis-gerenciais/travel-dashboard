# Guia de implantação — Redesign completo (Fases R1 a R5)

Esta é a maior mudança visível desde a migração para React. **A navegação
inteira muda**: de 11 abas para 5 destinos. Ninguém que usa o app vai abrir e
encontrar a mesma coisa — avise quem compartilha as viagens antes de publicar.

O que **não** mudou (de propósito): o modelo de dados, as regras do Firestore,
a matemática de custos, o tempo real, a presença, os convites. Os 33 testes de
domínio continuam verdes e os custos são idênticos ao centavo.

## O que mudou, na prática

**Navegação: 5 destinos.**

| Destino | O que faz |
|---|---|
| **Dias** | A tela de trabalho. Um cartão por dia: transporte, hospedagem, refeições, atrações e despesas — tudo editável ali, sem trocar de tela. Swipe entre dias no celular. |
| **Cidades** | O esqueleto: cidades, datas, hospedagem, café da manhã, validação de cobertura. |
| **Mapa** | Rotas por dia, editáveis, abertas no Google Maps. |
| **Custos** | Modo orçamento: totais, distribuição, status — e os **relatórios** por categoria (Transporte, Alimentação, Atrações, Outras, Roteiro), agora como consulta. |
| **Mais** | Resumo, atividade recente, checklist, compartilhar, versões, tema, imprimir, exportar/importar, diagnóstico, trocar de viagem, sair, limpar. |

**Inventário: onde foi parar cada coisa** (nada sumiu)

- Resumo → **Mais** (métricas no topo)
- Roteiro → **Dias** (edição) e **Custos › Relatórios › Roteiro por dia** (leitura)
- Transporte, Alimentação, Atrações, Outras → **Dias** (edição) e **Custos › Relatórios** (leitura)
- Checklist → **Mais › Checklist**
- Compartilhar, Versões, Exportar, Importar, Imprimir, Diagnóstico, Tema, Sair, Limpar, Minhas viagens → **Mais**
- Por dia (beta) → virou **Dias** (deixou de ser beta; o segundo paradigma de navegação acabou)

**Aparência:** paleta única com um acento (os 10 temas por seção e a alternância
Colorido/Minimalista foram aposentados), tipografia em 5 tamanhos e 2 pesos,
componentes canônicos (`Row`, `Chip`, `Sheet`, `Banner`, `EmptyState`).

**Mobile:** zero tabelas — cada item é uma linha desenhada, não uma `<tr>`
reformatada por CSS. Modais viraram bottom sheets. Alvos de 44px. Campos com
16px (evita o zoom automático do iOS). Nada rola horizontalmente.

## Passos

```bash
git checkout main && git pull
git checkout -b redesign
npm install
npm test          # 33 testes de domínio — devem passar
npm run build     # limpo
```

```bash
git add -A        # -A é importante: há arquivos REMOVIDOS nesta fase
git commit -m "Redesign completo: 5 destinos, paleta unica, mobile-first"
git push -u origin redesign
```

Abra o PR e teste **na prévia**.

> **Sem deploy de regras.** O redesign não toca `firestore.rules`. (Se você
> ainda não publicou as regras da Fase 5 estrutural — comentários e atividade —
> aí sim precisa rodar `firebase deploy --only firestore:rules` antes.)

## Testar na prévia — critérios de aceite

No **celular real** (é onde o redesign se prova):

- [ ] A barra inferior mostra **5 destinos**, todos visíveis, sem rolar.
- [ ] **Nenhuma tela rola horizontalmente.**
- [ ] Montar um dia completo (transporte + refeição + atração) **sem sair de Dias**.
- [ ] Swipe entre dias: o cartão acompanha o dedo e desliza ao soltar.
- [ ] Toques confortáveis (nada minúsculo); ao tocar num campo de dinheiro, a
      tela **não dá zoom**.
- [ ] Editar um item abre uma folha que sobe de baixo, fechável tocando fora,
      arrastando ou no ✕.

No **desktop**:

- [ ] Os 5 destinos aparecem no topo (não embaixo).
- [ ] Tudo continua funcionando; nenhuma ação do menu antigo sumiu (confira o
      inventário acima).

**Funcional (não pode ter regredido):**

- [ ] Custos idênticos aos de antes — confira o total de uma viagem real.
- [ ] Cancelado continua fora do total.
- [ ] Tempo real entre duas contas; presença aparece no cabeçalho.
- [ ] Comentários e atividade recente funcionam.
- [ ] Versões: salvar, sobrescrever, carregar, excluir.
- [ ] F5 mantém o destino em que você estava.

## Notas

- **Relatórios são leitura, não edição.** Isso é intencional: a edição mora em
  Dias (itens do dia) e Cidades (o esqueleto). Se sentir falta de editar direto
  no relatório, é um ajuste pequeno — mas experimente primeiro; a separação
  entre "montar" e "consultar" é metade do ganho de clareza.
- **O arco-íris foi aposentado.** Se a perda de identidade incomodar, o
  meio-termo previsto no plano é cor **por cidade** (informação), não por seção
  (decoração) — dá para acrescentar depois sem desfazer nada.
- **Dívida quitada.** O CSS caiu de 15,2 kB para 10,7 kB e o código do app de
  48 kB para 34 kB, mesmo com mais funcionalidade — porque a Fase R5 (limpeza)
  foi feita junto, não adiada. Não deixe reintroduzirem o CSS antigo por engano
  ao extrair um zip velho por cima.
