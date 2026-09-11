### Manutenção V6.50 — Cross-System Media Lease & Verified Completion (2026-09-10)
- o lifecycle de mídia passa a atravessar **PostgreSQL + S3** com leases tokenizadas: upload/delete adquirem a geração antes do I/O externo e só finalizam se o mesmo token continuar vigente;
- o **schema 27** adiciona `media_lifecycle_leases`, campos operacionais nos tombstones e funções begin/complete/fail/cancel; atalhos V6.48/V6.49 inseguros são removidos;
- `PutObject` é confirmado por `HeadObject` (bytes + `content-sha256`) antes de retirar a quarentena; `DeleteObject` só conclui depois de confirmar ausência do objeto;
- falha parcial mantém tombstone/quarentena e código operacional seguro, sem persistir mensagem arbitrária de SDK; leases expiradas ficam visíveis ao deep-health e não são apagadas por operações de outras mídias;
- restore do banco usa lock global compartilhado com o início das operações de mídia e recusa `MEDIA_LIFECYCLE_ACTIVE`; o DR de mídia também adquire lease, revalida tombstone sob serialização e cancela sem efeito quando a exclusão é intencional;
- **Backup V9 permanece o formato atual**: tombstones permanentes continuam assinados, mas `media_lifecycle_leases` é estado transitório e nunca entra no backup/restore;
- app **6.50.0**, schema runtime **27**, migração aditiva com fail-closed deliberado para caminhos antigos de mutação de mídia.

### Manutenção V6.49 — DR Namespace Isolation & Remote Backup Attestation (2026-09-10)
- backup offsite do banco deixa de compartilhar a raiz operacional com o espelho de mídia: novos objetos usam `${BACKUP_S3_PREFIX}/database/YYYY/MM/...`, enquanto mídia continua em `${BACKUP_S3_PREFIX}/media/...`;
- retenção automática fica confinada a objetos reconhecidos como backup de banco e não pode mais excluir objetos do espelho `media/`;
- recovery drill procura primeiro o namespace `database/`, ignora mídia mesmo quando ela possui `LastModified` mais recente e mantém fallback somente para backups legados reconhecíveis no layout antigo;
- upload offsite deixa de gravar metadata fixa `v8-privacy-safe`: o formato real (`marques-catalog-v8/v9`), schema, SHA-256 do conteúdo e SHA-256 do envelope são extraídos do backup já verificado e confirmados novamente via `HeadObject`;
- recovery drill relê `envelope-sha256`, `backup-contract`, `schema-version` e `content-sha256` e confronta a attestation remota com o conteúdo descriptografado/assinado antes de restaurar;
- novo `lib/dr-storage-policy.ts` centraliza TLS, destino externo, validação de bucket e isolamento de targets para backup do banco, espelho de mídia, restore e drills; scripts deixam de depender apenas do `check:env` para bloquear endpoint HTTP/privado;
- `check:dr-storage` e self-test cobrem endpoint inseguro, destino local, buckets iguais, namespace `database/`, retenção que não toca mídia e seleção correta do último backup; CI/`verify` passam a exigir o novo contrato;
- app **6.49.0**, schema runtime permanece **26**.

### Manutenção V6.48 — Race-Safe Media Lifecycle & Repairable DR (2026-09-10)
- exclusão de mídia passa a aceitar somente URLs canônicas do namespace gerenciado `catalog/`; origem externa, query/fragmento, encoding ambíguo e chaves fora do prefixo são rejeitados antes de qualquer `DeleteObject`;
- configuração S3 inválida fica fail-closed: em produção endpoint/base pública exigem HTTPS sem credenciais embutidas, query ou fragmento; deep health passa a degradar também configuração inválida;
- checagem de referência de mídia deixa de retornar `false` em erro do Neon: indisponibilidade do banco bloqueia exclusão em vez de assumir arquivo sem uso;
- schema **26** adiciona `media_deletion_tombstones`, advisory locks por URL/chave e triggers em produtos, categorias e configurações para impedir nova referência durante a janela de exclusão;
- `marques_reserve_media_delete()` faz reserva transacional antes do Storage; se a mídia estiver em uso retorna conflito, e se o `DeleteObject` falhar o tombstone permanece fail-closed para retry seguro;
- reupload content-addressed limpa o tombstone somente depois de `PutObject` bem-sucedido, reativando a URL apenas quando o objeto voltou a existir;
- deep integrity detecta qualquer produto/categoria/logo/hero ainda apontando para mídia tombstonada e impede que a violação fique silenciosa;
- backup/drill passam a validar chaves do namespace gerenciado e o restore offsite exige Neon/schema 26 em `--apply`, pula chaves tombstonadas para não ressuscitar exclusões intencionais e verifica SHA-256 também de objetos já existentes, detectando/reparando conteúdo divergente;
- backup atual sobe para **V9 (`marques-catalog-v9`)** no schema 26: `media_deletion_tombstones` viajam dentro do conteúdo coberto por SHA-256 + HMAC, enquanto V7/V8 permanecem legíveis como formatos legados;
- restore externo usa merge monotônico de tombstones de mídia (estado atual + backup, com o estado atual prevalecendo na mesma chave); snapshots internos de rollback usam modo `exact`, evitando perda de deleções novas sem impedir reversão fiel;
- o `plan_hash` de restore incorpora o conjunto efetivo de tombstones; exclusão ocorrida entre dry-run e apply invalida o plano e exige nova análise; backup V9 que ainda referencia mídia tombstonada é rejeitado;
- `backup:verify` agora reporta explicitamente o estado de disaster recovery de mídia, e o limite do seletor de restore no Admin foi alinhado ao envelope criptografado real de **36 MB**;
- novo `check:media-lifecycle` com self-test de namespace, canonicalização, S3 seguro, tombstones, locks e restore reparador; CI/`verify` passam a exigir o contrato;
- app **6.48.0**, schema runtime sobe de **25** para **26** por migração aditiva.

