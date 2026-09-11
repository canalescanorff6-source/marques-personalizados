## V6.50 — Cross-System Media Lease & Verified Completion

- [ ] `package.json` está em `6.50.0`, `platform-contract.json` está no schema **27** e o **Backup V9** continua sendo o formato vigente.
- [ ] Executar `npm run db:setup && npm run db:verify`; confirmar `media_lifecycle_leases`, funções begin/complete/fail/cancel e ausência dos atalhos V6.48/V6.49.
- [ ] Executar `npm run check:media-lifecycle && npm run check:media-dr && npm run check:backup-v9 && npm run check:restore`.
- [ ] Confirmar permissão `HeadObject` no Storage primário, além de `PutObject`, `DeleteObject` e listagem do namespace `catalog/`.
- [ ] Testar upload, delete e retry: lease ocupada retorna conflito; falha parcial mantém tombstone/quarentena; mídia indisponível não aparece como selecionável.
- [ ] Confirmar que restore do banco retorna conflito quando existe lifecycle de mídia ativo e que `media:restore --apply` revalida tombstone depois de adquirir lease.
- [ ] Confirmar que Backup V9 **não contém `media_lifecycle_leases`** e continua contendo `media_deletion_tombstones`.
- [ ] Para release real, `package-lock.json` legítimo continua obrigatório antes de `npm ci --ignore-scripts`, `check:deps`, typecheck e build.

## V6.49 — DR Namespace Isolation & Remote Backup Attestation

- [ ] `package.json` está em `6.49.0` e schema runtime permanece **26**
- [ ] `npm run check:dr-storage` passa com provas de HTTPS, destino externo e isolamento entre mídia, cofre e bucket de drill
- [ ] novos backups offsite do banco usam `${BACKUP_S3_PREFIX}/database/YYYY/MM/` e o espelho de mídia continua em `${BACKUP_S3_PREFIX}/media/`
- [ ] retenção automática considera somente objetos de backup de banco; objeto `media/...` velho nunca entra na lista de deleção
- [ ] recovery drill seleciona somente backup de banco, ignora mídia mais recente e usa layout legado apenas como fallback compatível
- [ ] objeto novo em `database/` possui `envelope-sha256`, `content-sha256`, `backup-contract` e `schema-version` coerentes com o backup verificado
- [ ] `npm run check:offsite-backup` e `npm run check:recovery-drill` passam após o isolamento de namespace
- [ ] backups antigos no layout `${BACKUP_S3_PREFIX}/YYYY/MM/` são preservados como legado; não mova/apague sem validar um V9 novo no namespace `database/`
- [ ] antes do release final, `package-lock.json` real existe e `npm run check:runtime -- --require-lock`, `npm ci --ignore-scripts`, typecheck e build passam

## V6.48 — Race-Safe Media Lifecycle & Repairable DR

- [ ] `package.json` está em `6.48.0` e `platform-contract.json` exige schema runtime **26**
- [ ] executar `npm run db:setup && npm run db:verify` e confirmar tabela `media_deletion_tombstones`, funções de reserva/reativação e três triggers de proteção
- [ ] `npm run check:media-lifecycle` passa com self-test de namespace `catalog/`, URL canônica, HTTPS em produção, tombstone/advisory lock e restore reparador
- [ ] `npm run check:backup-v9` passa; backup novo em schema 26 reporta `marques-catalog-v9`, inclui `media_deletion_tombstones` no SHA-256/HMAC e `backup:verify -- --strict` mostra `Media disaster recovery: embedded`
- [ ] restore externo preserva tombstones atuais por merge monotônico e snapshot interno usa modo `exact`; alteração de tombstone entre plan/apply invalida o `plan_hash`
- [ ] backup V9 que referencia uma mídia tombstonada é recusado, e V7/V8 são tratados apenas como legado sem DR autônomo de deleções de mídia
- [ ] seletor/API de restore aceita envelope criptografado somente até **36 MB**
- [ ] exclusão de mídia falha fechado se o Neon não puder confirmar referências; nunca converter erro de banco em “não está em uso”
- [ ] tentativa de anexar mídia tombstonada a produto, categoria, logo ou hero é recusada pelo banco até reupload bem-sucedido reativá-la
- [ ] `media:restore` em dry-run diferencia objetos verificados, ausentes e divergentes; `--apply --confirm=RESTAURAR-MIDIA` exige `DATABASE_URL`/schema 26, pula tombstones, repara ausentes/divergentes e revalida SHA-256
- [ ] deep health fica degradado para S3 inválido e integridade denuncia referência a mídia tombstonada
- [ ] endpoints/base pública S3 de produção são HTTPS e não contêm credenciais, query ou fragmento
- [ ] CI executa `check:media-lifecycle` explicitamente e `npm run verify` também o inclui
- [ ] antes do release final, `package-lock.json` real existe e `npm run check:runtime -- --require-lock`, `npm ci --ignore-scripts`, typecheck e build passam

