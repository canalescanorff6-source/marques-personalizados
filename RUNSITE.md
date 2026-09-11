## V6.50 — deploy do lifecycle cross-system de mídia

Antes do deploy execute `npm run db:setup && npm run db:verify`, seguido de `npm run check:media-lifecycle && npm run check:media-dr && npm run check:backup-v9 && npm run check:restore`. O **schema 27** cria leases transitórias que serializam upload/delete/restore de mídia com o Neon; o **Backup V9** continua atual e não deve conter essas leases. Garanta no Storage primário permissões para `HeadObject`, `PutObject`, `DeleteObject` e listagem no namespace `catalog/`. Depois do deploy, faça um upload, confirme attestation por `HeadObject`, faça exclusão/retry controlado e verifique o deep-health sem leases expiradas ou tombstones pendentes. Restore do banco deve ser recusado enquanto houver lifecycle ativo; `media:restore --apply` exige Neon/schema 27 e revalida tombstones sob lease. Node `22.23.2`, npm `10.9.8`, schema `27`.

## V6.49 — cofre de DR com namespaces isolados

Execute `npm run check:dr-storage && npm run check:offsite-backup && npm run check:recovery-drill` antes do deploy. O `BACKUP_S3_PREFIX` agora é apenas a raiz: backups novos do banco são gravados em `${BACKUP_S3_PREFIX}/database/YYYY/MM/` e o espelho de mídia continua em `${BACKUP_S3_PREFIX}/media/catalog/`. A retenção do banco não toca `media/`. O recovery drill procura `database/` primeiro e aceita o layout antigo `${BACKUP_S3_PREFIX}/YYYY/MM/` somente como fallback de migração. Depois do deploy, execute manualmente **Encrypted offsite backup**, confirme `OFFSITE_BACKUP_OK ... contract=marques-catalog-v9 schema=26` e valide que a chave contém `/database/`. Em seguida execute o recovery drill e confirme que ele reporta `legacy_namespace=0`. Não apague backups legados antes de existir pelo menos um V9 novo atestado e um drill verde. `BACKUP_S3_ENDPOINT` e `DRILL_S3_ENDPOINT` devem ser HTTPS externos e apontar para targets isolados. Node `22.23.2`, npm `10.9.8`, schema `26`.

## V6.48 — lifecycle de mídia fail-closed e restore reparador

Antes do deploy aplique `npm run db:setup && npm run db:verify` e execute `npm run check:media-lifecycle && npm run check:backup-v9`. O **schema 26** adiciona tombstones e triggers que serializam exclusão/referência com advisory locks; falha do Neon deve bloquear delete, nunca ser interpretada como “mídia livre”. O Storage gerenciado é somente `catalog/`; produção exige endpoint/base pública S3 HTTPS canônicos. Reupload content-addressed só limpa tombstone depois de `PutObject` bem-sucedido. Backups novos no schema 26 são **V9** e assinam também `media_deletion_tombstones`; após migrar, gere imediatamente um V9 novo e valide com `npm run backup:verify -- <arquivo> --strict`, confirmando `Media disaster recovery: embedded`. Restore externo mescla tombstones atuais + backup e invalida o `plan_hash` se o estado mudar entre dry-run e apply; snapshots internos de rollback usam modo `exact`. `media:restore --apply` exige `DATABASE_URL`/schema 26 saudável, pula chaves tombstonadas, verifica SHA-256 de objetos existentes e repara também conteúdo divergente. Não desative triggers/tombstones durante rollback. Node `22.23.2`, npm `10.9.8` e schema `26` são o contrato atual da plataforma.

## V6.47 — idempotência de criação e retry seguro

Antes do deploy execute `npm run check:idempotency` e `npm run check:replay-safety`. As rotas de criação administrativa listadas no contrato exigem `Idempotency-Key`; não remova essa precondição nem habilite retry genérico para outros POSTs. `fetchJson` só repete automaticamente criação comprovadamente idempotente e mantém tentativas incertas em `sessionStorage` por TTL sem persistir o payload completo. HTTP `428` só deve abrir reautenticação quando a API responder `reauth_required:true`. Node `22.23.2`, npm `10.9.8` e schema `25` permanecem o contrato da plataforma.