### Manutenção V6.47 — Idempotent Admin Creates & Selective Retry (2026-09-10)
- criações administrativas de produto, categoria, avaliação, FAQ, campanha e planejamento social passam a exigir `Idempotency-Key` UUID e usam ID determinístico por `scope + key`;
- `INSERT ... ON CONFLICT DO NOTHING` + leitura do ID determinístico faz retries concorrentes convergirem para o mesmo registro; reuso da mesma chave com payload diferente falha com **409**;
- respostas de replay retornam `deduplicated:true` e não duplicam a entrada de auditoria de criação; a chave é usada como `request_id` do audit quando o insert é realmente novo;
- `fetchJson()` adiciona chave apenas às rotas de criação explicitamente retry-safe, repete uma vez em `408/502/503/504` e preserva a mesma chave após resultado incerto;
- chave pendente sobrevive a reload da aba por até 2 horas em `sessionStorage`, indexada por fingerprint do request sem armazenar o payload completo; após sucesso ou erro definitivo ela é removida;
- `ApiRequestError` passa a carregar `reauthRequired`; HTTP **428** só aciona step-up MFA quando a resposta contém `reauth_required:true`, evitando confundir precondição de concorrência/idempotência com autenticação;
- CI passa a executar explicitamente tanto `check:replay-safety` quanto o novo `check:idempotency`;
- app **6.47.0**, schema permanece **25**.

### Manutenção V6.46 — Bounded Binary Ingress, Atomic Bulk & Replay-Safe Media (2026-09-10)
- `readBytesBodyWithinLimit()` passa a ser o primitive comum de ingresso: contabiliza bytes reais, cancela streams acima do orçamento e serve texto e multipart sem confiar em `Content-Length`;
- upload administrativo deixa de chamar `request.formData()` diretamente e só faz parse de multipart depois de o envelope completo caber no limite; restore deixa de chamar `request.text()` diretamente e limita o envelope criptografado a **36 MB** antes da descriptografia;
- lotes de produtos deixam de usar apenas IDs: UI/API enviam `id + updated_at`, e `bulkUpdateProducts()` usa `jsonb_to_recordset` + CAS all-or-none; qualquer item stale cancela o lote inteiro com **409**;
- `StaleWriteError` aceita mensagem contextual mantendo o fallback padrão;
- upload de mídia troca chave aleatória por endereço de conteúdo `catalog/sha256/<prefixo>/<sha256>.<ext>`; retry do mesmo arquivo converge para o mesmo objeto e o audit registra hash, tamanho e media type;
- novo `lib/media-key.ts`, `check:replay-safety` e self-test executável; `check:http-boundary` e `check:concurrency` passam a exigir também bounded multipart/restore e lote atômico;
- app **6.46.0**, schema permanece **25**.

### Manutenção V6.45 — Bounded Ingress & Safe Concurrency (2026-09-10)
- `readJsonBody()` deixa de materializar corpos arbitrários antes do limite: `readTextBodyWithinLimit()` contabiliza bytes em streaming, cancela o reader ao exceder o orçamento e protege também requests chunked sem `Content-Length`;
- JSON administrativo exige media type `application/json` ou `application/*+json`; payload inválido, media type incorreto, corpo acima do limite e precondição ausente retornam `400/415/413/428` sem gerar incidente operacional 5xx falso;
- rate limit administrativo passa a usar dois buckets distribuídos: limite por cliente + teto global por escopo, reduzindo bypass por rotação/spoofing de `X-Forwarded-For`;
- compare-and-swap temporal passa a ser obrigatório para produto, arquivamento/restauração/exclusão definitiva, categoria, avaliação, planejamento social, campanha, FAQ e configurações gerais;
- exclusão permanente de atendimento/orçamento passa a exigir `expected_version` e usa o contador monotônico do CRM no `DELETE`; ações com tela desatualizada retornam `409` em vez de apagar estado novo;
- novo `lib/concurrency.ts`, `check:concurrency` e self-tests executáveis validam precondições `updated_at`/`version`, resposta `428` quando ausentes e contrato de stale write;
- `check:http-boundary` cobre leitura streaming, media type e teto global anti-spoof; CI/`verify` passam a exigir também o contrato de concorrência;
- app **6.45.0**, schema permanece **25**.

### Manutenção V6.44 — Trusted Request Boundary & Nonce Admin CSP (2026-09-10)
- autoridade CSRF de produção deixa de confiar em `x-forwarded-host`/`x-forwarded-proto` e passa a derivar exclusivamente de `NEXT_PUBLIC_SITE_URL` validado; desenvolvimento continua usando a origem efetiva da requisição;
- novo `lib/request-origin.ts` e self-test executável provam rejeição de origem cruzada, `Origin: null`, `Referer` hostil e spoofing de headers forwarded;
- `/admin` recebe CSP específica por requisição via `proxy.ts`, com nonce criptográfico, `strict-dynamic`, `script-src-attr 'none'`, `no-store` e `X-Robots-Tag: noindex`; login administrativo passa a renderização dinâmica para suportar nonce;
- upload administrativo valida `multipart/form-data`, boundary e `Content-Length` antes de `request.formData()`, com orçamento de envelope e resposta `413` para payload/arquivo acima do limite;
- E2E, live-check e deploy gate validam CSP com nonce, ausência de `'unsafe-inline'` em scripts do Admin, cache `no-store` e `noindex`;
- headers globais ganham `script-src-attr 'none'`, `frame-src 'none'`, `X-Permitted-Cross-Domain-Policies: none` e `Origin-Agent-Cluster: ?1`;
- novo `check:http-boundary` entra no `verify` e no CI, cobrindo origem confiável, limites de request e CSP administrativa;
- app **6.44.0**, schema permanece **25**.