## V6.47 — Idempotent Admin Creates & Selective Retry

- [ ] `npm run check:idempotency` passa com self-test de chave, replay, conflito de payload, retry seletivo e semântica de 428
- [ ] POSTs de criação de produto, categoria, avaliação, FAQ, campanha e planejamento social exigem `Idempotency-Key` válida
- [ ] retry da mesma tentativa retorna o mesmo registro com `deduplicated:true` e não duplica audit de criação
- [ ] reutilizar a mesma chave com payload diferente retorna `409`
- [ ] `fetchJson` repete somente as rotas explicitamente idempotentes em `408/502/503/504`; restore/privacidade/MFA e outros POSTs críticos não recebem retry genérico
- [ ] chave de criação incerta sobrevive a reload da aba via `sessionStorage` por TTL e é apagada após resultado definitivo
- [ ] HTTP `428` sem `reauth_required:true` não abre diálogo de step-up MFA
- [ ] CI executa `check:replay-safety` e `check:idempotency` como etapas explícitas
- [ ] `package.json` está em `6.47.0` e schema runtime permanece **25**
- [ ] antes do release final, `package-lock.json` real existe e `npm run check:runtime -- --require-lock`, typecheck e build passam

## V6.46 — Bounded Binary Ingress, Atomic Bulk & Replay-Safe Media

- [ ] `npm run check:http-boundary` prova limite físico de JSON, multipart e backup, inclusive sem `Content-Length`
- [ ] upload não usa `request.formData()` diretamente e restore não usa `request.text()` antes do bounded ingress
- [ ] multipart acima do teto é cancelado com `413`; envelope criptografado de restore respeita **36 MB**
- [ ] `npm run check:concurrency` confirma `id + updated_at` em lotes e CAS all-or-none no banco
- [ ] um único produto stale faz o lote inteiro retornar `409` sem alteração parcial
- [ ] `npm run check:replay-safety` confirma chave SHA-256 determinística para mídia e idempotência já existente de orçamento público
- [ ] reupload/retry do mesmo arquivo retorna a mesma URL de Storage, sem criar objeto órfão novo
- [ ] `package.json` está em `6.46.0` e schema runtime permanece **25**
- [ ] antes do release final, `package-lock.json` real existe e `npm run check:runtime -- --require-lock`, typecheck e build passam

## V6.45 — Bounded Ingress & Safe Concurrency

- [ ] `npm run check:http-boundary` passa com leitura JSON streaming, media type, CSP e rate limit duplo
- [ ] request chunked sem `Content-Length` acima do teto é cancelado antes de materializar o corpo completo
- [ ] erros `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` e `PRECONDITION_REQUIRED` não geram incidente 5xx
- [ ] `npm run check:concurrency` passa e todas as mutações individuais protegidas exigem `updated_at` ou `version`
- [ ] editar/excluir com uma aba desatualizada retorna `409` e não sobrescreve/apaga a versão mais nova
- [ ] precondição ausente retorna `428`; registro realmente ausente retorna `404` quando aplicável
- [ ] exclusão de atendimento envia `expected_version` e o banco executa `DELETE ... WHERE id ... AND version ...`
- [ ] `package.json` está em `6.45.0` e schema runtime permanece **25**
- [ ] antes do release final, `package-lock.json` real existe e `npm run check:runtime -- --require-lock`, typecheck e build passam

## V6.44 — Trusted Request Boundary & Nonce Admin CSP

