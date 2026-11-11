# Revisão de segurança do PR #37 (issue #17)

Rastro das duas rodadas de revisão cruzada do devsecops-engineer. Tudo roda só no emulador local, com contas e e-mails fictícios (`@exemplo.com`).

| Arquivo | O que é |
|---|---|
| `revisao-v1.md` | 1ª rodada (commits `f235fba` e `2e915ac`): **reprovado**, com R1 alto (removido volta sozinho) e R2 a R5 |
| `revisao-v2.md` | 2ª rodada (commit `3daaef7`, que corrige R1 a R5): **aprovado com ressalvas** |
| `provas.cjs`, `saida.txt` | Cenários da 1ª rodada, contra as regras daquele momento (`firestore.regras-1a-rodada.rules`) |
| `proposta.cjs`, `saida-proposta.txt`, `firestore.proposta.rules` | Correção proposta na 1ª rodada e a prova de que ela fecha R1 e R4 |
| `provas-v2.cjs`, `saida-v2.txt` | Cenários da 2ª rodada (38 de 38 conforme o esperado), contra `firestore.v2.rules` |
| `proposta-v2.cjs`, `saida-proposta-v2.txt` | Q1 a Q6 contra as regras do branch (6 de 6) |

`firestore.v2.rules` é igual ao `firestore.rules` do commit `3daaef7`, menos 3 linhas de comentário. As linhas citadas em `revisao-v1.md` são as das regras da 1ª rodada.

## Como rodar de novo
Os scripts foram escritos para um emulador avulso na porta 8282. Para usar o emulador do projeto (porta 8080 em `firebase.json`), troque `port: 8282` por `port: 8080` numa cópia do script dentro desta pasta e rode, da raiz do repositório, com Java 21:

```bash
npx firebase emulators:exec --only firestore --project demo-rev37 "node docs/prumo/revisao-pr-37/<copia>.cjs"
```

Reexecução do Head em 2026-11-10, com `provas-v2.cjs` nesse esquema: `TOTAL 38 | conforme esperado 38 | divergentes 0`.

## Verificação no navegador (2026-11-10, depois do merge)
`navegador/`: o qa-engineer testou com os emuladores, no commit `fb91011` (o PR combinado com o `main`), o único ponto que as revisões deixaram sem execução (R2). Uma conta de e-mail e senha, depois de confirmar o e-mail, tem o convite aceito **sem novo login**, tanto pelo botão "Já confirmei" quanto recarregando a página. Numa cópia sem a renovação do token, a recarga falha: a correção é necessária. Cenários C1 a C6b passaram e não houve defeito novo. Relatório em `navegador/relatorio.md`, script em `navegador/qa37.mjs`, saídas em `navegador/saida*.log` (códigos do emulador redigidos) e 11 capturas em `navegador/capturas/`, com contas fictícias.
