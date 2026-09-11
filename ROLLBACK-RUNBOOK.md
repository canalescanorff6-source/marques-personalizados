## V6.50 → V6.49 — lifecycle cross-system

O contrato atual é app **6.50.0**, **schema runtime 27** e **Backup V9**. O schema 27 é aditivo, mas remove deliberadamente `marques_reserve_media_delete` e `marques_reactivate_media`, porque esses atalhos não protegiam o intervalo entre commit no Neon e I/O no S3. **Não reintroduza essas funções só para fazer a V6.49 voltar a mutar mídia.** Em rollback emergencial, preserve schema 27, tombstones e leases; prefira desabilitar temporariamente upload/delete/restore de mídia e corrigir por roll-forward. Leases são transitórias e não pertencem ao Backup V9. Antes de restore de banco, resolva qualquer lease ativa/expirada apontada pelo deep-health.

## V6.49 → V6.48

O schema runtime permanece **26** e o **Backup V9** continua válido, portanto o rollback é somente de código. A V6.49 muda o layout operacional do cofre: backups novos do banco ficam em `${BACKUP_S3_PREFIX}/database/`, mídia permanece em `${BACKUP_S3_PREFIX}/media/` e a retenção só atua no namespace de banco. Voltar para V6.48 reabre o risco de a retenção percorrer a raiz inteira do cofre e atingir mídia antiga, além de o recovery drill poder selecionar um objeto de mídia mais recente em vez de um backup do banco. Se rollback for inevitável, **desative temporariamente os workflows `Encrypted offsite backup` e `Weekly recovery drill`** até retornar à V6.49 ou aplicar manualmente o isolamento; preserve todos os objetos `database/` e legados. Não há downgrade do Neon.

## V6.48 → V6.47

A V6.48 sobe o **schema runtime 26** de forma aditiva para introduzir tombstones, advisory locks e triggers de proteção do ciclo de vida de mídia, e backups novos passam a ser **V9 (`marques-catalog-v9`)**, levando `media_deletion_tombstones` assinados. **Não remova nem faça downgrade dessas estruturas do Neon durante rollback de código.** Ferramentas V6.47 não conhecem o contrato V9/restore de 5 argumentos: não aplique um backup V9 com tooling V6.47. Preserve os backups V9 e a função nova; se o código precisar voltar, mantenha o banco em schema 26 e suspenda temporariamente operações de restore/exclusão/reupload que dependam do lifecycle novo até a V6.48 voltar. Voltar integralmente para V6.47 reabre a corrida entre “mídia sem referência” e nova referência, e o upload antigo não limpa tombstones de conteúdo reupado. Não desative triggers nem apague tombstones para contornar o bloqueio.

## V6.47 → V6.46

O schema runtime **25** não muda; rollback é somente de código. Voltar para V6.46 remove a idempotência obrigatória das criações administrativas, volta a deixar POSTs de criação sem retry seguro após timeout e volta a tratar qualquer 428 administrativo como candidato a step-up no cliente. Em incidente, preserve quando possível `lib/idempotency.ts`, a versão V6.47 de `lib/client.ts` e `check:idempotency`; não é necessário alterar o Neon.

## V6.46 → V6.45

O schema runtime **25** não muda; rollback é somente de código. Voltar para V6.45 reabre três riscos: multipart/restore podem materializar request chunked antes do limite real, lotes de produtos deixam de ser CAS all-or-none e uploads voltam a criar chaves aleatórias por tentativa. Em incidente, preserve quando possível `lib/request-limits.ts`, `lib/media-key.ts`, a versão V6.46 de `bulkUpdateProducts()` e os contracts `check:http-boundary`, `check:concurrency` e `check:replay-safety`. Não é necessário downgrade do Neon.

## V6.45 → V6.44

O schema runtime permanece **25**, portanto o rollback é apenas de código. A V6.44 perde o corte físico de JSON chunked, o teto global de rate limit administrativo e as precondições obrigatórias de concorrência em exclusões/edições individuais. Em um rollback emergencial, preserve quando possível `lib/request-limits.ts`, `lib/rate-limit-policy.ts`, `lib/concurrency.ts` e o `check:concurrency`; não faça downgrade do Neon nem remova o contador `version` dos atendimentos.