- [ ] `npm run check:http-boundary` passa com os self-tests de origem, limites de request e CSP
- [ ] `NEXT_PUBLIC_SITE_URL` em produção aponta para a origem pública canônica HTTPS, sem path, query, fragmento ou credenciais
- [ ] spoofing de `x-forwarded-host`/`x-forwarded-proto` não altera a autoridade CSRF
- [ ] `/admin/login` retorna CSP com nonce + `strict-dynamic`, sem `'unsafe-inline'` no `script-src`, e responde com `Cache-Control: no-store` + `X-Robots-Tag: noindex`
- [ ] upload administrativo rejeita tipo multipart inválido e payload anunciado acima do orçamento antes de materializar `formData()`
- [ ] CI, E2E, live-check e deploy gate mantêm as provas do boundary HTTP
- [ ] `package.json` está em `6.44.0` e schema runtime permanece **25**
- [ ] antes do release final, `package-lock.json` real continua obrigatório e `npm run check:runtime -- --require-lock` passa


## V6.43 — Platform Contract & URL/Supply-Chain Hardening

- [ ] `npm run check:platform` confirma schema `25`, Node `22.23.2`, npm `10.9.8`, runner `ubuntu-24.04` e Docker por digest
- [ ] `npm run check:url-safety` passa e URLs legadas inseguras são descartadas no boundary de leitura
- [ ] `.npmrc` contém `ignore-scripts=true` e CI/Docker usam `npm ci --ignore-scripts`
- [ ] workflow **Generate package lock** conclui `npm ci`, `check:deps`, `npm audit` e gera `package-lock.sha256`
- [ ] conferir o SHA-256 baixado antes de commitar `package-lock.json`
- [ ] `npm run check:runtime -- --require-lock`, `npm run typecheck` e `npm run build` passam com dependências reais
- [ ] `package.json` está em `6.43.0` e schema runtime permanece **25**

## V6.42 — Hardened Runtime & Executable Contracts

- [ ] `.nvmrc` está em `22.23.2` e o npm efetivo é `10.9.8`
- [ ] `npm run check:module-surface` passa sem imports/exports divergentes ou bindings duplicados
- [ ] `npm run check:release` executa a identidade de release e confere `package.json`
- [ ] `npm run check:docs` confirma documentação operacional sincronizada
- [ ] Docker usa `output: standalone`, digest imutável e `USER node`

- [ ] `npm run check:supply-chain` confirma que toda Action externa está pinada por SHA completo
- [ ] `actions/checkout` usa `persist-credentials: false` em todos os workflows
- [ ] comentários dos pins continuam identificando as releases auditadas (checkout v7.0.1, setup-node v7.0.0, upload-artifact v7.0.1)
- [ ] gerar e commitar um `package-lock.json` real antes de liberar CI/deploy
- [ ] `npm run check:runtime -- --require-lock` passa com o lockfile presente
- [ ] schema runtime permanece **25**


## V6.40 — Supply Chain

- [ ] executar **Generate package lock**, baixar o `package-lock.json` e fazer commit antes do release
- [ ] `npm run check:supply-chain` passa sem fallback `npm install` nos workflows críticos
- [ ] `npm run check:runtime -- --require-lock` passa
- [ ] CI executa `npm ci`, `typecheck`, `build` e E2E usando o lock commitado
- [ ] revisar PRs semanais do Dependabot para npm, GitHub Actions e Docker
- [ ] schema runtime permanece **25**


## V6.39 — Media Recovery Drill

- [ ] `npm run check:media-recovery-drill` passa
- [ ] `DRILL_S3_*` aponta para bucket isolado do S3 público e do cofre offsite
- [ ] executar manualmente **Weekly media recovery drill** ao menos uma vez em staging
- [ ] confirmar recibo em `media_recovery_drill_receipts` e freshness saudável no Admin → Operação
- [ ] confirmar schema runtime **25** com `npm run db:verify`


## V6.38 — Auditoria crítica garantida

- [ ] `npm run check:critical-audit` passa
- [ ] confirmar que restore/rollback, anonimização, exclusões permanentes, revogações e configurações sensíveis gravam `intent_*` antes da mutação
- [ ] simular indisponibilidade da auditoria em staging e confirmar **fail-closed** antes da alteração crítica
- [ ] schema permanece 24; não executar downgrade/migração destrutiva por causa desta release


