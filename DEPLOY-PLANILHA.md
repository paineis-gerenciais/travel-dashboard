# Guia de implantação — Planilha (corrigido) + mudança de pasta (OneDrive → C:)

Este guia substitui o `DEPLOY-PLANILHA.md` anterior: mesmo recurso, com um bug
de teste corrigido (que revelou um problema real de acessibilidade), e um
passo a passo à parte para tirar o projeto da pasta do OneDrive.

---

## Parte 1 — O erro do E2E, corrigido

### O que aconteceu

O teste tentava abrir a tela de Planilha clicando no **4º botão "Abrir →"** da
tela Mais (`.nth(3)`). Mas a tela Mais tem **sete** botões com esse mesmo texto
— um por linha (Checklist, Anexos, Compartilhar, Versões salvas, Planilha,
Diagnóstico, Enviar feedback) — e a posição da "Planilha" é a **5ª** (índice 4),
não a 4ª. O teste clicava em "Versões salvas" por engano, o diálogo "Planilha"
nunca abria, e o teste expirava esperando por ele.

### Por que não foi só o teste

Sete botões com o **mesmo nome acessível** ("Abrir →") é um problema real de
acessibilidade, não só uma fragilidade de teste: quem usa leitor de tela ouve
"Abrir, Abrir, Abrir…" sete vezes seguidas, sem informação de qual linha é
qual. Um índice de posição (`.nth()`) é sintoma do mesmo problema visto do lado
do teste — ele quebra silenciosamente toda vez que uma linha nova entra antes
dele na tela, que foi exatamente o que aconteceu quando "Anexos" ganhou linha
própria numa leva anterior.

### A correção