## V6.46 — ingresso binário limitado, bulk all-or-none e mídia content-addressed

Antes do deploy execute `npm run check:http-boundary`, `npm run check:concurrency` e `npm run check:replay-safety`. Upload e restore devem sempre passar pelos leitores limitados de `lib/request-limits.ts`; nunca volte a chamar `request.formData()`/`request.text()` diretamente em payloads grandes. Ações em lote de produtos exigem a versão observada de cada item e devem falhar com **409 sem efeito parcial** quando houver stale write. A biblioteca usa chaves SHA-256 determinísticas: reenviar o mesmo arquivo é replay-safe e converge para a mesma URL. Node `22.23.2`, npm `10.9.8` e schema `25` permanecem o contrato da plataforma.

## V6.45 — ingresso limitado e concorrência segura

Execute `npm run check:http-boundary` e `npm run check:concurrency` antes do deploy. JSON administrativo é lido em streaming e interrompido no limite mesmo sem `Content-Length`; endpoints JSON exigem media type compatível. O Admin usa limite distribuído por cliente mais teto global por escopo. Interfaces administrativas devem sempre enviar `expected_updated_at` nas mutações versionadas e `expected_version` ao excluir atendimento; **428** indica precondição ausente e **409** indica que outra aba/processo alterou o registro. Não contorne esses conflitos repetindo a requisição com uma versão inventada: recarregue o dado e reaplique a intenção do usuário. Node `22.23.2`, npm `10.9.8` e schema `25` permanecem o contrato da plataforma.

## V6.44 — boundary HTTP e CSP administrativa

Em produção, `NEXT_PUBLIC_SITE_URL` é a origem canônica de segurança para mutações administrativas; configure uma URL HTTPS exata, sem path/query/fragmento e não dependa de `X-Forwarded-*` para autorizar origem. Execute `npm run check:http-boundary` antes do deploy. `/admin` deve responder com CSP de nonce (`strict-dynamic`, sem `'unsafe-inline'` no `script-src`), `Cache-Control: private, no-store` e `X-Robots-Tag: noindex`; E2E, live-check e deploy gate verificam isso. Uploads administrativos têm limite de arquivo de 8 MiB e rejeitam envelope/tipo inválido antes do parser multipart.


## V6.43 — contrato de plataforma e lockfile comprovado

`platform-contract.json` é a referência operacional para schema `25`, Node `22.23.2`, npm `10.9.8`, runner `ubuntu-24.04` e imagem Docker. Não altere esses valores isoladamente: `npm run check:platform` deve continuar verde. Instalações bloqueiam lifecycle scripts por padrão (`ignore-scripts=true`). O workflow **Generate package lock** só libera o artefato depois de `npm ci`, `check:deps`, `npm audit` e geração de `package-lock.sha256`. Valide também `npm run check:url-safety` antes do deploy.

## V6.42 — runtime/container endurecido

Use Node `22.23.2` com npm `10.9.8`. O Docker de produção exige `package-lock.json`, usa `npm ci`, gera o bundle Next `standalone`, é pinado por digest imutável e roda como usuário não-root. Antes do deploy, `check:module-surface`, `check:release`, `check:docs`, `check:supply-chain` e `check:runtime -- --require-lock` devem estar verdes.

## V6.41 — GitHub Actions imutáveis

Os workflows usam SHAs completos para as Actions auditadas e `actions/checkout` com `persist-credentials: false`. Não substitua os SHAs por tags como `@v7`; o `check:supply-chain` rejeita refs mutáveis. O `package-lock.json` continua sendo pré-requisito obrigatório para CI, backup e drills críticos.


## V6.40 — Supply Chain

Antes de qualquer deploy, gere e faça commit do `package-lock.json`. A partir desta versão, CI e jobs operacionais críticos recusam executar sem ele. O workflow **Generate package lock** é a única exceção controlada e existe apenas para produzir o lockfile inicial.


## V6.39 — Media Recovery Drill