## V6.44 → V6.43

O schema permanece **25**, então o rollback é de código e não exige downgrade destrutivo do Neon. A V6.43 perde a autoridade CSRF fixa baseada em `NEXT_PUBLIC_SITE_URL`, a prova anti-spoofing, a CSP administrativa com nonce e a rejeição antecipada de uploads superdimensionados. Em incidente, reverta apenas o mínimo necessário e preserve, quando possível, `lib/request-origin.ts`, `proxy.ts` e os guards HTTP da V6.44.


## V6.43 → V6.42

O schema permanece **25** e o rollback de código não exige downgrade do Neon. A V6.42 não possui o contrato central de plataforma, volta a aceitar lifecycle scripts durante `npm ci`, usa `ubuntu-latest` e não normaliza URLs legadas no boundary de leitura. Em incidente funcional, prefira reverter apenas o código necessário e preservar, quando possível, os workflows/install hardening da V6.43.

## V6.42 → V6.41

O schema permanece **25**, portanto o rollback de código é compatível e não exige downgrade destrutivo do Neon. A V6.41 volta ao Node 22.16.0 e ao Docker sem o hardening standalone/non-root desta rodada; em incidente, prefira preservar os workflows com Actions por SHA e, quando possível, mantenha também o runtime/container endurecido da V6.42 enquanto reverte apenas o código da aplicação.

## V6.41 → V6.40

O schema permanece 25 e o rollback de código é compatível. V6.40 ainda usa tags de release mutáveis nos GitHub Actions e persiste as credenciais padrão do checkout; em incidente, prefira preservar os workflows endurecidos da V6.41 mesmo se o código da aplicação precisar voltar para V6.40.


## V6.40 → V6.39

O schema permanece 25. O rollback de código é compatível, mas V6.39 volta a permitir instalação destravada em alguns workflows quando o lockfile está ausente. Preserve o `package-lock.json` commitado e prefira manter os workflows endurecidos da V6.40.


## V6.39 → V6.38

A V6.39 adiciona apenas estruturas de drill/recibo ao schema 25. O rollback do código para V6.38 pode manter essas estruturas no Neon; não apague recibos manualmente. Desative o workflow de media recovery drill se a versão antiga permanecer em produção.


## V6.38 → V6.37

A V6.38 não altera o schema (continua 24). Rollback de código é compatível, mas remove a garantia de **audit intent fail-closed** antes de ações críticas. Não modifique nem recalcule manualmente a cadeia de auditoria durante rollback.


## V6.36 / schema 24 — recibos de freshness

A tabela `offsite_backup_receipts` é aditiva e append-only. Rollback de código para V6.34 não exige removê-la; preserve os recibos. Se o gate estiver bloqueando por freshness durante um incidente no provedor de backup, desative temporariamente apenas a exigência `--require-backup-fresh`, não apague recibos nem use restore de dados como rollback de código. Após corrigir o job, execute um backup offsite manual e confirme um novo recibo antes de reativar o gate fail-closed.


## V6.34 / schema 21 — rollback do job offsite

A V6.34 não altera o schema. Se o job offsite apresentar problema, desative `BACKUP_OFFSITE_ENABLED` e preserve os objetos já enviados; não apague o bucket para reverter o código. Rollback do app para V6.33 continua compatível com schema 21 e backups V8 já existentes. Antes de remover/chavear secrets antigos, confirme que pelo menos um backup offsite recente pode ser baixado, descriptografado e validado com `backup:verify -- --strict`.

# Rollback de release — Marques Catálogo V6.49

Este procedimento é para **rollback do código/deploy**. Não use restauração de backup do Neon para desfazer uma publicação de código; restore de dados é reservado para corrupção/perda de dados.

## Antes de cada publicação

1. mantenha anotado o `APP_RELEASE_ID` atualmente saudável;
2. publique o novo código com um `APP_RELEASE_ID` diferente e imutável;
3. quando possível, configure também `APP_RELEASE_COMMIT` e `APP_DEPLOYED_AT`;
4. não remova a publicação anterior até o novo release passar pelo deploy gate.

Exemplo:

```env
APP_RELEASE_ID=2026-09-09.1
APP_RELEASE_COMMIT=abcdef1234567890
APP_DEPLOYED_AT=2026-09-09T03:00:00Z
```

## Gate do release novo

```bash
npm run check:deploy -- https://SEU-DOMINIO --release=2026-09-09.1 --previous-release=2026-09-08.4
```

Se o S3 for parte obrigatória da operação:

```bash
npm run check:deploy -- https://SEU-DOMINIO --release=2026-09-09.1 --previous-release=2026-09-08.4 --require-storage
```

O gate exige liveness, readiness, deep health, página pública, entrada do Admin e várias amostras do mesmo release. Se diferentes IDs responderem durante o rollout, a promoção falha.

## Quando fazer rollback

Faça rollback se o novo release falhar no gate, apresentar 5xx relevantes, readiness/deep health vermelho ou regressão comercial confirmada. Não tente “consertar ao vivo” um release parcialmente promovido se a versão anterior está saudável.

## Procedimento

1. no provedor de deploy, promova/republique a última versão conhecida como saudável;
2. preserve o Neon; a V6.49 usa **schema runtime 26** com migração aditiva de lifecycle de mídia. Não remova `media_deletion_tombstones`, funções, advisory-lock guards, triggers, índices ou recibos adicionados pelas versões recentes para fazer rollback de código;
3. confirme que `/api/health?mode=live` mostra o `APP_RELEASE_ID` antigo;
4. execute novamente o gate, agora esperando o release anterior:

```bash
npm run check:deploy -- https://SEU-DOMINIO --release=2026-09-08.4
```

5. somente depois que o gate ficar verde, considere o rollback concluído;
6. registre o incidente e a causa na Central de Operação antes de tentar outra publicação.

## GitHub Actions

O workflow **Verify deployment or rollback target** executa a mesma validação sem instalar dependências. Informe URL, release esperado e, opcionalmente, o release anterior e `require_storage`.

## Regra de banco

- rollback de **código**: promova a imagem/publicação anterior;
- erro de **schema**: corrija com migração forward/idempotente; não faça down migration automática;
- corrupção/perda de **dados**: use o fluxo de backup/restore V6.20, com dry-run, step-up TOTP e snapshot.


## V6.22 → V6.21

O schema 13 adiciona apenas índices e um trigger de imutabilidade do slug de campanha. Um rollback de código para V6.21 não exige remover esses objetos: eles são compatíveis e o V6.21 continuará reconhecendo o núcleo do schema como runtime 12. Não faça downgrade destrutivo do banco para rollback de aplicação.

## V6.23 / schema 14

O schema 14 adiciona `inquiries.version`, trigger de versão monotônica e guard de integridade comercial. O rollback de **código** para V6.22 não deve remover esses objetos: eles são aditivos, mas a V6.22 não usa o contrato `expected_version` do CRM. Se precisar voltar o código, congele edições administrativas do CRM durante a janela e valide um backup antes/depois. Não faça downgrade destrutivo do banco para rollback de aplicação.

Backups V6.19–V6.22 podem usar a ordem histórica do SHA-256 e, no exportador administrativo antigo, podem ter sido limitados pela paginação de tela. O restore V6.23 aceita a ordem histórica, mas exige revisão das contagens no dry-run.

## V6.24 / schema 15

O schema 15 adiciona apenas índices parciais para histórico/fila operacional do CRM; a mudança de KPIs/paginação está no código. Rollback de código para V6.23 não exige remover os índices e não deve executar downgrade destrutivo. Como V6.23 espera schema 14 e reconhece o núcleo anterior, mantenha os objetos aditivos no Neon e faça rollback apenas da aplicação.

## V6.25 / schema 15

A V6.25 não altera o schema runtime: continua em 15. O rollback de código para V6.24 é direto e não exige qualquer mudança no Neon. A nova rota de busca e os agregados de cliente são somente comportamento da aplicação.


## V6.27 / schema 17

O schema 17 adiciona somente `idx_inquiries_event_agenda` e `idx_inquiries_follow_up_agenda`. Rollback de código para V6.26 não exige remover esses índices; mantenha-os no Neon. Não restaure dados para desfazer esta publicação.