## V6.36 — Recovery readiness

- [ ] `npm run db:setup && npm run db:verify` confirma schema **22**
- [ ] `npm run check:backup-freshness` passa
- [ ] `BACKUP_OFFSITE_MAX_AGE_HOURS` está entre 24 e 720 (recomendado 36)
- [ ] workflow offsite foi executado após a migração e gravou recibo no Neon
- [ ] `Admin → Operação` mostra **Backup offsite recente**
- [ ] deep health retorna `backup_freshness.ok=true`
- [ ] após o primeiro recibo, deploy gate foi testado com `--require-backup-fresh`


## V6.34 — Offsite backup

- [ ] bucket privado de backup é diferente do bucket S3 público de mídia
- [ ] `BACKUP_OFFSITE_ENABLED=1` está definido como Repository Variable no GitHub
- [ ] credenciais `BACKUP_S3_*` e segredos de banco/privacidade/backup estão em GitHub Secrets
- [ ] `npm run check:offsite-backup` passa
- [ ] o job valida o backup com `--strict` antes do upload
- [ ] workflow `Encrypted offsite backup` foi executado manualmente ao menos uma vez
- [ ] log contém `OFFSITE_BACKUP_OK` e o objeto existe no bucket
- [ ] retenção está entre 7 e 3650 dias e atende à política do negócio
- [ ] nenhuma etapa usa `actions/upload-artifact` para o arquivo de backup

# V6 — Checklist de release

Use este arquivo antes de promover uma alteração para produção.

## Antes do release final
- [ ] `npm run check:project`
- [ ] `npm run check:acceptance`
- [ ] `npm run check:security`
- [ ] `npm run check:sessions`
- [ ] `npm run check:mfa`
- [ ] `npm run check:recovery`
- [ ] `npm run check:critical`
- [ ] `npm run check:observability`
- [ ] `npm run check:restore`
- [ ] `npm run check:resilience`
- [ ] `npm run check:performance`
- [ ] `npm run check:commercial`
- [ ] `npm run check:scalable-crm`
- [ ] `npm run check:crm-search`
- [ ] `npm run check:production-scale`
- [ ] `npm run check:agenda-scale`
- [ ] `npm run check:reactivation`
- [ ] `npm run check:audit-chain`
- [ ] `npm run check:public-flow`
- [ ] `npm run check:runtime -- --require-lock`
- [ ] `npm run check:deps`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `package-lock.json` real está commitado e `npm ci` conclui sem alterar o lockfile
- [ ] nenhum `.env`, `node_modules`, `.next`, `backups` ou `*.tsbuildinfo` no commit
- [ ] `package.json` continua em `6.49.0`

## Antes de migrar o Neon
- [ ] executar `npm run db:backup` com a `DATABASE_URL` atual
- [ ] guardar o arquivo `.encrypted.json` fora do servidor
- [ ] validar o arquivo com `npm run backup:verify -- caminho/do/backup.encrypted.json --strict`
- [ ] executar `npm run db:setup`
- [ ] confirmar `/api/health` com `schema >= 26`

- [ ] o backup novo reporta `marques-catalog-v9`, `privacy_tombstones` e `media_deletion_tombstones` no conteúdo descriptografado verificado
- [ ] após anonimizar um cliente e excluir uma mídia de teste em staging, gerar backup V9 e confirmar `check:privacy-dr` + `check:backup-v9` antes de liberar restore

## RunSite
- [ ] `npm run check:env -- --production` passa com `ADMIN_PASSWORD_HASH` Scrypt + `ADMIN_TOTP_SECRET` e sem depender de senha administrativa em texto puro
- [ ] Build: `npm ci && npm run build`
- [ ] Start: `npm start`
- [ ] serviço escuta `0.0.0.0` e a porta fornecida pelo ambiente
- [ ] `APP_RELEASE_ID` imutável foi definido para esta publicação
- [ ] `APP_RELEASE_COMMIT`/`APP_DEPLOYED_AT` definidos quando disponíveis
- [ ] configuração S3 está completa ou totalmente vazia; `S3_REQUIRED` condiz com a criticidade do storage