Configure `DRILL_S3_ENDPOINT`, `DRILL_S3_BUCKET`, `DRILL_S3_ACCESS_KEY_ID` e `DRILL_S3_SECRET_ACCESS_KEY` para um bucket exclusivamente de teste. Ative `MEDIA_RECOVERY_DRILL_ENABLED=1` no GitHub e execute o workflow uma vez manualmente. Para bloquear promoção quando o ensaio estiver velho, use `DEPLOY_REQUIRE_MEDIA_RECOVERY_DRILL_FRESH=1`.


## V6.38 — Guaranteed Critical Audit

Após publicar, execute `npm run check:critical-audit` e confirme em staging que uma falha de persistência da auditoria impede a ação crítica antes da mutação. O schema continua em **24**, portanto esta versão não exige nova migração Neon além do schema já aplicado pela V6.37.

# RunSite + GitHub + Neon — Deploy V6.36

## V6.36 — freshness do backup

Aplique primeiro `npm run db:setup && npm run db:verify`; o schema mínimo é **22** e contém `offsite_backup_receipts`. Depois execute manualmente o workflow `Encrypted offsite backup` para criar o primeiro recibo. Configure `BACKUP_OFFSITE_MAX_AGE_HOURS=36` no deploy (ou outro valor 24–720).

Em `Admin → Operação`, confirme **Backup offsite recente**. No workflow `Verify deployment or rollback target`, marque `require_backup_fresh=true` depois que o primeiro recibo existir. O deep health informa freshness, mas não derruba a readiness pública por atraso de backup.


## V6.34 — backup offsite automático

O schema permanece 21. Crie um bucket S3 **privado e separado** do bucket de mídia pública e configure no GitHub:

- Repository Variable: `BACKUP_OFFSITE_ENABLED=1`;
- Secrets: `DATABASE_URL`, `PRIVACY_HASH_SECRET`, `BACKUP_SIGNING_SECRET`, `BACKUP_ENCRYPTION_SECRET`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`;
- Variables opcionais: `BACKUP_SIGNING_KEY_ID`, `BACKUP_ENCRYPTION_KEY_ID`, `BACKUP_S3_REGION`, `BACKUP_S3_PREFIX`, `BACKUP_OFFSITE_RETENTION_DAYS`, `BACKUP_S3_FORCE_PATH_STYLE`;
- durante rotação, as chaves anteriores podem ficar temporariamente em `BACKUP_SIGNING_PREVIOUS_SECRET` e `BACKUP_ENCRYPTION_PREVIOUS_SECRET`.

O job executa `backup:verify -- --strict` antes do upload. O workflow `Encrypted offsite backup` roda diariamente às 06:17 UTC quando habilitado. Faça também uma execução manual após configurar os secrets e confirme no log `OFFSITE_BACKUP_OK`. Recomenda-se habilitar versionamento/Object Lock no provedor quando disponível; o app nunca usa o GitHub Artifact como cofre de backup.


## 1. GitHub

Crie um repositório, envie **todo o projeto V6** e use `main` como branch de produção. O CI deve ficar verde antes do deploy.

A workflow usa Node `22.23.2`, executa os guards de runtime/segurança/qualidade, `npm audit`, typecheck e build. O `package-lock.json` é obrigatório: sem ele, CI e jobs operacionais críticos falham fechado; não existe fallback para `npm install`.

Antes do release final, execute **Actions → Generate package lock → Run workflow**, baixe o artefato `package-lock`, confira `package-lock.sha256`, adicione `package-lock.json` à raiz e valide:

```bash
npm run check:runtime -- --require-lock
npm ci --ignore-scripts
npm run verify
```

Faça commit do lockfile. Não promova a versão final sem esse passo.

## 2. Backup antes de atualizar

Com a `DATABASE_URL` do banco atual:

```bash
npm run db:backup
```

Guarde o arquivo criptografado fora do servidor e valide o backup administrativo verificável com:

```bash
npm run backup:verify -- caminho/do/marques-catalog-v9-schema26-....encrypted.json --strict
```

## 3. Neon

Configure `DATABASE_URL` e aplique:

```bash
npm run db:setup
```

O parser de migração preserva corpos PL/pgSQL e aplica o `sql/schema.sql` corretamente. O schema é idempotente para atualização.

Seed é opcional:

```bash
npm run db:seed
```

Não rode seed em produção se você não quiser itens de demonstração.


### Backup V8 e privacidade em desastre

Depois de aplicar o schema 21, gere imediatamente um backup V8 novo. Ele transporta as tombstones HMAC de `privacy_requests` dentro do envelope criptografado. Em reconstrução completa do Neon, o restore V6.33 mescla essas tombstones antes de restaurar o CRM.

Backups V7 antigos continuam disponíveis para inspeção/compatibilidade, mas não oferecem essa prova isolada de apagamentos em desastre total. Não trate um V7 como substituto de um backup V8 recente após solicitações de anonimização.

## 4. Variáveis obrigatórias

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=...
ADMIN_PASSWORD_HASH=scrypt$...
ADMIN_TOTP_SECRET=BASE32...
NEXT_PUBLIC_SITE_URL=https://SEU-DOMINIO
NEXT_PUBLIC_WHATSAPP_NUMBER=55DDDNUMERO

# Opcional: alertas externos de segurança
ADMIN_SECURITY_WEBHOOK_URL=https://seu-endpoint-seguro.example/webhook
ADMIN_SECURITY_WEBHOOK_SECRET=SEGREDO-ALEATORIO-COM-32-OU-MAIS-CARACTERES
ADMIN_SECURITY_WEBHOOK_EVENTS=
```

