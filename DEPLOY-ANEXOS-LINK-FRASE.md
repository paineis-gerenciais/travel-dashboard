# Guia de implantação — Anexos por link e frase da viagem

Implementa o **Caminho A** do `plano_anexos_v1.md` (anexos como links externos)
e a **opção 3** do micro-item da frase inspiradora.

**Não muda regras do Firestore. Não adiciona dependência nova. Não exige plano
Blaze.**

---

## 1. Anexos por link (Caminho A)

O app não hospeda arquivo: guarda o endereço de onde o documento já vive (Drive,
e-mail, Dropbox) e dá o contexto — a que dia e a que item aquele comprovante
pertence.

### O que entra

- **Campo "Link do comprovante"** no editor de transporte, refeição, atração,
  outra despesa, **hospedagem** e **item do checklist**.
- **Só `https`.** Colar sem protocolo assume `https://`; colar `http://` é
  **promovido** para `https://`, nunca o contrário. Endereço inválido mostra
  erro antes de salvar.
- **Rótulo opcional** ("Voucher", "Passagem"). Vazio, usa o domínio de origem
  (ex.: `drive.google.com`).
- **Clipe 📎 na linha do item**, que abre o documento direto, sem passar pelo
  editor.
- **Central de anexos** (ícone 📎 no cabeçalho e linha em *Mais*), espelhando a
  central de mensagens: reúne tudo, mostra a origem de cada anexo e tem
  **"ir para o item"** — reaproveitando o mesmo mecanismo de navegação.
- **Documentos da viagem**: links que não pertencem a nenhum dia
  (seguro-viagem, passaporte, apólice), gerenciáveis dentro da central e
  exibidos no topo.
- **No PDF exportado**: os endereços aparecem junto de cada item e numa seção
  "Comprovantes e documentos" ao final.
- **Aviso de conteúdo externo** ao lado do link: o arquivo fica onde você o
  guardou, e quem compartilha a viagem precisa ter acesso àquele link também.

### Limitações — assumidas de propósito

- O arquivo **não está no app**: se o link quebrar ou a permissão mudar, o app
  não tem como saber (não baixamos o arquivo para verificar).
- O app **não concede acesso** ao documento — só mostra o endereço.
- Sem miniatura nem pré-visualização.

> Guardar arquivos de verdade exige Cloud Storage, que desde 3/2/2026 requer o
> plano Blaze. É o **Caminho B** do `plano_anexos_v1.md`, e continua uma decisão
> em aberto. Quando/se for feito, **estes links continuam funcionando** — a
> migração é aditiva, não substitutiva.

---

## 2. Frase da viagem (opção 3)

Uma frase inspiradora aparece como **primeiro bloco do conteúdo rolável** da
tela Dias — fora da faixa fixa.

**A faixa do cabeçalho não mudou de altura**, que era a restrição do pedido. O
`appbar-title` continua com o mesmo `h1` e a mesma linha secundária.

**Por que fora do cabeçalho:** a linha secundária da faixa carrega o indicador
**"Salvo / Salvando…"** — retorno em tempo real sobre integridade de dados. Num
app colaborativo, saber que o que você digitou já foi salvo é funcional, não
decorativo. Alternar isso com uma frase (opção 1) ou substituí-lo (opção 2)
trocaria segurança por enfeite. Somado à regra do app-shell — tudo que cresce no
cabeçalho é altura que o `<main>` perde em **todas** as telas, para sempre — a
opção 3 foi a única que passou no crivo de simplicidade.

**A frase é estável por viagem**, derivada do id: aquela viagem sempre mostra
"aquela" frase, em vez de sortear a cada abertura. Isso evita o efeito "roleta",
que faz o elemento parecer aleatório em vez de intencional. É o mesmo padrão do
`cityColorIndex`, que deriva cor estável do nome da cidade.

> Se preferir **sortear a cada visita**, é uma linha: trocar `quoteForTrip(tripId)`
> por `useState(randomQuote)` no componente `TripQuote` (`Dias.jsx`).

A frase some na impressão.

---

## 3. Passos

```bash
git checkout main && git pull
git checkout -b anexos-link-frase
npm install

npm test             # 93 testes de domínio (eram 84)
npm run build
npm run test:e2e     # 14 testes (eram 12)
```

```bash
git add -A
git commit -m "Anexos por link externo, central de anexos e frase da viagem"
git push -u origin anexos-link-frase
```

> Sem `firebase deploy --only firestore:rules` — nenhuma regra mudou. Os campos
> novos (`link` nos itens e `settings.documents`) trafegam sem alteração de
> regra.

---

## 4. Testar na prévia

**Anexos:**
- [ ] Editar uma atração, colar `drive.google.com/algo` (sem `https://`) → é
      salvo como `https://…`.
- [ ] Colar um texto que não é link → erro claro, nada é salvo.
- [ ] Deixar o rótulo vazio → a central mostra o domínio de origem.
- [ ] O clipe 📎 aparece na linha do item e abre o documento em nova aba.
- [ ] Anexar link também na **hospedagem** (tela Cidades) e num item do
      **checklist**.
- [ ] Abrir a central pelo 📎 do cabeçalho: todos aparecem, agrupados, com os
      documentos gerais no topo.
- [ ] **"Ir para o item"** leva ao dia certo com o item destacado.
- [ ] Cadastrar um documento geral (seguro-viagem) e removê-lo.
- [ ] Exportar o PDF: os endereços aparecem junto dos itens e na seção final.

**Frase:**
- [ ] Abrir uma viagem → a frase aparece no topo da tela Dias e **some ao rolar**.
- [ ] A faixa do título **continua com a mesma altura** de antes.
- [ ] Sair da tela e voltar → **a mesma frase** (é estável por viagem).
- [ ] Abrir **outra viagem** → frase diferente.
- [ ] No PDF, a frase **não** aparece.

---

## 5. Notas

- **93 testes de domínio** (eram 84): validação de link, normalização, rótulo
  por domínio, coleta e ordenação dos anexos, e estabilidade da frase por
  viagem.
- **14 E2E** (eram 12): anexar link e vê-lo na central; frase visível e estável
  ao trocar de tela.
- Os eventos de analytics novos (`attachments_opened`, `attachment_opened`,
  `attachment_navigated_to_item`, `document_added`) seguem a allowlist de
  privacidade — nenhum endereço de documento é enviado, só a categoria.