## Depois do deploy
- [ ] `npm run check:live -- https://DOMINIO` passa
- [ ] `/api/health?mode=deep` está verde
- [ ] `npm run check:deploy -- https://DOMINIO --release=APP_RELEASE_ID` passa
- [ ] `npm run check:load -- https://DOMINIO --requests=24 --concurrency=4 --p95=3000` passa
- [ ] quatro amostras do gate retornam o mesmo release, sem rollout misto
- [ ] release anterior conhecido como saudável continua disponível para rollback até o gate ficar verde
- [ ] home abre no celular e desktop
- [ ] busca global funciona e possui retry em falha
- [ ] filtros/paginação do catálogo funcionam
- [ ] Concierge recomenda itens reais
- [ ] lista de orçamento persiste e pode ser compartilhada
- [ ] orçamento de teste chega ao CRM apenas uma vez
- [ ] duas abas editando o mesmo atendimento: a segunda gravação stale recebe conflito e não sobrescreve a primeira
- [ ] lote do CRM com uma versão stale falha inteiro, sem atualização parcial
- [ ] combinações inválidas de pagamento/produção são rejeitadas pelo banco/API
- [ ] simular Neon indisponível confirma contingência WhatsApp sem apagar lista/personalizações do navegador
- [ ] backup administrativo confirma contagens completas do CRM/timeline no dry-run
- [ ] CRM abre todos os atendimentos operacionais e carrega histórico encerrado em páginas sem alterar KPIs globais
- [ ] pesquisar um cliente antigo antes de carregar todo o histórico ainda encontra o atendimento correto
- [ ] cliente recorrente/LTV continuam corretos para registros trazidos por busca ou paginação antiga
- [ ] Estúdio/Campanhas mantêm métricas históricas corretas mesmo antes de carregar todo o histórico no CRM
- [ ] login exige senha + TOTP; senha correta sozinha não cria sessão
- [ ] código TOTP incorreto é rejeitado e código correto conclui o login
- [ ] Admin → Segurança gera um conjunto novo de códigos reserva somente após TOTP atual
- [ ] um código de recuperação funciona uma vez e o mesmo código é rejeitado no segundo uso
- [ ] novo navegador/dispositivo autenticado aparece como alerta de segurança
- [ ] remover dispositivo reconhecido exige confirmação reforçada e revoga todas as sessões vinculadas
- [ ] backup, alterações de contatos/configurações e exclusões destrutivas pedem TOTP recente via modal de reautenticação
- [ ] se webhook de segurança estiver configurado, validar assinatura HMAC-SHA256 no receptor e confirmar um evento de teste real
- [ ] logout, backup e Biblioteca de Mídia funcionam
- [ ] Admin → Operação mostra banco/schema íntegros, auditoria append-only e nenhum incidente crítico aberto
- [ ] o backup baixado passa em `npm run backup:verify -- arquivo.json`
- [ ] Admin → Segurança mostra a sessão atual
- [ ] revogar uma sessão em outro navegador/dispositivo derruba o acesso remoto
- [ ] criar/editar/publicar produto de teste funciona
- [ ] conflito entre duas abas retorna aviso em vez de sobrescrever
- [ ] sitemap, robots e páginas de produto/categoria respondem
- [ ] remover dados de teste após validação


## Verificação runtime do Neon
Após aplicar ou alterar o schema, execute `npm run db:verify`. A verificação confirma tabelas/colunas críticas, vínculos de categoria, janelas de publicação e estrutura de personalização diretamente no banco. O `npm run db:setup` também executa essa verificação automaticamente ao final.


### E2E funcional
Após o build, suba uma instância isolada e execute `E2E_ADMIN_PASSWORD="senha-de-teste" E2E_ADMIN_TOTP_SECRET="SEGREDO-BASE32" npm run check:e2e -- http://127.0.0.1:3100`. O GitHub Actions já executa esse fluxo automaticamente.

- [ ] `npm run check:restore` passa
- [ ] testar dry-run de um backup verificável em Admin → Operação
- [ ] confirmar que restore real exige step-up TOTP + `RESTAURAR`
- [ ] confirmar criação do snapshot automático pré-restore
- [ ] confirmar que auditoria/sessões/MFA não são substituídos pela restauração
- [ ] validar uma reversão de snapshot em ambiente de teste antes do primeiro uso em produção