Após o primeiro login com TOTP, abra **Admin → Segurança → Recuperação & alertas** e gere os códigos de recuperação. Salve o conjunto imediatamente fora do servidor; os códigos em claro não ficam armazenados no Neon.

Em produção, `ADMIN_PASSWORD_HASH` Scrypt e `ADMIN_TOTP_SECRET` são obrigatórios. `ADMIN_PASSWORD` é somente fallback local e deve ficar vazio no ambiente publicado. Gere o segundo fator com `npm run admin:generate-mfa`, salve o segredo fora do GitHub e cadastre a URI/segredo no seu autenticador antes do primeiro login.

Fallbacks configuráveis pelo painel:

```env
NEXT_PUBLIC_SITE_NAME=Marques Papelaria
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/...
NEXT_PUBLIC_LOCATION=Santa Inês - MA
NEXT_PUBLIC_CONTACT_EMAIL=
```

Verifique antes de publicar:

```bash
npm run check:env -- --production
```

## 5. Storage opcional

```env
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
S3_REQUIRED=
```

Storage não é requisito para o catálogo funcionar; sem ele use URLs de imagem. Se `S3_REQUIRED=1`, falha/ausência do S3 também deixa a readiness vermelha. Se for opcional, um S3 configurado mas indisponível deixa somente o deep health vermelho e bloqueia a promoção pelo deploy gate.

## 6. Web Service no RunSite

Build após o lockfile estar commitado:

```bash
npm ci && npm run build
```

Start:

```bash
npm start
```

O start utiliza a variável `PORT` fornecida pelo ambiente e escuta em `0.0.0.0`; sem `PORT`, usa `8080`.

## 7. Health checks

- Processo vivo: `/api/health?mode=live` — não depende de Neon/S3;
- Produção pronta: `/api/health` — exige Neon, schema runtime 15 e integridade;
- Dependências profundas: `/api/health?mode=deep` — além da readiness, exige que todo storage configurado esteja saudável.

Cada probe possui timeout próprio e retorna latência/estado sem expor credenciais. Na V6.28 a readiness exige schema runtime **18**, incluindo concorrência comercial, CRM/Produção escaláveis e os índices próprios da Agenda. A Central de Operação também mostra release e storage.

## 8. Smoke test pós-deploy

No seu computador ou CI:

```bash
npm run check:live -- https://SEU-DOMINIO
```

Configure no deploy um ID imutável, por exemplo `APP_RELEASE_ID=2026-09-09.1`, e execute também:

```bash
npm run check:deploy -- https://SEU-DOMINIO --release=2026-09-09.1 --previous-release=2026-09-08.4
```

Se o S3 for crítico, acrescente `--require-storage`. O gate coleta múltiplas amostras e falha se releases diferentes responderem durante o rollout. O mesmo gate é executável em **Actions → Verify deployment or rollback target**. Só considere a publicação saudável se smoke test, deploy gate e CI estiverem verdes. Para retorno à versão anterior, siga `ROLLBACK-RUNBOOK.md`.

## 9. Teste funcional final

- abrir home no Android/iPhone e desktop;
- testar menu, busca global, quick view e galeria;
- testar filtro, ordenação e “Carregar mais”;
- testar Concierge;
- montar e compartilhar Minha Lista;
- enviar orçamento uma vez e confirmar apenas um lead no CRM;
- testar login com senha + código TOTP, logout e abrir **Admin → Segurança** para confirmar a sessão atual;
- confirmar que um código TOTP errado é rejeitado e que a senha correta sozinha não abre o painel;
- testar revogação de outra sessão em um segundo navegador/dispositivo;
- editar produto, categoria, FAQ, avaliação e configurações;
- testar conflito editando o mesmo registro em duas abas;
- testar backup e Biblioteca de Mídia; o backup deve pedir confirmação TOTP recente;
- validar o JSON baixado com `npm run backup:verify -- arquivo.json`;
- abrir **Admin → Operação** e confirmar banco/schema/auditoria íntegros e incidentes operacionais;
- alterar temporariamente um contato/configuração e confirmar que o modal de step-up aparece antes da gravação;
- validar sitemap/robots;
- remover dados de teste.

## Atualização V5 → V6

A ordem recomendada é:

1. backup V5;
2. publicar o código V6/CI;
3. executar `db:setup` no Neon;
4. confirmar readiness schema 18;
5. executar smoke test.

A V6 possui fallback temporário em consultas críticas durante a janela de migração, mas o objetivo final é sempre concluir o schema V6.


## Verificação runtime do Neon
Após aplicar ou alterar o schema, execute `npm run db:verify`. A verificação confirma tabelas/colunas críticas, vínculos de categoria, janelas de publicação e estrutura de personalização diretamente no banco. O `npm run db:setup` também executa essa verificação automaticamente ao final.


## Validação funcional adicional
O CI executa `check:public-flow` antes do build e, depois de iniciar o build de produção, roda `check:e2e` em uma instância isolada. No RunSite publicado, mantenha também o `check:live` contra o domínio oficial.


## MFA + sessões administrativas revogáveis
Em produção, a senha correta cria apenas um desafio assinado de 5 minutos. O cookie administrativo definitivo só é emitido após um TOTP válido. A tabela `admin_mfa_used_steps` impede reutilizar a mesma janela TOTP, e `mfa_verified_at` faz sessões antigas sem 2FA falharem fechado. Se o Neon estiver ausente em produção, a autenticação é negada; o único bypass stateless existente é preso ao GitHub Actions para o E2E isolado.

## Step-up para ações críticas e alertas externos
A V6.18 exige um TOTP novo para ações administrativas destrutivas ou de alto impacto. A confirmação é gravada em `admin_sessions.last_reauth_at` e vale por até 5 minutos. Quando a API responde HTTP 428, o painel abre o modal de confirmação e repete a requisição original somente uma vez.

O webhook de segurança é opcional. Se `ADMIN_SECURITY_WEBHOOK_URL` estiver definido em produção, use somente HTTPS público e configure também `ADMIN_SECURITY_WEBHOOK_SECRET` com pelo menos 32 caracteres. O receptor deve validar `x-marques-timestamp` e `x-marques-signature` (`sha256=<HMAC do corpo>`). Sem webhook, os alertas continuam disponíveis na Central de Segurança.

## Sessões administrativas revogáveis
Após `db:setup`, novos logins administrativos são registrados em `admin_sessions`. O logout revoga a sessão no Neon e **Admin → Segurança** permite encerrar outros dispositivos. Sessões emitidas por versões anteriores à V6.15 são invalidadas pelo novo formato e exigem novo login. Não prenda a autenticação ao IP: o sistema registra apenas um hash HMAC da rede para auditoria futura e vincula o token ao User-Agent, evitando bloqueios normais ao alternar Wi‑Fi/4G.