### Manutenção V6.43 — Platform Contract, URL Safety & Proven Lockfile (2026-09-10)
- novo `platform-contract.json` centraliza schema **25**, Node **22.23.2**, npm **10.9.8**, runner `ubuntu-24.04` e a imagem Docker pinada por digest;
- novo `check:platform` impede drift entre `.nvmrc`, `packageManager`, Docker, workflows, release manifest, deploy gate e detector de schema;
- workflows deixam `ubuntu-latest` e passam a runner major versionado; `npm ci` e Docker usam `--ignore-scripts`, com `ignore-scripts=true` também no `.npmrc`;
- **Generate package lock** passa a provar o lock recém-gerado com instalação real, `check:deps`, `npm audit` e SHA-256 antes do upload;
- novo `lib/public-url.ts` rejeita HTTP externo, protocol-relative (`//...`), credenciais embutidas e protocolos não HTTPS;
- validação administrativa separa URLs internas/HTTPS de assets e links externos HTTPS de redes sociais;
- leitura do Neon normaliza URLs de produtos, categorias e configurações, protegendo também registros legados anteriores à V6.43;
- `NEXT_PUBLIC_SITE_URL` e fallbacks sociais também são normalizados antes de uso em metadata/links;
- novo `check:url-safety` testa os vetores e verifica integração nos boundaries de entrada, ambiente e banco;
- app **6.43.0**, schema permanece **25**.

### Manutenção V6.42 — Hardened Runtime, Minimal Container & Executable Contracts (2026-09-09)
- runtime reproduzível atualizado para Node **22.23.2** / npm **10.9.8**; `.nvmrc`, package manager e Docker permanecem sincronizados;
- Docker pinado por digest imutável, sem fallback `npm install`, com build Next `standalone`, usuário `node` no runtime e remoção de gerenciadores de pacote do estágio final;
- `getReleaseInfo()` restaurado e centralizado em `lib/release.ts`; health, operações, release manifest e deploy gate passam a derivar a identidade da mesma autoridade;
- novo `check:module-surface` cruza imports locais com exports, detecta símbolos inexistentes e bindings duplicados antes do build;
- corrigido import duplicado/inválido de `requireCriticalAuditIntent` na rota administrativa de mídia;
- corrigida inferência de tupla em `lib/backup-signature.ts`, eliminando erro TypeScript real na ordenação canônica dos contadores;
- `getSitemapProducts()` agora normaliza o boundary SQL e expõe retorno explícito, evitando `unknown` em `new Date()` durante a geração do sitemap;
- `check:release` agora executa `lib/release.ts`, e `check:runtime` valida também a versão efetiva do npm em CI;
- Dependabot passa a cobrir também Docker e a documentação operacional ganha contrato de sincronização;
- app **6.42.0**, schema permanece **25**.

### Manutenção V6.41 — Immutable Actions & Credential-Minimized CI (2026-09-09)

- todos os GitHub Actions usados pelos workflows passam a ser pinados por **commit SHA completo**, mantendo comentário com a release humana auditada;
- `actions/checkout` usa `persist-credentials: false` em todos os jobs atuais, reduzindo a janela de exposição do `GITHUB_TOKEN` no workspace;
- `check:supply-chain` passa a bloquear tags/branches mutáveis, SHAs divergentes, Actions fora do allowlist e regressão de credenciais persistidas;
- releases oficiais auditadas nesta versão: checkout **v7.0.1**, setup-node **v7.0.0**, upload-artifact **v7.0.1**;
- o `package-lock.json` continua obrigatório para execução dos workflows críticos; como o pacote recebido ainda não contém o arquivo, o release/deploy permanece bloqueado até sua geração real no workflow dedicado;
- app **6.41.0**, schema permanece **25**.

### Manutenção V6.40 — Reproducible Supply-Chain Gate (2026-09-09)

- workflows críticos deixam de usar fallback `npm install`: `package-lock.json` passa a ser pré-requisito fail-closed para CI, backup e drills;
- apenas o workflow **Generate package lock** pode gerar o lockfile sem lock prévio;
- dependências diretas continuam fixadas em versões exatas;
- GitHub Actions oficiais foram atualizadas para releases exatas atuais (`checkout` 7.0.1, `setup-node` 7.0.0 e `upload-artifact` 7.0.1);
- permissões `contents: read` ficam explícitas nos workflows;
- Dependabot semanal monitora npm e GitHub Actions;
- novo `check:supply-chain`; app **6.40.0**, schema permanece **25**.

### Manutenção V6.39 — Automated Media Recovery Drill (2026-09-09)

- adiciona ensaio semanal real de restauração da mídia em bucket S3 isolado;
- restaura objetos do cofre offsite em prefixo temporário, relê e compara SHA-256 antes de considerar sucesso;
- destino de drill não pode coincidir com bucket público nem com o cofre de backup;
- objetos temporários são removidos ao final;
- resultado bem-sucedido gera recibo append-only `media_recovery_drill_receipts`;
- deep health/Admin expõem freshness do ensaio; deploy gate pode exigir `--require-media-recovery-drill-fresh`;
- novo `check:media-recovery-drill`; app **6.39.0**, schema runtime **25**.

### Manutenção V6.38 — Guaranteed Critical Audit (2026-09-09)

- ações administrativas críticas agora exigem um **audit intent persistido** antes da mutação;
- se a trilha encadeada não puder ser gravada no Neon, a operação crítica falha fechado antes de excluir, restaurar, anonimizar, revogar ou alterar dados sensíveis;
- intents usam a mesma cadeia tamper-evident/append-only da auditoria administrativa;
- operações não críticas mantêm logging best-effort para não degradar disponibilidade;
- novo `check:critical-audit` protege helper, rotas críticas e integração com CI/runtime;
- app sobe para **6.38.0**; schema runtime permanece **24** (sem migração nova).

### Manutenção V6.37 — Media Asset Disaster Recovery (2026-09-09)
- espelho diário dos objetos `catalog/` para bucket privado separado;
- SHA-256 por objeto com leitura de volta do backup remoto;
- recibos append-only de cobertura de mídia;
- restore de mídia em dry-run por padrão e aplicação somente com `--apply --confirm=RESTAURAR-MIDIA`;
- restore repõe somente objetos ausentes e verifica SHA-256 antes/depois;
- health/Admin sinalizam freshness do espelho; schema runtime sobe para 24.