## V6.26 / schema 16

O schema 16 adiciona somente os índices `idx_inquiries_delivered_history` e `idx_inquiries_post_sale_pending`. Rollback de código para V6.25 não exige remover esses índices; mantenha-os no Neon e faça rollback apenas da aplicação. Não use restore de dados para desfazer uma publicação V6.26.


## V6.28 / schema 18

O schema 18 adiciona `inquiries.repurchase_contacted_at`, `inquiries.repurchase_contact_year`, a função `marques_anniversary_date` e dois índices de reativação. Rollback de código para V6.27 não exige remover esses objetos: são aditivos e anuláveis. Mantenha-os no Neon e reverta apenas a aplicação. Não use restore de dados para desfazer a V6.28.


## V6.29 / schema 19

O schema 19 adiciona `prev_integrity_hash`, `chain_version`, `admin_audit_chain_state`, funções/triggers de cadeia e um índice. São objetos aditivos. Rollback do código para V6.28 não exige apagá-los; preserve a cadeia no Neon. Não recalcule manualmente hashes para “corrigir” uma divergência sem investigar primeiro, pois isso destruiria a evidência de adulteração/corrupção.


## V6.30 / schema 20

O schema 20 adiciona `inquiries.anonymized_at`, `privacy_requests`, índices de busca exata e a função transacional de anonimização. Os objetos são aditivos, mas **as tombstones em `privacy_requests` são dados de segurança/privacidade e não devem ser removidas num rollback de código**. Voltar o código para V6.29 pode ser feito mantendo o schema 20 no Neon.

Mantenha também o mesmo `PRIVACY_HASH_SECRET`. Apagar `privacy_requests`, trocar o segredo sem migração ou restaurar um dump completo que remova essas tombstones pode permitir que um backup histórico reintroduza PII previamente anonimizada. Não use restore de dados para desfazer um deploy V6.30.


## V6.31 / schema 20 — assinatura de backup

A V6.31 não altera o Neon. Rollback de código para V6.30 pode ser feito mantendo schema 20. **Não apague `BACKUP_SIGNING_SECRET` nem a chave anterior enquanto existirem backups assinados que dependam delas.** O rollback de código não deve ser acompanhado por restore de dados.

Se uma chave for rotacionada por suspeita de comprometimento, preserve a chave antiga somente em ambiente controlado pelo tempo estritamente necessário para verificar/migrar backups legítimos; depois retire-a. Um backup cuja assinatura não possa ser validada deve ser tratado como não autenticado, ainda que o SHA-256 interno esteja correto.


## V6.32 / schema 20 — criptografia de backup

Não há alteração de schema. Rollback de código para V6.31 preserva o Neon schema 20, porém V6.31 não conhece o envelope AES-GCM da V6.32. Portanto, antes de um rollback, mantenha uma cópia do código/ferramentas V6.32 para descriptografar/verificar backups gerados nessa versão.

Não apague `BACKUP_ENCRYPTION_SECRET` nem `BACKUP_ENCRYPTION_PREVIOUS_SECRET` enquanto houver envelopes válidos que dependam dessas chaves. Perder ambas as chaves torna os backups criptografados irrecuperáveis — isso é propriedade esperada da criptografia, não um erro do sistema.

## V6.33 / schema 21

O schema 21 altera o contrato da função `marques_restore_business_payload` para aceitar tombstones de privacidade embutidas. Rollback de **código** não deve remover `privacy_requests`, tombstones ou o novo contrato por down migration. Se precisar voltar temporariamente o app, preserve o banco e os backups V8; corrija incompatibilidade com migração forward. Nunca restaure um backup V7 sobre um Neon recriado supondo que ele conheça anonimizações feitas depois da criação daquele arquivo.


## V6.36 → V6.35
A migração de schema 24 é aditiva. Em rollback de código, preserve `recovery_drill_receipts`; não é necessário remover a tabela. Nunca use o banco de produção como `DRILL_DATABASE_URL`.

## V6.37 → V6.36
A tabela `media_backup_receipts` é aditiva e deve ser preservada. Rollback de código não exige apagar o espelho de mídia.
