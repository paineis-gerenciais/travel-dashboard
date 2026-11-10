# QA no navegador: PR #37 (issue #17), achado R2 (token com `email_verified` desatualizado)

Data: 2026-11-10. Commit `fb91011` (branch `fix/17-regras-convite-acesso`). Ambiente: emuladores Auth e Firestore (projeto `demo-fake`), build com `VITE_USE_EMULATORS=true`, `vite preview` na 4173, Chromium (Playwright) desktop 1280x900, dois ou três contextos isolados (dono, convidado 1, convidado 2). Dados: `@exemplo.com`, senha fixa de teste.

## Como reproduzir
Dentro de `<raiz-do-repositório>`:
`npx firebase emulators:exec --project demo-fake --only firestore,auth "./run.sh"`
Scripts: `qa37/run.sh` (build em pasta própria, preview, roda o teste) e `qa37/qa37.mjs`. Saídas: `qa37/saida.log` (código do PR) e `qa37/saida-controle.log` (controle sem a correção). Capturas em `qa37/shots/`.

## Resultado por cenário (código do PR, saída 0)
| # | Esperado | Obtido | Resultado |
|---|---|---|---|
| 1 | Dono cria viagem e convida 2 e-mails | 2 convites `pendente` (lidos pela REST do emulador) | OK |
| 2 | Cadastro pela tela ("Criar uma conta"): banner "Confirme seu e-mail para aceitar convites"; viagem ausente | Banner visível; viagem ausente após 2,5 s; convite segue `pendente` | OK |
| 3a | "Já confirmei" antes de confirmar: "Ainda não consta como confirmado." | Aviso exibido; viagem ausente | OK |
| 3 | Confirma pela API; "Já confirmei": viagem aparece sem novo login; convite `aceito` | Viagem na mesma sessão; banner some; convite `aceito`; dono vê o convidado em "Com acesso" | OK |
| 4 | Convidado 2 confirma e dá F5: viagem aparece sem novo login | Antes do F5: ausente (nada acontece sozinho). Depois: viagem visível, sem tela de login, convite `aceito`. Sonda no IndexedDB: claim `email_verified` false antes do F5 e true depois (token renovado) | OK |
| 5 | Dono remove: viagem some e não volta | Some ao vivo, sem recarregar; ausente após 2 F5; convite apagado e `memberUids` sem o convidado | OK |
| 6a | Reenviar | Aviso "Enviamos o link para o seu e-mail."; códigos VERIFY_EMAIL 1 -> 2 | OK |
| 6b | "Membro sem perfil" | Com o doc `members/<uid>` apagado (REST admin), a linha mostra "Membro sem perfil" + Editor + Remover | OK (ver ressalva) |

## Controle negativo (prova que o teste discrimina)
Cópia do código em `qa37/` sem o bloco de renovação de `acceptPendingInvites` (só essa mudança; confirmado por `diff` e por `grep` do texto "Falha ao renovar o token" ausente no bundle). Resultado: C4 FALHOU (viagem não aparece após F5; claim ainda false). Logo, a renovação em `tripData.js` é necessária para o cenário 4 e funciona. O cenário 3 passa mesmo sem ela, porque "Já confirmei" já chama `getIdToken(true)`.
Nota de processo: uma primeira tentativa do controle foi INVÁLIDA (um `vite preview` órfão da rodada anterior ainda servia o build com a correção na 4173). Descartada; o script agora inicia o binário do vite direto e o encerra. O órfão foi encerrado.

## Evidência da API do emulador
`GET http://127.0.0.1:9099/emulator/v1/projects/demo-fake/oobCodes` devolveu, por convidado, itens `{email, requestType: "VERIFY_EMAIL", oobCode, oobLink}` (tokens redigidos no log). `GET oobLink` -> HTTP 200 e a conta passou a `emailVerified=true`.

## Ressalvas
- C6b falhou 1 vez em 5 execuções (a primeira); passou nas 4 seguintes (no primeiro script a espera após reabrir a folha era menor). Causa não isolada; [HIPÓTESE] corrida entre a atualização da lista de membros e a leitura do teste. Defeito de teste ou de tela não comprovado; vale repetir.
- "Membro sem perfil" foi forçado apagando o doc de membro como admin; o caminho real que o produz (falha entre o lote e o `setDoc` de membro) não foi exercitado.
- Só desktop (1280 px); sem acessibilidade nem responsividade (fora do pedido). Não testado: produção, SMS/Google, expiração real do token (1 h), segunda aba aberta durante a confirmação.
- Emulador, não produção: o backend real pode se comportar diferente quanto ao token.

## Veredito: CONFIRMADO
Conta de e-mail e senha confirmada passa a ter o convite aceito sem novo login, tanto por "Já confirmei" quanto por recarregar a página; o controle sem a correção reprova o F5. Defeitos novos: 0.

## Limpeza
`git -C <worktree> status -s` vazio; portas 8080, 9099, 4000, 4400, 4500, 9150 e 4173 livres ao final; removidos `qa37/ctrl`, `dist`, `dist-ctrl` e logs de build criados por mim.