### Manutenção V6.36 — Automated Recovery Drill (2026-09-09)
- workflow semanal restaura o backup offsite mais recente em Neon separado;
- verificação strict, restore real e `db:verify` antes de registrar sucesso;
- proteção contra uso do mesmo host do banco operacional;
- recibos append-only em `recovery_drill_receipts`;
- health/Admin expõem freshness do drill; deploy gate opcionalmente exige `--require-recovery-drill-fresh`;
- schema runtime sobe para 23.

### Manutenção V6.36 — Backup Freshness & Recovery Readiness (2026-09-09)

- novo `offsite_backup_receipts`, append-only, para registrar somente backups remotos efetivamente verificados;
- job offsite valida schema 24 antes de gerar/uploadar, evitando execução parcial sem capacidade de registrar o recibo;
- novo `BACKUP_OFFSITE_MAX_AGE_HOURS` (24–720 h; padrão 36);
- Central de Operação e banner administrativo mostram backup recente, ausente, stale ou indisponível;
- deep health expõe `backup_freshness` sem tirar a disponibilidade do catálogo público;
- deploy gate ganha `--require-backup-fresh` para promoção opcionalmente fail-closed;
- novos `check:backup-freshness` + self-test;
- app sobe para **6.37.0** e schema runtime para **22**.

### Manutenção V6.34 — Automated Offsite Backup Rotation (2026-09-09)

- novo `backup:offsite`: gera backup V8 assinado/criptografado em diretório temporário e envia para bucket S3 privado separado;
- verificação strict do backup antes do upload + verificação pós-upload em três camadas: `Content-MD5`, `HeadObject` (tamanho + SHA em metadata) e `GetObject` com SHA-256 streaming dos bytes remotos;
- retenção automática configurável de 7 a 3650 dias, preservando sempre o backup criado na execução atual;
- novo workflow diário `.github/workflows/offsite-backup.yml`, também executável manualmente, sem armazenar backup como GitHub Artifact;
- preflight rejeita endpoint local/privado, configuração parcial, retenção insegura e reutilização do mesmo bucket público de mídia;
- novos `check:offsite-backup` e self-test; CI/verify passam a exigir o contrato;
- app sobe para **6.34.0**; schema runtime permanece **21**.

### Manutenção V6.33 — Privacy-Safe Disaster Recovery (2026-09-09)

- formato interno sobe para `marques-catalog-v8`, mantendo leitura compatível de V7;
- backups V8 levam `privacy_tombstones` HMAC dentro do envelope AES-256-GCM e da assinatura HMAC do backup;
- restore API/CLI une tombstones atuais + embutidas antes de sanitizar o CRM;
- PostgreSQL recebe as tombstones como quarto argumento e as mescla em `privacy_requests` dentro da mesma transação de restore;
- recuperação após reconstrução completa do Neon preserva apagamentos conhecidos pelo backup;
- V7 legado continua legível, mas emite aviso explícito de que não contém vault de privacidade;
- novo `check:privacy-dr` + self-test simulando banco vazio e reintrodução de PII;
- app sobe para 6.33.0 e schema runtime para **21**.

### Manutenção V6.32 — Encrypted Backup Vault (2026-09-09)

- backups novos são encapsulados em envelope **AES-256-GCM** antes de sair do servidor;
- HKDF-SHA256 deriva uma chave por backup usando salt aleatório; IV de 96 bits e tag GCM protegem confidencialidade + integridade do envelope;
- o backup interno continua assinado por HMAC-SHA256, formando duas camadas: criptografia externa + autenticidade interna;
- produção exige `BACKUP_ENCRYPTION_SECRET` com 32+ caracteres; rotação usa temporariamente `BACKUP_ENCRYPTION_PREVIOUS_SECRET`;
- Admin e `db:backup` exportam somente envelope cifrado; restore HTTP de produção e `db:restore --apply` exigem criptografia;
- `backup:verify -- --strict` exige simultaneamente AES-GCM + assinatura HMAC;
- novo `check:backup-encryption` prova PII não visível, adulteração/AAD rejeitados, aleatoriedade e rotação;
- app sobe para 6.32.0; schema runtime permanece **20**.

### Manutenção V6.31 — Signed Backup Authenticity (2026-09-09)

- backups do Admin e `db:backup` agora recebem assinatura **HMAC-SHA256** sobre hash do conteúdo, schema, data e contagens;
- SHA-256 continua detectando corrupção acidental, enquanto a assinatura impede que alguém altere o arquivo e simplesmente recalcule o SHA sem possuir a chave;
- produção exige `BACKUP_SIGNING_SECRET` estável com 32+ caracteres; `BACKUP_SIGNING_KEY_ID` identifica a chave sem expor segredo;
- rotação segura aceita temporariamente `BACKUP_SIGNING_PREVIOUS_SECRET` para validar arquivos assinados pela chave anterior;
- restore HTTP em produção e `db:restore --apply` exigem autenticidade; backups antigos sem assinatura permanecem disponíveis para inspeção/dry-run em staging;
- `backup:verify -- --require-signature` valida integridade + autenticidade;
- novo `check:backup-auth` e self-test simulam adulteração com SHA recalculado, rotação e backup legado unsigned;
- app sobe para 6.31.0 e o schema runtime permanece **20**.

### Manutenção V6.30 — Privacy & Data Lifecycle (2026-09-09)

- nova Central de Privacidade com busca exata por WhatsApp/e-mail, exportação e anonimização protegidas por step-up MFA;
- tombstones HMAC em `privacy_requests` preservam pedidos de apagamento sem guardar identificadores em texto puro;
- anonimização transacional remove PII, timeline e personalizações, mantendo somente métricas comerciais necessárias;
- restore API/CLI reaplica tombstones para impedir que backups antigos reintroduzam identidades já anonimizadas;
- `PRIVACY_HASH_SECRET` estável, `check:privacy` e schema runtime **20**.

### Manutenção V6.29 — Tamper-Evident Admin Audit Chain (2026-09-09)