## Observabilidade, auditoria e recuperação V6.19
Falhas tratadas pelas APIs são agrupadas no Neon em `operational_incidents`. A Central de Operação exibe frequência, última referência e estado do incidente. Marcar um incidente como resolvido exige step-up TOTP; uma nova ocorrência com o mesmo fingerprint reabre o incidente automaticamente.

A tabela `admin_audit_log` é append-only no PostgreSQL e cada entrada recebe `integrity_hash`. O painel verifica tanto os hashes quanto a presença do trigger de imutabilidade. Não desative esses triggers em produção.

Os backups administrativos V7 incluem `manifest.content_sha256`. Antes de usar um arquivo como evidência de recuperação, rode `npm run backup:verify -- arquivo.json`; um backup modificado deve falhar.


## Restauração segura V6.20

1. antes de restaurar, confirme `/api/health` com `schema >= 18`;
2. em **Admin → Operação**, selecione o JSON e execute o dry-run;
3. revise SHA-256, schema e diferenças de contagem;
4. ao aplicar, conclua o step-up TOTP e digite `RESTAURAR`;
5. o banco cria um snapshot automático dentro da mesma transação antes de substituir os dados;
6. mantenha o snapshot até conferir catálogo, CRM, configurações e analytics;
7. se necessário, use **Reverter** e confirme `REVERTER`.

Via terminal, `npm run db:restore -- arquivo.json` faz somente dry-run. A alteração real exige simultaneamente `--apply --confirm=RESTAURAR`. A restauração não substitui a trilha de auditoria nem as tabelas de segurança.


## V6.24 — CRM escalável, concorrência e performance

Após publicar e aplicar `npm run db:setup`, o readiness deve reportar **schema 15**. Rode `npm run check:performance`, `npm run check:commercial` e `npm run check:scalable-crm` no CI. No alvo publicado, use `npm run check:load -- https://DOMINIO --requests=24 --concurrency=4 --p95=3000`. O workflow **Verify deployment or rollback target** pode executar o smoke de carga automaticamente depois do gate.

No Admin, valide que a primeira carga mostra todos os atendimentos ainda operacionais, que o botão **Carregar mais histórico** pagina somente registros encerrados e que KPIs/Estúdio/Campanhas permanecem iguais antes e depois de carregar páginas antigas.

## V6.25 — busca global do CRM e inteligência de cliente

O schema continua em **15**. Após o deploy, confirme que uma busca por nome/WhatsApp de um atendimento antigo funciona antes de carregar todas as páginas do histórico. A consulta usa POST autenticado e não deve colocar o termo pesquisado na URL. Também valide um cliente com mais de um pedido: o selo de recorrência e o LTV fechado devem refletir todo o histórico, não apenas os cards carregados. Rode `npm run check:crm-search` junto com `check:scalable-crm`.


## V6.27 — Agenda escalável e calendário operacional

Depois de publicar, rode `npm run db:setup` e `npm run db:verify`; o health deve reportar **schema 17**. O CI precisa passar `npm run check:agenda-scale`. Abra a aba Agenda, alterne entre 30/60/90/180 dias e confirme eventos, retornos, produção, publicações e conteúdos. A migração é aditiva: apenas dois índices parciais novos, sem remoção de dados.

## V6.26 — Produção escalável e pós-venda

Depois de publicar, rode `npm run db:setup` e `npm run db:verify`; o health deve reportar **schema 16**. O CI precisa passar `npm run check:production-scale`. Abra a aba Produção e confirme: fila aberta completa, métricas globais, pós-venda pendente e histórico entregue com “Carregar mais”. A mudança de schema é aditiva (dois índices parciais), sem remoção de dados.



## V6.28 — Reativação global e ciclo anual

