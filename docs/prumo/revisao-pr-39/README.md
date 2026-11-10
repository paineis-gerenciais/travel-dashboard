# Revisões do PR #39 (issue #25)

| Arquivo | O que é |
|---|---|
| `qa.md` | qa-engineer, sobre `ac82ecb` (o PR com o `main` de 2026-11-10): **aprovado**. Todos os critérios da #25 com evidência em emuladores e navegador; o controle sem a correção mostra o defeito (20 de 29 verificações falham) |
| `seguranca-conversoes.md` | devsecops-engineer, revisão das conversões de dados do #38 e do #39 (gatilho "migração de dados"): **#39 aprovado com ressalvas**, voltar atrás é seguro; o #38 é tratado no PR dele. Os anexos A e B trazem os scripts de prova na íntegra |
| `provas-qa/` | script do QA (`qa39-registro.mjs`, registro, fora da suíte), saídas, controle e capturas, com contas fictícias |

## Ressalvas da revisão de segurança
| Achado | Situação |
|---|---|
| B1 comentário órfão se uma aba antiga editar ou excluir antes da primeira gravação do id | backlog (janela curta; o comentário aparece em Mensagens como "Item removido") |
| B2 comentários antigos com chave `tipo:undefined` ficam órfãos | registrado; não dá para religar com segurança (a conversa já era compartilhada entre itens sem id) |
| B3 id dependia da ordem das chaves | **corrigido** em `91dea81` (chaves ordenadas), com teste |
| B4 ids repetidos: excluir apagava as duas cópias | **corrigido** em `91dea81` (id novo a partir da 2ª ocorrência), com teste |

Implantação: no mesmo deploy de Hosting do #38, com cópia de segurança antes (ver o PR #38).