- trilha administrativa passa de hashes independentes para cadeia SHA-256 por ID;
- novo `prev_integrity_hash`, `chain_version` e `admin_audit_chain_state` para detectar remoção/reordenação/truncamento;
- inserts de auditoria são serializados dentro da transação e avançam a âncora somente após o insert;
- migração de logs antigos ocorre uma única vez; reruns de schema não mascaram adulteração posterior;
- health, `db:verify` e Central de Operação passam a validar a cadeia completa e a âncora final;
- novo `check:audit-chain` + self-test no CI; schema runtime 19.

### Manutenção V6.28 — Global Reactivation & Annual Customer Lifecycle (2026-09-09)

- fila global de recompra/recontato anual consultada diretamente no Neon, sem depender do histórico paginado do CRM;
- deduplicação por WhatsApp e paginação por cursor `next_anniversary + id`;
- tratamento de 29/02 em anos não bissextos;
- ciclo anual persistido em `repurchase_contacted_at` + `repurchase_contact_year`, evitando contato duplicado na virada do ano;
- registro atômico do recontato na timeline antes da abertura do WhatsApp;
- nova rota administrativa protegida por sessão, same-origin e rate limit;
- schema runtime 18, dois novos índices e função SQL de aniversário;
- `check:reactivation` + self-test integrados ao CI/verify.

### Manutenção V6.27 — Scalable Agenda & Operational Calendar (2026-09-09)
- Agenda deixa de montar eventos a partir do `inquiries` paginado do navegador e passa a consultar uma API administrativa dedicada.
- Janela server-side limitada a 30/60/90/180 dias reúne eventos, follow-ups, produção, produtos e conteúdos planejados diretamente no Neon.
- Produção atrasada dos últimos 90 dias permanece no calendário para não ocultar pendências vencidas.
- Agenda passa a carregar sob demanda, com loading, erro/retry e KPIs globais do período; exportação `.ics` usa a fonte completa retornada.
- Novos índices `idx_inquiries_event_agenda` e `idx_inquiries_follow_up_agenda`; schema runtime sobe para 17.
- Novo `check:agenda-scale` + self-test de janelas, exigidos por CI/verify/runtime contract.

### Manutenção V6.26 — Scalable Production & Post-sale (2026-09-09)
- Produção deixa de depender do lote paginado do CRM: a aba consulta uma workspace própria no Neon somente quando é aberta.
- Fila aberta de produção é carregada globalmente e ordenada por prazo/evento; KPIs de atraso, aprovação, pronto, sem sinal e entregas são agregados no PostgreSQL.
- Histórico de entregues passa a usar cursor opaco por `updated_at + id`, com carregamento incremental.
- Pós-venda ganha fila global de avaliações ainda não solicitadas, integrada ao WhatsApp e ao registro `review_requested_at`.
- Novos índices `idx_inquiries_delivered_history` e `idx_inquiries_post_sale_pending`; schema runtime sobe para 16.
- Novo `check:production-scale` e self-test do cursor, exigidos pelo CI/verify.

### Manutenção V6.25 — CRM Global Search & Customer Intelligence (2026-09-09)

- busca do CRM passa a consultar o histórico completo no servidor, sem depender das páginas terminais já carregadas no navegador;
- nova rota POST autenticada/same-origin `/api/admin/inquiries/query` evita colocar nome/telefone em query string e aplica rate limit administrativo;
- busca cobre nome, WhatsApp, e-mail, produto, categoria, mensagem, notas, briefing e itens, com limite de resultados e debounce no cliente;
- resultados remotos são incorporados ao workspace local para permitir edição, seleção e ações já existentes;
- inteligência de cliente passa a agregar no PostgreSQL pedidos, fechamentos, LTV fechado e última solicitação por WhatsApp;
- bootstrap, paginação histórica e busca retornam `customer_stats`, mantendo identificação de cliente recorrente mesmo com histórico paginado;
- após mutações do CRM, o painel atualiza os agregados do cliente pelo servidor;
- novo `check:crm-search` protege autenticação, privacidade da busca, debounce e independência da paginação; CI passa a exigir também `check:scalable-crm`;
- schema runtime permanece **15**.

### Manutenção V6.24 — Scalable CRM & Global Commercial Analytics (2026-09-09)

- CRM deixa de esconder atendimentos relevantes por `LIMIT 500`: todos os registros que ainda exigem ação entram no workspace administrativo;
- histórico terminal (`fechado`/`perdido` sem pendências) passa a usar paginação por cursor opaco `(created_at,id)` e carregamento incremental;
- KPIs comerciais globais passam para agregações PostgreSQL e deixam de depender do conjunto carregado no navegador;
- Visão Geral recebe insights de origem/campanha globais por período (7/30/90 dias);
- Estúdio de divulgação e Campanhas deixam de calcular resultados sobre o lote paginado e usam agregação all-time do banco;
- nova API administrativa `/api/admin/inquiries` oferece `summary`, `insights`, `marketing` e `history` com cache privado desativado;
- novos índices `idx_inquiries_terminal_history` e `idx_inquiries_open_attention` aceleram histórico e fila operacional;
- novo `check:scalable-crm` + self-test de cursor protegem paginação, agregações globais, índices e rejeição de cursor inválido;
- schema runtime sobe para **15**.

### Manutenção V6.23 — Commercial Resilience & CRM Concurrency (2026-09-09)

- CRM recebe `inquiries.version` monotônica; PATCH individual usa `expected_version` e rejeita gravações stale com HTTP 409;
- operações em lote recebem `{id,version}` e são all-or-none no mesmo comando SQL, sem atualização parcial quando um item está desatualizado;
- criação/edição/revisão do atendimento grava timeline na mesma operação SQL do estado principal, evitando estado sem histórico quando uma etapa falha;
- trigger PostgreSQL protege combinações comerciais de pagamento/valor/produção e incrementa a versão em toda alteração;
- indisponibilidade do Neon no orçamento público pode degradar para contingência HTTP 202 + WhatsApp, preservando lista, personalizações e idempotency key para retry;
- backup do painel deixa de reutilizar limites de tela e passa a exportar todas as linhas em modo estrito/fail-fast; CLI e painel usam a mesma ordem canônica de conteúdo para SHA-256;
- verificador aceita backups V6.19–V6.22 com a ordem SHA histórica e alerta sobre conferência de contagens antes da restauração;
- restore normaliza versões antigas para uma geração superior, invalidando abas stale após recuperação e mantendo compatibilidade com backups anteriores ao schema 14;
- `checkDataIntegrity`/`db:verify` passam a detectar versão inválida e estado comercial incoerente; novo `check:commercial` protege o contrato no CI;
- schema runtime sobe para **14**.