Cada botão "Abrir →" da tela Mais ganhou um `aria-label` específico ("Abrir
Checklist", "Abrir Anexos", "Abrir Planilha", etc.) — o texto visível continua
"Abrir →", mas agora cada um tem um nome acessível único. O teste passou a usar
esse nome em vez de posição:

```js
await page.getByRole('button', { name: 'Abrir Planilha' }).click();
```

Isso corrige a acessibilidade **e** deixa o teste imune a novas linhas serem
adicionadas antes dele no futuro.

### Passos

```bash
git checkout main && git pull
git checkout -b fix-planilha-a11y
npm install

npm test             # 111 testes de domínio
npm run build
npm run test:e2e     # 18 testes — todos devem passar agora
```

```bash
git add -A
git commit -m "Corrige selecao ambigua de botoes Abrir na tela Mais (a11y + E2E)"
git push -u origin fix-planilha-a11y
```

> Sem deploy de regras.

### Testar na prévia

- [ ] Rodar `npm run test:e2e` → 18 testes verdes (eram 16 + 2 falhando).
- [ ] Com um leitor de tela (ou o inspetor de acessibilidade do navegador),
      confirmar que cada botão "Abrir →" da tela Mais anuncia a linha
      correspondente.

---

## Parte 1B — Segundo erro do E2E, também corrigido

Depois da correção acima, o diálogo "Planilha" passou a abrir certo, mas o
teste ainda falhava — desta vez num ponto mais adiante, ao conferir que o item
importado apareceu na tela Dias.

### O que aconteceu

```
Locator:  getByText('Machu Picchu')
Expected: visible
Received: hidden
```

O Playwright **encontrou** o texto no DOM, mas ele estava **oculto**. A causa:
a tela Dias mostra **um dia por vez**. A viagem do teste é inteiramente futura
(datas em 2030), então ela abre no **primeiro dia** (check-in, 01/12) — a
atração importada foi criada para o **dia seguinte** (02/12), fora da tela
visível.

A única ocorrência de "Machu Picchu" que sobrou no DOM foi a do `PrintView` —
o componente que monta a viagem inteira para a versão de impressão, e que fica
sempre presente na página, oculto por `display:none` até a hora de imprimir.
O Playwright reportou corretamente: o texto existe, mas está escondido.

### A correção

O teste passou a avançar um dia (`Próximo →`) antes de conferir o item, para
chegar ao dia onde ele de fato está:

```js
await page.getByRole('button', { name: 'Dias' }).click();
await page.getByRole('button', { name: /próximo/i }).click(); // vai para o dia da atração
await expect(page.getByText('Machu Picchu')).toBeVisible();
```

Nada no app mudou — nem no domínio, nem na interface. Foi só o teste que
precisava navegar até onde o dado realmente aparece, em vez de assumir que
qualquer dia serve.

### Passos (substituem os da Parte 1)

```bash
git checkout main && git pull
git checkout -b fix-planilha-a11y
npm install

npm test             # 111 testes de domínio
npm run build
npm run test:e2e     # 18 testes — todos devem passar agora, incluindo o de planilha
```

```bash
git add -A
git commit -m "Corrige selecao ambigua de botoes Abrir (a11y) e navegacao de dia no teste da planilha"
git push -u origin fix-planilha-a11y
```

---

## Parte 1C — Terceiro erro do E2E, também corrigido

A correção da Parte 1B levou o teste ao dia certo — "Machu Picchu" passou a
estar **visível de verdade**. Mas aí apareceu um terceiro erro, do mesmo tipo
que já tinha acontecido antes em outro teste (com "Hospedagem"):

```
strict mode violation: getByText('Machu Picchu') resolved to 2 elements:
  1) <span class="row-title">Machu Picchu</span>  ← a tela Dias, visível
  2) <b>Machu Picchu</b>                          ← dentro do PrintView, oculto
```

### A causa, de novo

O `PrintView` monta a viagem **inteira** o tempo todo, escondido por CSS até a
hora de imprimir — não é criado sob demanda. Qualquer busca por texto sem
escopo encontra as duas cópias: a real, na tela, e a duplicata oculta do
PrintView. O modo estrito do Playwright recusa essa ambiguidade em vez de
adivinhar qual você quis dizer.

### A correção

A asserção passou a escopar ao `<main>`, que exclui o PrintView (ele fica fora,
como irmão do `<main>` no `App.jsx`):

```js
const tela = page.getByRole('main');
await expect(tela.getByText('Machu Picchu')).toBeVisible();
```

A checagem de ausência (`'Linha ruim'`) continua **sem** escopo de propósito —
ali o objetivo é confirmar que o texto não existe em lugar nenhum, nem mesmo
na cópia oculta.

**Reforço adicional:** o `PrintView` ganhou `aria-hidden="true"` (correção de
acessibilidade genuína — o leitor de tela não deve anunciar um conteúdo
duplicado e invisível) e `data-testid="print-view"`, para futuros testes
poderem excluí-lo explicitamente se precisarem de outra estratégia de busca.

### Passos (substituem os anteriores)

```bash
git checkout main && git pull
git checkout -b fix-planilha-a11y
npm install

npm test             # 111 testes de domínio
npm run build
npm run test:e2e     # 18 testes — os 18 devem passar agora
```

```bash
git add -A
git commit -m "Corrige a11y dos botoes Abrir, navegacao de dia e ambiguidade com o PrintView nos testes"
git push -u origin fix-planilha-a11y
```

> **Se surgir um quarto erro parecido em outro teste** (texto encontrado só no
> PrintView, ou "resolved to N elements" citando um `<b>`/`<p>` genérico), a
> causa é a mesma: escopar a busca com `page.getByRole('main')` antes do
> `getByText`.

---

## Parte 2 — Mudar o projeto da pasta do OneDrive para C:\

Seu caminho atual é
`C:\Users\danie\OneDrive\Documentos\Projetos\APPs\Plano de Viagens\travel-dashboard`.
Isso significa que o **OneDrive está sincronizando `node_modules`** — dezenas de
milhares de arquivos pequenos — o que é a causa mais comum de lentidão,
travamentos (`EBUSY`, `EPERM`) durante `npm install`/`npm run build` no Windows,
e às vezes de o Playwright ou o emulador do Firebase falharem ao escrever
arquivos temporários porque o OneDrive os está bloqueando para sincronizar.

### ⚠️ Armadilha a evitar antes de escolher o novo caminho

Se o **Backup de Pastas Conhecidas** do OneDrive estiver ativo, ele redireciona
`Documentos`, `Área de Trabalho` e `Imagens` do seu usuário para dentro do
OneDrive **automaticamente** — é exatamente por isso que o caminho atual tem
`OneDrive\Documentos` no meio. Se você mover o projeto para
`C:\Users\danie\Documents\...`, ele pode acabar **de volta** dentro do OneDrive
sem você perceber.

**Use um caminho fora de qualquer pasta gerenciada pelo OneDrive**, por exemplo:

```
C:\Dev\travel-dashboard
```
ou
```
C:\Projetos\travel-dashboard
```

Depois de mover, confirme no Explorador de Arquivos que a pasta **não** tem o
ícone de sincronização do OneDrive (as setinhas verdes/azuis) — se tiver, o
caminho escolhido ainda está dentro de uma pasta sincronizada.

### Passo a passo

**1. Feche tudo que estiver usando a pasta:** editor de código, terminais
abertos nela, `npm run dev`/`preview` rodando, emuladores do Firebase.

**2. Confirme que não há mudanças não salvas:**
```cmd
cd "C:\Users\danie\OneDrive\Documentos\Projetos\APPs\Plano de Viagens\travel-dashboard"
git status
```
Se houver algo pendente, faça commit ou stash antes de continuar — mover a
pasta não perde o histórico do Git, mas é mais seguro partir de uma árvore
limpa.

**3. Crie a pasta de destino e mova o projeto** (fora do OneDrive, ver aviso
acima):
```cmd
mkdir C:\Dev
robocopy "C:\Users\danie\OneDrive\Documentos\Projetos\APPs\Plano de Viagens\travel-dashboard" "C:\Dev\travel-dashboard" /E /XD node_modules dist dev-dist playwright-report test-results
```
`robocopy` lida melhor que um simples "recortar e colar" com nomes de arquivo
longos (problema comum de caminho do Windows, e o caminho antigo já era fundo).
O `/XD` exclui as pastas geradas — elas serão recriadas do zero no destino, o
que é mais seguro do que copiá-las (podem ter referências ao caminho antigo).

**4. Confirme que o `.git` foi copiado** (o `robocopy` copia pastas ocultas por
padrão, mas vale conferir):
```cmd
cd C:\Dev\travel-dashboard
dir /a:h
git status
git remote -v
```
Se `git remote -v` mostrar a URL do repositório normalmente, o histórico está
intacto — o Git não guarda o caminho absoluto da pasta dentro do repositório.

**5. Reinstale as dependências do zero** (não copie `node_modules`; alguns
pacotes gravam caminhos absolutos durante a instalação):
```cmd
npm install
npx playwright install chromium
```

**6. Confirme que o Firebase CLI continua funcionando** (o login é global, não
por pasta; o projeto associado vive no arquivo `.firebaserc`, que foi copiado
junto):
```cmd
firebase projects:list
firebase use
```

**7. Rode a suíte completa a partir do novo local:**
```cmd
npm test
npm run build
npm run test:rules
npm run test:e2e
```

**8. Só depois de tudo passar, apague a pasta antiga:**
```cmd
rmdir /s /q "C:\Users\danie\OneDrive\Documentos\Projetos\APPs\Plano de Viagens\travel-dashboard"
```

**9. Ajustes de conforto (opcionais, mas recomendados):**
- Se usa VS Code, abra a pasta nova (`code C:\Dev\travel-dashboard`) para
  atualizar os "recentes"; a antiga pode ser removida da lista.
- Adicione `C:\Dev\travel-dashboard` às exclusões do **Windows Defender**
  (Configurações → Privacidade e segurança → Segurança do Windows → Proteção
  contra vírus → Exclusões) — antivírus escaneando `node_modules` a cada
  `npm install` é a segunda causa mais comum de lentidão no Windows, depois do
  próprio OneDrive.
- Se havia atalhos ou scripts (`.bat`, atalhos na área de trabalho) apontando
  para o caminho antigo, atualize-os.

### Por que isso ajuda de verdade

- **Sem sincronização de `node_modules`**: instalações e builds deixam de
  competir com o OneDrive por acesso a arquivo.
- **Caminho mais curto**: `C:\Dev\travel-dashboard\...` tem bem menos
  caracteres que o caminho anterior, reduzindo o risco de erros de caminho
  longo do Windows — relevante porque `node_modules` tem subpastas profundas.
- **Emulador e Playwright escrevem logs e caches temporários** durante os
  testes; fora do OneDrive, nada tenta sincronizar esses arquivos no meio da
  execução.

Nada no código do projeto depende do caminho onde ele vive — `firebase.json`,
`vite.config.js` e os testes usam caminhos relativos. A mudança de pasta é
inteiramente segura nesse sentido.
