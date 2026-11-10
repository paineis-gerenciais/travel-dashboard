# Revisões do PR #38 (issue #24)

| Arquivo | O que é |
|---|---|
| `seguranca-conversoes.md` | devsecops-engineer, revisão das conversões de dados do #38 e do #39 (gatilho "migração de dados"), sobre `f667be3`: **#38 reprovado** (A1 e A2 altos, M1 médio). Os anexos trazem as provas e o protótipo da correção |
| `qa.md` | qa-engineer, sobre `f667be3`: **aprovado com ressalvas** (D1 e D2 médios). Adendo do reteste sobre `cb47cb7`: **aprovado com ressalvas**, só baixos em aberto |
| `provas-qa/` | scripts do QA (`*-registro.mjs`, registros, fora da suíte), saídas e capturas, com contas fictícias |

## Achados e correções
| Achado | Correção | Commit |
|---|---|---|
| A1 (alto) confirmações cumulativas do modelo antigo somadas na conversão | só viram pagamento as chaves que batem com o acerto atual, com tolerância de 1 centavo por despesa | `692226c` |
| A2 (alto) a conversão esvaziava `settlementsDone`, quebrando o rollback e abas antigas | `settlementsDone` intacto; conversão uma vez por viagem (`paymentsMigrated`); id `mig-<key>` | `692226c` |
| M1 (médio) R$ 0,01 pendente depois da conversão | valor do acerto novo em centavos | `692226c` |
| B5 (baixo) parser permissivo de chaves | regex estrita | `692226c` |
| D1 (médio) data do pagamento em UTC | `dataLocalDeIso` na exibição | `cb47cb7` |
| D2 (médio) "Pagou R$" somava acertos | `paid` só despesas; `settled` separado | `cb47cb7` |
| D5 (baixo) sem E2E de confirmar e desfazer | `e2e/pagamentos.spec.js` | `cb47cb7` |

**Em aberto (baixos):**
- D3: pagamento de participante removido aparece como "— pagou a …" e fica fora do saldo.
- D4: botões repetidos sem nome acessível contextual.
- D6: confirmações antigas que já estavam vencidas não viram pagamento. É coerente com a tela antiga, que já as mostrava como pendentes. Quem pagou nesses casos registra de novo. Vai na nota de versão.
- M2 (médio, de antes do PR): a gravação de memória antiga por cima ("última gravação vence") é tratada na #26.