### Manutenção V6.22 — Concurrency & Performance Hardening (2026-09-09)

- controle otimista de Categorias e Configurações passa a ocorrer atomicamente no próprio `UPDATE`, eliminando a janela read-then-write;
- edição do CRM e Configurações deixa de consultar `information_schema` a cada salvamento; readiness/schema passam a ser a autoridade de compatibilidade;
- orçamento idempotente usa **INSERT-first + unique index**, reduzindo um round-trip ao Neon em solicitações novas e deixando o banco arbitrar retries concorrentes;
- respostas deduplicadas de orçamento passam a retornar HTTP 200 + `deduplicated:true`; criação inédita permanece HTTP 201;
- catálogo combina dados + total com `COUNT(*) OVER()`, reduzindo de duas consultas para uma no caminho normal; COUNT separado só ocorre em página vazia além do fim;
- rate limit distribuído recebe circuit breaker curto: rotas públicas degradam para proteção local e escopos `admin-*` falham fechados em produção;
- slug UTM de campanha ganha defesa em profundidade: condição no `UPDATE` + trigger PostgreSQL imutável;
- novos índices para estoque público e filas comerciais de pagamento/produção/origem;
- novo `check:performance` protege concorrência, idempotência, query budget, circuit breaker e índices;
- novo `check:load` executa smoke HTTP concorrente com p50/p95, falhas e throttling; CI testa localmente e Deploy Gate pode executá-lo no alvo real;
- schema runtime sobe para **13**.

### Manutenção V6.21 — Resilient Deploy & Dependency Health (2026-09-09)

- health separado em liveness, readiness e deep health; liveness não depende de serviços externos e readiness/deep usam timeouts próprios;
- readiness exige Neon + schema runtime 12 + integridade; S3 só bloqueia readiness com `S3_REQUIRED=1`, mas qualquer S3 configurado e degradado bloqueia deep health;
- configuração S3 parcial passa a ser detectada no preflight e o probe usa acesso real ao bucket sem expor credenciais;
- identidade de release (`APP_RELEASE_ID`, commit e data) é exposta de forma sanitizada no health e na Central de Operação;
- novo `check:deploy` valida live/ready/deep, home/admin e amostra múltiplas respostas para detectar rollout com versões misturadas;
- novo workflow manual **Verify deployment or rollback target** permite validar release novo ou alvo de rollback diretamente no GitHub Actions;
- novo `check:resilience` + self-test simula indisponibilidade do banco, schema antigo, integridade inválida, S3 opcional/obrigatório, configuração parcial e timeout;
- `scripts/start.mjs` passa a encaminhar SIGTERM/SIGINT e aplicar encerramento gracioso antes de SIGKILL; Docker continua usando liveness para evitar restart em cascata por queda de Neon/S3;
- Central de Operação exibe storage, latência e release ativo; novo `ROLLBACK-RUNBOOK.md` separa rollback de código de restore de dados;
- schema runtime permanece **12**, sem migração nova do Neon nesta manutenção.

### Manutenção V6.20 — Safe Backup Restore & Atomic Recovery (2026-09-09)

- restauração verificável em duas fases (dry-run + apply), com validação SHA-256, manifesto, limites, duplicidades e referências entre entidades;
- execução destrutiva exige sessão admin, same-origin, rate limit, step-up TOTP e confirmação literal `RESTAURAR`;
- snapshot pré-restauração criado atomicamente dentro da mesma transação, após lock das tabelas comerciais;
- `pg_advisory_xact_lock` serializa restores concorrentes e `ACCESS EXCLUSIVE` elimina a janela entre snapshot e substituição;
- falhas de constraint/contagem abortam a transação; inconsistência detectada após a aplicação aciona rollback pelo snapshot;
- snapshots temporários podem ser reaplicados pelo Admin com confirmação `REVERTER`;
- auditoria, sessões, MFA, dispositivos, rate limits e incidentes ficam fora do escopo de restore;
- novo `npm run db:restore -- arquivo.json` opera em dry-run por padrão e só aplica com `--apply --confirm=RESTAURAR`;
- novo `check:restore` protege o contrato de recuperação no CI;
- schema runtime elevado para 12.

# Changelog

### Manutenção V6.19 — Observability, Audit & Recovery (2026-09-08)
- nova área **Admin → Operação** com saúde de banco/schema, integridade de dados, incidentes e trilha administrativa;
- erros tratados por `serverFailure` passam a ser agregados em `operational_incidents` por fingerprint, mantendo contagem, primeira/última ocorrência, referência curta e estado revisado/resolvido;
- observabilidade remove padrões sensíveis de mensagens antes de persistir e mantém o log JSON no console como fallback quando o banco está indisponível;
- `admin_audit_log` recebe hash SHA-256 de integridade e trigger PostgreSQL **append-only** que rejeita UPDATE/DELETE;
- auditoria passa a suportar severidade, request/session/device/auth context opcional e validação automática do hash;
- novo alerta operacional no topo do Admin quando houver incidentes não revisados ou falha de integridade;
- backup administrativo sobe para formato `marques-catalog-v7`, inclui manifesto, contagens e SHA-256 do conteúdo;
- novo `npm run backup:verify -- arquivo.json` recusa backup alterado, incompleto ou com contagem divergente;
- novo `check:observability` protege incidentes, auditoria append-only, UI/API operacional e resiliência de backup;
- schema runtime sobe para **11**.