## V6.28 — Reativação global

- [ ] `db:verify` confirma `repurchase_contacted_at`, `repurchase_contact_year` e os dois índices de reativação
- [ ] filtro **Oportunidades de recompra** encontra clientes fora das páginas carregadas do CRM
- [ ] 29/02 é tratado corretamente em ano comum
- [ ] ao clicar **Reativar cliente**, o ciclo é gravado e a oportunidade some daquele ano
- [ ] no ciclo seguinte o cliente volta a ser elegível

## V6.29 / schema 19
- [ ] `npm run check:audit-chain` passou
- [ ] Admin → Operação mostra cadeia ativa, append-only ativo e âncora íntegra
- [ ] `npm run db:verify` confirma `admin_audit_chain_state` e os triggers de cadeia


## V6.30 / schema 20
- [ ] `PRIVACY_HASH_SECRET` está configurado com 32+ caracteres e guardado como segredo estável
- [ ] `npm run check:privacy` passou
- [ ] `db:verify` confirma `anonymized_at`, `privacy_requests`, função e índices de privacidade
- [ ] Admin → Privacidade não coloca telefone/e-mail na URL
- [ ] exportação e anonimização exigem step-up MFA
- [ ] atendimento ativo/produção não entregue bloqueia anonimização
- [ ] anonimização remove PII/timeline/personalizações e preserva métricas comerciais
- [ ] snapshots internos antigos são invalidados após anonimização
- [ ] dry-run de backup antigo respeita tombstones e não reintroduz identidade anonimizada
- [ ] restore CLI recusa schema anterior ao 20
- [ ] política para backups externos antigos foi revisada


## V6.31 / schema 20 — backup assinado
- [ ] `BACKUP_SIGNING_SECRET` possui 32+ caracteres e está fora do repositório
- [ ] `BACKUP_SIGNING_KEY_ID` identifica a chave atual sem conter segredo
- [ ] `npm run check:backup-auth` passou
- [ ] novo backup do Admin contém assinatura HMAC-SHA256
- [ ] `npm run backup:verify -- backup.json --require-signature` confirma autenticidade
- [ ] arquivo adulterado com SHA recalculado é rejeitado pelo self-test
- [ ] restore de produção rejeita backup sem assinatura
- [ ] se houver rotação, `BACKUP_SIGNING_PREVIOUS_SECRET` foi mantido apenas pelo período necessário
- [ ] schema continua 20; nenhuma migração Neon adicional é necessária


## V6.32 / schema 20 — backup criptografado
- [ ] `BACKUP_ENCRYPTION_SECRET` possui 32+ caracteres e é diferente da chave de assinatura
- [ ] `BACKUP_ENCRYPTION_KEY_ID` identifica a chave atual sem expor segredo
- [ ] `npm run check:backup-encryption` passou
- [ ] backup do Admin é envelope `marques-backup-encrypted-v1`
- [ ] PII não aparece em texto claro no arquivo exportado
- [ ] `npm run backup:verify -- backup.encrypted.json --strict` passou
- [ ] adulteração do ciphertext/tag/AAD é rejeitada
- [ ] restore real rejeita backup plaintext
- [ ] rotação, se usada, mantém chave anterior apenas pelo período necessário
- [ ] schema continua 20; não há migração Neon nova

## V6.36 — Recovery drill
- [ ] `DRILL_DATABASE_URL` aponta para Neon separado.
- [ ] `RECOVERY_DRILL_CONFIRM_ISOLATED=1` somente no workflow de drill.
- [ ] Executar `npm run db:setup && npm run db:verify` no operacional após migração para schema 24.
- [ ] Executar manualmente **Weekly recovery drill** uma vez antes de depender do agendamento.
- [ ] Confirmar recibo recente em Admin → Operação.

## V6.37 — Mídia
- [ ] Ativar `MEDIA_BACKUP_ENABLED=1` no GitHub após validar o bucket privado.
- [ ] Confirmar que o bucket público e o bucket de backup são distintos.
- [ ] Executar `npm run db:setup && npm run db:verify` para schema 24.
- [ ] Rodar uma vez o workflow **Media offsite mirror** e conferir Admin → Operação.
- [ ] Fazer dry-run de `npm run media:restore` em ambiente de teste.