Depois de publicar, rode `npm run db:setup` e `npm run db:verify`; o health deve reportar **schema 18**. O CI precisa passar `npm run check:reactivation`. Abra **Orçamentos → Oportunidades de recompra** e confirme que a contagem vem do Neon, que o botão **Carregar mais reativações** pagina a fila e que **Reativar cliente** registra o ciclo antes de abrir o WhatsApp. A migração adiciona duas colunas anuláveis, uma função de calendário e dois índices; não remove dados existentes.


## V6.29 — aplicar a cadeia de auditoria

Antes do deploy, faça backup e então execute `npm run db:setup` + `npm run db:verify`. O health deve reportar **schema 19**. A migração encadeia automaticamente registros administrativos antigos que ainda estejam em `chain_version=0`; depois desse primeiro backfill, divergências não são auto-reparadas por novos `db:setup`. Confirme em **Admin → Operação** que append-only, cadeia e âncora estão verdes.


## V6.30 — privacidade e tombstones de restore

Antes do deploy, configure um segredo **estável** e diferente de senha/TOTP:

```env
PRIVACY_HASH_SECRET=gere-um-segredo-aleatorio-com-pelo-menos-32-caracteres
```

Não rotacione esse segredo sem um plano de migração, porque ele ancora os HMACs usados para impedir que backups antigos reintroduzam identidades já anonimizadas.

Depois execute:

```bash
npm run db:backup
npm run db:setup
npm run db:verify
npm run check:privacy
```

O health deve reportar **schema 20**. Teste em staging **Admin → Privacidade**: busca exata, exportação com step-up MFA e anonimização de um registro terminal de teste. Em seguida faça dry-run de um backup anterior e confirme o aviso de sanitização por tombstone. Backups JSON guardados fora do app não são apagados automaticamente; aplique sua política de retenção neles separadamente.


## V6.31 — chave de assinatura dos backups

A V6.31 não altera o schema (continua **20**), mas adiciona um segredo obrigatório de produção:

```env
BACKUP_SIGNING_SECRET=gere-com-openssl-rand-base64-48
BACKUP_SIGNING_KEY_ID=2026-q3
```

Antes de promover o release, gere um backup novo e valide:

```bash
npm run db:backup
npm run backup:verify -- backups/ARQUIVO.json --require-signature
npm run check:backup-auth
```

Rotação: mova temporariamente a chave antiga para `BACKUP_SIGNING_PREVIOUS_SECRET`, configure a nova em `BACKUP_SIGNING_SECRET`, altere `BACKUP_SIGNING_KEY_ID` e gere backups novos. Não remova a chave anterior antes do fim da retenção dos backups que ainda dependem dela.

Backups V6.19–V6.30 sem assinatura devem ser inspecionados em staging; não são aceitos silenciosamente pelo restore de produção da V6.31.


## V6.32 — criptografia de backup

A V6.32 mantém schema **20** e adiciona uma segunda chave operacional:

```env
BACKUP_ENCRYPTION_SECRET=gere-com-openssl-rand-base64-48
BACKUP_ENCRYPTION_KEY_ID=2026-q3
```

A chave de assinatura e a chave de criptografia devem ser diferentes. Gere um backup no ambiente de staging e valide:

```bash
npm run db:backup
npm run backup:verify -- backups/ARQUIVO.encrypted.json --strict
npm run check:backup-encryption
```

Abra o arquivo exportado e confirme que nomes, telefones e mensagens não aparecem em claro. Para rotação, use temporariamente `BACKUP_ENCRYPTION_PREVIOUS_SECRET`; remova a chave antiga somente após o fim da retenção dos envelopes que dependem dela.

## V6.36 — Recovery drill
Configure `DRILL_DATABASE_URL` como secret do GitHub apontando para um Neon isolado e `RECOVERY_DRILL_ENABLED=1` como Repository Variable. O workflow semanal baixa o último backup privado, restaura no drill e registra o recibo de sucesso no Neon operacional.

## V6.37 — Media backup
Configure `MEDIA_BACKUP_ENABLED=1` como Repository Variable. O workflow usa as credenciais do S3 público somente para leitura e as credenciais do bucket privado para gravar o espelho.