### Manutenção V6.18 — Critical Reauth & Security Alerts (2026-09-08)
- ações administrativas críticas passam a exigir **step-up authentication** com um TOTP novo, mesmo quando a sessão já está autenticada;
- confirmação reforçada é vinculada à sessão atual em `admin_sessions.last_reauth_at` e expira após 5 minutos; revogar a sessão também elimina o step-up;
- nova rota `/api/admin/reauth` exige sessão válida, same-origin, rate limit, TOTP e anti-replay antes de atualizar o timestamp server-side;
- APIs críticas retornam HTTP 428 quando precisam de nova confirmação; o cliente abre um modal acessível e repete a requisição original no máximo uma vez;
- step-up aplicado a backup, revogação de sessões/dispositivos, alterações das configurações públicas/contatos e exclusões destrutivas de mídia, inquiries, categorias, campanhas e produtos;
- nova camada de alertas externos opcional via webhook HTTPS, com corpo assinado por HMAC-SHA256 e headers de evento/timestamp;
- o webhook bloqueia destinos locais/privados em produção, usa timeout curto e não envia IP bruto, hash de IP, cookies ou segredos;
- eventos `critical_reauth`, `critical_action` e `security_webhook_failed` entram na Central de Segurança e no schema;
- novo `check:critical` protege banco, API, retry, interface, rotas críticas e assinatura do webhook; CI/runtime passam a exigir o guard;
- schema runtime sobe para 10.

### Manutenção V6.17 — MFA Recovery & Device Alerts (2026-09-08)
- códigos de recuperação MFA de uso único: 10 códigos por conjunto, gerados com CSPRNG e persistidos somente como HMAC-SHA256;
- login em duas etapas passa a aceitar TOTP ou código de recuperação após a senha; o código reserva é consumido atomicamente antes da sessão ser criada;
- regeneração dos códigos exige uma nova validação TOTP e invalida imediatamente todo o conjunto anterior; os códigos em claro são exibidos somente na resposta da geração;
- novo cookie `catalog_admin_device`, HttpOnly/SameSite=Strict/Secure em produção, usa ID aleatório de 180 dias; somente o hash do ID é persistido no Neon;
- nova tabela `admin_known_devices` reconhece navegadores persistentes e permite remover um dispositivo, revogando todas as sessões vinculadas;
- nova tabela `admin_security_events` registra novo dispositivo, login por recuperação e alterações relevantes, com alertas não lidos e retenção de 180 dias;
- nova Central **Admin → Segurança → Recuperação & alertas** mostra códigos restantes, dispositivos conhecidos, histórico e permite reconhecer alertas;
- painel principal sinaliza atividade de segurança não revisada;
- `admin_sessions` passa a registrar `device_hash` e `auth_method` (`password`, `totp` ou `recovery`);
- nova API `/api/admin/security`, protegida por autenticação e same-origin nas mutações;
- novo `check:recovery` + self-test criptográfico; CI/runtime passam a exigir essa cobertura;
- schema runtime sobe para 9.

### Manutenção V6.16 — Admin MFA / TOTP (2026-09-08)
- login administrativo passa a usar duas etapas reais em produção: senha válida cria somente um desafio assinado e temporário; a sessão definitiva nasce após o TOTP correto;
- TOTP implementado com `crypto` nativo, HMAC-SHA1, 6 dígitos e janela de 30 segundos, compatível com autenticadores padrão RFC 6238;
- novo `ADMIN_TOTP_SECRET`, obrigatório no preflight de produção, com gerador `npm run admin:generate-mfa` e URI `otpauth://` para provisionamento;
- desafio MFA usa cookie HttpOnly + SameSite=Strict + Secure em produção e expira em 5 minutos;
- nova rota `/api/admin/mfa/verify`, com same-origin e rate limit dedicado;
- anti-replay server-side em `admin_mfa_used_steps`: a mesma janela TOTP só pode concluir um login;
- `admin_sessions.mfa_verified_at` registra evidência do segundo fator e sessões legadas sem MFA são rejeitadas quando 2FA é obrigatório;
- autenticação passa a falhar fechado sem Neon em produção; bypass stateless existe somente no GitHub Actions para o E2E isolado;
- novo `check:mfa` inclui contrato estático e vetores oficiais do RFC 6238;
- E2E do CI passa a testar senha → desafio MFA → código incorreto → TOTP correto → sessão → logout;
- schema runtime sobe para 8.

### Manutenção V6.15 — Revocable Admin Sessions (2026-09-08)
- sessões administrativas deixam de ser apenas stateless quando o Neon está configurado: cada login cria um registro revogável em `admin_sessions`;
- logout revoga a sessão no servidor, invalidando cópias do cookie antes do prazo natural de expiração;
- identificador bruto da sessão nunca é persistido: o banco recebe somente hash HMAC derivado de `SESSION_SECRET`;
- sessão é vinculada ao hash do User-Agent quando disponível, reduzindo reutilização do cookie em outro navegador sem prender o acesso ao IP;
- IP bruto não é armazenado; apenas hash HMAC é registrado junto à sessão;
- nova área **Admin → Segurança** lista dispositivos/sessões ativos, destaca a sessão atual e permite encerrar uma sessão ou todas as outras;
- nova API `/api/admin/sessions` com listagem autenticada e revogação same-origin;
- limite server-side mantém no máximo 12 sessões administrativas ativas, revogando automaticamente as mais antigas;
- novo `check:sessions` protege schema, autenticação, logout, API e UI contra regressões;
- schema runtime sobe para 7 e readiness passa a exigir a tabela de sessões;
- E2E passa a verificar também o contrato da API de sessões administrativas.

### Manutenção V6.14 — Functional Flow Guards (2026-09-08)
- corrigida inconsistência no orçamento de produto único: o backend agora revalida o produto pela mesma consulta pública usada pelo catálogo e pelas listas, respeitando ativo/categoria/janela de publicação;
- novo `check:public-flow` impede regressão que permita orçamento de produto oculto, agendado ou fora da janela pública;
- novo `check:e2e` executa 20+ asserções HTTP funcionais contra um build iniciado, sem dependência de framework de browser;
- E2E cobre home, catálogo, produto, lista compartilhável, busca, Concierge, telemetria, JSON inválido, formulário inválido, cross-origin, proteção admin, login, cookie, API autenticada e logout;
- CI agora sobe o servidor de produção após o `next build`, gera credencial Scrypt efêmera e executa o E2E automaticamente;
- documentação corrigida para refletir Node 22.16.0 como runtime fixo.

### Manutenção V6.13 — Security & Release Contracts (2026-09-08)
- validação de origem reforçada com `Sec-Fetch-Site`, comparação de origem completa e fallback por `Referer`;
- `clientIp` e headers encaminhados agora normalizam o primeiro valor de proxies;
- autenticação endurecida: formato Scrypt validado, limite de entrada da senha e estrutura/expiração do token de sessão validadas;
- preflight de produção agora exige `ADMIN_PASSWORD_HASH` Scrypt válido; `ADMIN_PASSWORD` fica somente como compatibilidade local;
- novo `check:security` audita automaticamente as 35 rotas de API e bloqueia regressões de autenticação, origem e rate limit;
- novo `check:runtime` fixa contrato de Node/npm, versões exatas e preparação para lockfile;
- novo `check:deps` diferencia dependência ausente/divergente de erro de TypeScript/build e valida as versões instaladas;
- `typecheck` não deixa mais `tsconfig.tsbuildinfo` na raiz durante validações isoladas;
- Node fixado em `22.16.0` no `.nvmrc` e Docker; npm declarado como `10.9.2`; dependências continuam com versões exatas;
- CI usa `npm ci` automaticamente quando o `package-lock.json` existir e mantém fallback temporário claramente sinalizado enquanto ele estiver ausente;
- workflow manual `Generate package lock` gera e valida o lockfile em GitHub Actions sem inventar resolução offline;
- Docker ganhou healthcheck nativo no `/api/health?mode=live`;
- `check:live` ampliado para CSP, HSTS, cache, X-Powered-By, 404 real e rejeição de origem cruzada.

### Manutenção V6 — Runtime & Type Contracts (2026-09-08)
- restaurado `.env.example`, que era obrigatório pelo próprio `check:project` e estava ausente do pacote;
- parser JSON endurecido: APIs aceitam somente objetos JSON e tratam payload inválido sem `any`;
- cliente HTTP agora normaliza respostas desconhecidas antes de ler `error`, `message` e `reference`;
- camada Neon tipada com `DbRow`, parâmetros `unknown[]` e normalizadores explícitos para produtos, inquiries e campanhas;
- removidos escapes explícitos `any` das APIs, catálogo, importador CSV, Campaign Manager e Web Vitals;
- novo `check:typesafety` integrado ao `verify` e ao CI para impedir regressão de tipagem.
- Campanhas: identificador UTM imutável após criação para impedir quebra da atribuição histórica.
- Campanhas com leads vinculados não podem ser excluídas; devem ser encerradas para preservar métricas e histórico.
- novo `check:campaigns` no CI garante que essas proteções não sejam removidas por regressão.

## 6.0.0 — Production Hardening

### Arquitetura e performance
- home deixa de carregar o catálogo inteiro e usa curadoria reduzida;
- catálogo público com paginação, filtros e ordenação server-side;
- Concierge com recomendação sob demanda;
- consulta específica para produtos relacionados e sitemap;
- proteção contra respostas antigas misturarem resultados após troca de filtros;
- limites de paginação e índices adicionais no Neon;
- cards com navegação progressiva e prefetch controlado.

### Neon e integridade
- `products.category_id` com vínculo real à categoria e compatibilidade temporária V5;
- triggers de sincronização e `updated_at`;
- `idempotency_key`, `event_brief` e `closed_at` consolidados;
- FAQ, analytics agregados, auditoria administrativa e rate limit distribuído;
- checagem de integridade para órfãos, categoria oculta e produto publicado sem imagem;
- parser de migração próprio para funções/triggers PL/pgSQL.

### Segurança e confiabilidade
- rate limit distribuído sem armazenar IP puro;
- limites de payload em APIs;
- validação de origem em ações sensíveis;
- upload valida assinatura binária de JPG/PNG/WEBP;
- erros de servidor com referência/correlation ID e logs sanitizados;
- comparação de senha fallback endurecida;
- orçamento idempotente e validação de data do evento;
- controle otimista por `updated_at` para evitar sobrescrita entre duas abas;
- CSP/HSTS e headers adicionais de produção.

### Admin e operação
- Visão Geral com readiness, integridade, analytics e auditoria;
- FAQ administrável;
- Biblioteca de Mídia S3 paginada com exclusão segura;
- backup completo pelo painel;
- CRM com dirty-state, follow-up e proteção contra perda de alterações;
- formulários principais avisam alterações não salvas;
- preview de rascunho e conflitos 409 tratados;
- backup CLI V6 e seed preenchendo `category_id`.

### UX, acessibilidade e SEO
- busca global com loading, falha e retry;
- modal/lightbox com focus trap, ESC, restauração de foco e swipe;
- fallback de imagem em áreas públicas;
- safe-area/dynamic viewport no mobile;
- error/loading boundaries específicos e global error;
- `/admin` noindex, sitemap otimizado e datas reais de categoria;
- FAQ structured data somente quando houver FAQ publicado;
- numeração editorial dinâmica na home;
- contagem real de itens no hero.

### Qualidade e deploy
- `check:project`, `check:acceptance`, `check:env --production` e `check:live`;
- smoke test de catálogo, busca, lista, Concierge, health e proteção do admin;
- CI com audit de segurança, acceptance, typecheck e build;
- checklist de release e documentação V6.

## 5.0.0 — Signature Concierge
- Concierge de Festa, briefing estruturado, lista compartilhável, vistos recentemente, ordenação e CRM com follow-up.

## 4.0.0 — Signature Commerce
- lista multi-item, busca global, lookbook, avaliações reais e CRM comercial.

## 3.0.0 — Premium Editorial
- direção de arte editorial, lightbox, favoritos, coleções e páginas internas premium.

## 2.0.0 — Catálogo Comercial
- catálogo/Neon, admin, páginas de produto/categoria, orçamento, SEO, storage opcional e operação inicial.
