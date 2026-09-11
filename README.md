## V6.50 — lifecycle de mídia cross-system com lease

A V6.50 fecha a janela entre transação do Neon e I/O no S3. Upload, exclusão e **restore de mídia** usam leases tokenizadas; a gravação só é liberada após `HeadObject` confirmar tamanho/hash e a exclusão só conclui após confirmar ausência. Falhas deixam a URL em quarentena e aparecem no deep-health. Restore do banco e I/O de mídia compartilham um lock global para não reconstruir referências enquanto há efeito externo em andamento. O **Backup V9** continua atual e inclui tombstones permanentes, mas nunca serializa `media_lifecycle_leases`, pois leases são estado efêmero. O IAM do Storage primário precisa permitir `PutObject`, `DeleteObject`, `ListObjectsV2` e `HeadObject` no namespace `catalog/`. Runtime: Node.js **22.23.2**, npm **10.9.8**, schema **27**.

## V6.49 — namespace de DR isolado e attestation remota do backup

Backups **V9** do banco agora usam o namespace dedicado `${BACKUP_S3_PREFIX}/database/YYYY/MM/`, enquanto o espelho de mídia permanece em `${BACKUP_S3_PREFIX}/media/`. A retenção automática atua somente em objetos reconhecidos como backup de banco e nunca mais percorre/apaga o espelho de mídia. O recovery drill procura primeiro `database/` e só usa o layout legado `${BACKUP_S3_PREFIX}/YYYY/MM/` quando nenhum backup novo existe, filtrando explicitamente objetos que correspondem ao formato do backup do catálogo. Cada upload offsite grava e relê attestation com `envelope-sha256`, `content-sha256`, `backup-contract` e `schema-version`; o drill confere esses metadados contra o conteúdo criptografado/assinado antes do restore. Backup vault e bucket de drill passam pela política única `lib/dr-storage-policy.ts`: HTTPS obrigatório, destino externo e isolamento de buckets, com validação aplicada diretamente nos scripts de backup, restore e drills. Execute `npm run check:dr-storage`, `npm run check:offsite-backup` e `npm run check:recovery-drill` antes de promover. Runtime: Node.js **22.23.2**, npm **10.9.8**, schema **26**.

## V6.48 — ciclo de vida de mídia fail-closed e DR reparador

A biblioteca agora aceita exclusão somente dentro do namespace gerenciado `catalog/` e usa **tombstones + advisory locks no Neon** para serializar “verificar referência → reservar exclusão → remover do Storage”. Falha ao consultar o banco bloqueia a exclusão; produto, categoria, logo e hero não podem passar a referenciar uma URL tombstonada durante a corrida. Reupload do mesmo conteúdo só reativa a mídia depois de `PutObject` bem-sucedido. O restore offsite exige Neon/schema 26 saudável em `--apply`, consulta tombstones para não ressuscitar exclusões intencionais, verifica SHA-256 de objetos existentes e repara tanto ausentes quanto divergentes. Backups feitos no schema 26 usam **V9 (`marques-catalog-v9`)** e levam `media_deletion_tombstones` dentro do conteúdo assinado; o restore externo mescla tombstones do backup com os atuais, enquanto snapshots internos usam restauração exata. V7/V8 continuam verificáveis como legado, mas não são suficientes para reconstruir isoladamente deleções de mídia após perda total do Neon. Configuração S3 inválida degrada o deep health e produção exige endpoints HTTPS canônicos. Execute `npm run db:setup`, `npm run check:media-lifecycle`, `npm run check:backup-v9` e `npm run db:verify` antes do deploy. Runtime: Node.js **22.23.2**, npm **10.9.8**, schema **26**.

## V6.47 — criações administrativas idempotentes e retry seletivo

As criações de produto, categoria, avaliação, FAQ, campanha e planejamento social agora exigem **Idempotency-Key** válida e convergem para um UUID determinístico por tentativa. Se a resposta se perder depois do commit, o mesmo POST pode ser repetido sem criar outro registro; reutilizar a chave com payload diferente retorna **409**. O cliente repete automaticamente somente as rotas explicitamente garantidas como idempotentes, preserva a chave pendente por até 2 horas em `sessionStorage` através de fingerprint do corpo e limpa a chave após sucesso ou erro definitivo. HTTP **428** só abre step-up MFA quando a API declara `reauth_required: true`. `check:idempotency` e `check:replay-safety` ficam obrigatórios no CI. Runtime: Node.js **22.23.2**, npm **10.9.8**, schema **25**.

## V6.46 — bounded binary ingress, lotes atômicos e replay-safe media

O limite físico de request agora cobre também **multipart e backups**: o corpo é contado em bytes e cancelado antes de `formData()`/desserialização quando ultrapassa o teto, inclusive em transferência chunked sem `Content-Length`. Ações em lote de produtos passam a enviar `id + updated_at` e executar compare-and-swap **all-or-none** no banco; se um produto mudou em outra aba, nenhum item do lote é alterado. Uploads de imagem usam chave content-addressed por SHA-256, fazendo retries do mesmo conteúdo convergirem para o mesmo objeto no Storage. `check:replay-safety`, `check:http-boundary` e `check:concurrency` preservam essas garantias no CI. Runtime: Node.js **22.23.2**, npm **10.9.8**, schema **25**.

## V6.45 — ingresso limitado e concorrência otimista obrigatória

O boundary de entrada agora limita **fisicamente** corpos JSON em streaming: requests sem `Content-Length` também são interrompidos e cancelados assim que excedem o orçamento, e `application/json`/`application/*+json` é exigido antes da desserialização. O rate limit do Admin combina bucket por cliente com teto global para reduzir bypass por spoofing de IP. Erros de entrada esperados (`400/413/415/428`) não viram incidentes 5xx. Mutações individuais de produtos, categorias, avaliações, planejamento social, campanhas, FAQs, configurações e exclusões de CRM agora exigem a versão realmente vista pela tela e executam compare-and-swap no banco; ausência da precondição retorna **428** e stale write retorna **409**. O novo `check:concurrency` bloqueia regressão dessa garantia no CI.

## V6.44 — boundary HTTP confiável, anti-spoofing e CSP estrita no Admin

Mutações administrativas deixam de confiar em `x-forwarded-host`/`x-forwarded-proto` como autoridade de segurança. Em produção, `NEXT_PUBLIC_SITE_URL` passa a definir a origem canônica usada pelo boundary CSRF; o novo `check:http-boundary` executa provas de spoofing, limites de upload e CSP. A área `/admin` recebe nonce criptográfico por requisição via `proxy.ts`, `script-src` com `strict-dynamic` e sem `'unsafe-inline'` para scripts, além de `no-store`/`noindex`. Uploads administrativos validam `multipart/form-data` e o tamanho anunciado antes de materializar `request.formData()`. E2E, live-check e deploy gate agora verificam essas garantias em produção.


## V6.43 — contrato único de plataforma, URLs seguras e lockfile comprovado

A plataforma operacional passa a ser descrita por `platform-contract.json`: schema **25**, Node **22.23.2**, npm **10.9.8**, runner `ubuntu-24.04` e imagem Docker imutável. `check:platform` impede divergência entre runtime, Docker, CI, release manifest e deploy gate. Instalações usam `ignore-scripts=true`/`npm ci --ignore-scripts`; o workflow **Generate package lock** agora instala o lock recém-gerado, valida a árvore, executa `npm audit` e produz SHA-256 antes de liberar o artefato. `check:url-safety` endurece URLs públicas e também normaliza dados legados lidos do banco antes de renderização.

## V6.42 — runtime seguro, container mínimo e contratos executáveis

O runtime reproduzível sobe para Node.js **22.23.2** com npm **10.9.8**. O Docker usa a imagem oficial Alpine pinada por digest, exige `package-lock.json`, instala somente com `npm ci`, gera `output: standalone` e executa a aplicação como usuário `node`, sem npm/yarn no estágio final. O novo `check:module-surface` cruza imports locais com exports reais e detecta bindings duplicados; `check:release` executa a fonte única de identidade de release, e `check:docs` impede que a documentação operacional fique presa em versão/runtime antigo.

## V6.41 — Actions imutáveis e CI com credenciais minimizadas

Os workflows agora usam GitHub Actions pinadas por SHA completo e `actions/checkout` sem persistir credenciais no workspace. O `check:supply-chain` falha se alguém voltar a usar tags/branches mutáveis, trocar o SHA auditado ou introduzir uma Action externa não aprovada. O lockfile continua obrigatório para os jobs críticos e deve ser gerado de forma real antes do release final.


## V6.40 — build reproduzível e supply chain

CI, backups e drills não instalam mais uma árvore transitiva arbitrária quando o `package-lock.json` falta. Esses jobs falham fechado e orientam a gerar/commitar o lockfile pelo workflow dedicado **Generate package lock**. O `check:supply-chain` também exige versões diretas exatas, Actions oficiais em releases exatas, permissões mínimas e Dependabot semanal.


## V6.39 — ensaio real de recuperação de mídia

O workflow semanal `media-recovery-drill.yml` prova que o espelho de mídia é restaurável sem tocar no bucket público. Ele usa um bucket `DRILL_S3_*` isolado, restaura os objetos para um prefixo temporário, valida `source-sha256` antes e depois da gravação, registra recibo append-only no Neon e remove o material temporário. O deep health e a Central de Operação mostram a freshness desse ensaio.

# Marques Papelaria — Catálogo Premium V6

> **V6.49 — DR Namespace Isolation & Remote Backup Attestation**  
> Backup de banco e mídia possuem namespaces separados no cofre; retenção e recovery drill são confinados ao namespace correto. Schema runtime **26**.

## V6.38 — auditoria garantida para ações críticas

Antes de qualquer mutação administrativa crítica, o servidor persiste um **audit intent** na trilha encadeada. Se essa evidência não puder ser gravada, a ação é recusada antes da mutação. Isso cobre restore/rollback, anonimização/exportação de privacidade, exclusões permanentes, revogação de sessões/dispositivos, rotação de recovery codes, backup administrativo e alterações públicas sensíveis. O `check:critical-audit` impede regressão desse contrato.


## Disaster recovery de mídia V6.37

`npm run media:backup-offsite` espelha `catalog/` para `${BACKUP_S3_PREFIX}/media/catalog/`, relê cada objeto e confere SHA-256. `npm run media:restore` é dry-run; ele verifica SHA-256 inclusive de objetos já existentes. A reposição real exige `DATABASE_URL`, `--apply --confirm=RESTAURAR-MIDIA`, pula chaves tombstonadas e recria objetos ausentes **ou repara objetos divergentes** depois de validar o conteúdo do cofre. O workflow `.github/workflows/media-backup.yml` pode executar diariamente.

# Marques Papelaria — Catálogo Premium V6

> **V6.36 — Automated Recovery Drill**  
> O último backup offsite passa por ensaio real semanal em um Neon isolado: download, verificação strict, restore, `db:verify` e recibo append-only. Schema runtime **23**.

## Recovery drill V6.36

Use um `DRILL_DATABASE_URL` separado do Neon operacional. O workflow `.github/workflows/recovery-drill.yml` recusa o mesmo host do banco de produção, baixa o backup offsite mais recente, valida criptografia/assinatura, aplica restore real no banco de drill, executa `db:verify` e registra o sucesso em `recovery_drill_receipts`. `RECOVERY_DRILL_MAX_AGE_HOURS` define a idade máxima aceita (48–720 h; padrão 192).

# Marques Papelaria — Catálogo Premium V6

> **V6.36 — Backup Freshness & Recovery Readiness**  
> Cada backup offsite validado gera um recibo append-only no Neon. A Central de Operação e o deep health detectam backup ausente/velho; o deploy gate pode exigir freshness antes de promover uma release. Schema runtime **22**.

## Recovery readiness V6.36

Depois de `backup:offsite` validar o arquivo local em modo strict, enviá-lo, reler o objeto remoto e confirmar o SHA-256, o job registra um recibo em `offsite_backup_receipts`. O recibo guarda somente metadados operacionais seguros: SHA-256 do envelope, chave do objeto, fingerprint do destino, tamanho, retenção, quantidade podada e horário da verificação.

`BACKUP_OFFSITE_MAX_AGE_HOURS` define quando a cópia é considerada velha (24–720 h, padrão 36). A Central de Operação e o banner administrativo sinalizam `missing/stale/unavailable`. O catálogo público continua disponível; para bloquear promoção de release quando não houver backup recente, use `check:deploy -- --require-backup-fresh` ou habilite a opção correspondente no workflow de deploy.

> **V6.34 — Automated Offsite Backup Rotation**  
> Backups V8 criptografados e assinados podem ser gerados automaticamente, enviados para um bucket S3 privado separado do storage público, relidos e validados por SHA-256 após o upload e submetidos a retenção controlada. Schema runtime permanece **21**.

## Backup offsite automático V6.34

A V6.34 remove a dependência de lembrar de copiar manualmente o backup para fora do deploy. O comando `npm run backup:offsite` gera um backup V8 em diretório temporário, aplica assinatura HMAC + AES-256-GCM, valida localmente com `backup:verify -- --strict`, envia ao bucket privado, valida `Content-MD5`, `HEAD` e uma leitura remota completa com SHA-256 streaming, e só depois aplica a retenção.

Use um bucket **diferente** do S3 público de mídia. Em GitHub Actions, configure `BACKUP_OFFSITE_ENABLED=1` como Repository Variable e mantenha credenciais/segredos em GitHub Secrets. A retenção aceita 7–3650 dias (padrão: 45). O workflow agendado é `.github/workflows/offsite-backup.yml`; ele não publica o backup como GitHub Artifact.


> **V6.33 — Privacy-Safe Disaster Recovery**  
> Catálogo editorial premium + orçamento multi-item + Concierge + CRM + operação administrativa sobre **Next.js, Neon PostgreSQL e RunSite**.

A V6 foi estruturada para funcionar como o site oficial de uma papelaria personalizada, com prioridade em experiência mobile, integridade de dados, segurança, diagnóstico de produção e manutenção sem precisar editar código para cada produto.

## Experiência pública

- identidade premium sóbria em grafite/preto, marfim e champagne;
- home editorial com coleções, curadoria, lookbook, processo, FAQ e prova social real;
- catálogo paginado e filtrado **server-side** — não baixa o acervo inteiro na abertura;
- busca global de produtos/coleções com `Ctrl/Cmd + K`, loading, erro e retry;
- páginas próprias de produto e categoria;
- galeria/lightbox acessível com teclado, ESC e swipe no celular;
- fallback de imagens quebradas;
- favoritos/lista de orçamento persistente no navegador;
- lista compartilhável revalidada no servidor;
- Concierge de Festa com recomendação sob demanda usando produtos publicados;
- orçamento com briefing estruturado, quantidades e idempotência concorrente **INSERT-first**;
- WhatsApp integrado quando o número oficial estiver configurado;
- produtos vistos recentemente sem exigir conta;
- loading/error boundaries específicos e navegação progressiva;
- SEO: canonical, sitemap, robots, Open Graph, JSON-LD de organização/produto/breadcrumb/FAQ.

## Painel `/admin`

- sessão administrativa `HttpOnly` / `SameSite=Strict`, revogável no Neon e vinculada ao navegador;
- senha por hash Scrypt + **MFA/TOTP obrigatório em produção**;
- Admin → Segurança para revisar/revogar sessões e dispositivos, gerar códigos de recuperação de uso único e acompanhar alertas de acesso;
- Visão Geral com readiness, integridade, analytics agregados, auditoria e backup;
- **Operação & auditoria** com incidentes agregados, saúde do schema e trilha append-only encadeada por SHA-256, capaz de detectar alteração, remoção, reordenação e truncamento;
- **Central de Privacidade** para acesso/exportação e anonimização completa de dados pessoais com tombstones anti-ressurreição;
- Produtos: criar, editar, publicar/ocultar, destacar, duplicar rascunho, imagens, preço, mínimo, prazo, tags e SEO;
- Categorias administráveis;
- FAQ administrável;
- avaliações/depoimentos reais administráveis;
- CRM de orçamentos com status, valor, follow-up, briefing, notas e itens, agora com versão monotônica e proteção contra gravações concorrentes;
- proteção contra perda de formulário ao trocar de área/sair;
- controle otimista atômico: cadastros administrativos usam `updated_at` e o CRM usa `version` monotônica, impedindo sobrescrita silenciosa entre abas/dispositivos;
- Biblioteca de Mídia S3/RunSite com paginação e exclusão bloqueada quando a imagem está em uso;
- configurações de marca, logo, hero, contatos, Sobre e SEO sem novo deploy;
- backup V8 completo, assinado e criptografado, com tombstones HMAC de privacidade embutidas para recuperação de desastre sem reintroduzir identidades já apagadas.





## Privacy-safe disaster recovery V6.33

- backups novos usam `marques-catalog-v8` e incluem `privacy_tombstones` dentro do envelope AES-256-GCM;
- a seção contém somente hashes HMAC e metadados mínimos de apagamento — nunca WhatsApp/e-mail em claro;
- restore une tombstones do Neon atual com as tombstones do backup antes de sanitizar o CRM;
- a função PostgreSQL de restore recebe o vault como quarto argumento e faz o merge em `privacy_requests` dentro da mesma transação, antes da troca dos dados comerciais;
- depois de perda total/recriação do Neon, um backup V8 feito após a anonimização mantém aquela identidade apagada;
- backups V7 continuam verificáveis por compatibilidade, mas são marcados como `legacy` porque não carregam tombstones embutidas;
- runtime mínimo **schema 21** e `check:privacy-dr` entram no CI/verify.

> Limite importante: nenhum backup criado **antes** de uma solicitação de anonimização pode conhecer essa solicitação futura. Para disaster recovery correto, mantenha backups V8 recentes e a política de retenção definida.

## Reativação global e ciclo anual V6.28

- a fila **Oportunidades de recompra** é calculada diretamente no Neon e não depende das páginas já carregadas do histórico;
- clientes fechados com evento passado voltam à fila quando o próximo aniversário do evento estiver nos próximos 60 dias;
- a fila é deduplicada por WhatsApp e paginada por cursor `next_anniversary + id`, evitando carregar histórico inteiro no navegador;
- 29/02 é ajustado com segurança para 28/02 em anos não bissextos;
- ao abrir **Reativar cliente**, o servidor registra `repurchase_contacted_at` e `repurchase_contact_year` antes de liberar a mensagem do WhatsApp;
- o mesmo cliente não entra duas vezes no mesmo ciclo anual, inclusive quando o contato acontece em dezembro para um evento de janeiro;
- a timeline do atendimento e a auditoria administrativa registram o recontato;
- novos índices `idx_inquiries_repurchase_event` e `idx_inquiries_repurchase_contact`; schema runtime mínimo **18**;
- `check:reactivation` + self-test de calendário/cursor entram no CI/verify.

## Agenda escalável e calendário operacional V6.27

- a aba Agenda consulta o Neon apenas quando é aberta e somente na janela de 30/60/90/180 dias escolhida;
- eventos, follow-ups, prazos de produção, publicações/retiradas de produtos e conteúdos planejados não dependem mais do lote paginado do CRM;
- prazos de produção vencidos dos últimos 90 dias continuam visíveis para não esconder atraso operacional;
- KPIs e exportação `.ics` usam o conjunto global retornado para o período selecionado;
- novos índices `idx_inquiries_event_agenda` e `idx_inquiries_follow_up_agenda`; schema runtime mínimo **17**;
- `check:agenda-scale` e self-test das janelas permitidas entram no CI/verify.

## Produção escalável e pós-venda V6.26

- a aba Produção carrega sua própria workspace somente quando é aberta, sem depender das páginas de histórico do CRM;
- KPIs operacionais são globais no PostgreSQL: fila aberta, andamento, atrasos, aprovação, prontos, sem sinal, entregas recentes e pós-venda;
- pedidos entregues usam paginação por cursor `updated_at + id`, adequada ao momento real da conclusão;
- avaliações pendentes formam uma fila de pós-venda global e podem ser solicitadas via WhatsApp com registro no atendimento;
- `db:verify`/readiness exigem os índices de histórico entregue e pós-venda; o schema runtime mínimo é **16**.

## Busca global e inteligência do cliente V6.25

- a pesquisa do CRM consulta todo o histórico no servidor após debounce, mesmo quando o atendimento antigo ainda não foi carregado pela paginação;
- nome, WhatsApp, e-mail, produto, categoria, mensagem, notas, briefing e itens podem localizar registros históricos, com limite server-side;
- termo de busca e telefone trafegam no corpo POST autenticado em vez de query string, reduzindo exposição em logs de URL;
- recorrência, número de pedidos, quantidade de fechamentos e LTV fechado são agregados no PostgreSQL para os clientes exibidos;
- páginas adicionais do histórico e resultados de busca retornam também o mapa global de inteligência do cliente;
- alterações comerciais atualizam os dados agregados do cliente sem exigir reload completo;
- schema runtime permanece **15**: esta manutenção não exige nova migração do Neon.

## CRM escalável V6.24

- o Admin prioriza todos os atendimentos que ainda exigem ação e pagina somente o histórico terminal;
- histórico encerrado usa cursor opaco e estável por `(created_at, id)`, sem `OFFSET` crescente;
- KPIs de vendas, pipeline, recebimentos, produção e agenda são agregados globalmente no PostgreSQL, independententes das páginas carregadas no navegador;
- relatórios de aquisição por origem/campanha para 7/30/90 dias também vêm do banco;
- Estúdio de divulgação e Campanhas usam métricas globais all-time, evitando subcontagem de leads/vendas antigas;
- novos índices parciais aceleram fila operacional e histórico terminal; `db:verify` exige esses objetos antes de considerar schema 15 saudável.

## Resiliência comercial V6.23

- criação de orçamento mantém idempotência INSERT-first e timeline na mesma operação de banco;
- atualização individual do CRM exige `expected_version`;
- operações em lote são **all-or-none** e recusam qualquer conjunto com versão stale;
- PostgreSQL impede estados incoerentes de pagamento/produção e incrementa `inquiries.version` de forma monotônica;
- indisponibilidade transitória do Neon pode retornar contingência HTTP 202 com WhatsApp, preservando lista, personalizações e `request_id` no navegador para retry seguro;
- backup administrativo e CLI usam exportação completa/fail-fast e ordem SHA-256 canônica; backups V6.19–V6.22 continuam verificáveis pela ordem histórica, com aviso de conferência de contagens no dry-run.

## Backend / Neon V6

O schema inclui:

- `products`
- `categories`
- `site_settings`
- `testimonials`
- `inquiries`
- `faqs`
- `site_events_daily`
- `admin_audit_log`
- `request_rate_limits`
- `admin_sessions`
- `admin_mfa_used_steps`
- `admin_mfa_recovery_codes`
- `admin_known_devices`
- `admin_security_events`
- `operational_incidents`

A V6 adiciona relacionamento `products.category_id`, idempotência de orçamento, briefing JSONB, `closed_at`, auditoria, FAQ, telemetria agregada e rate limit distribuído. A migração usa operações idempotentes e preserva dados existentes.

Durante a janela V5 → V6, consultas críticas possuem fallback temporário para o modelo legado quando a coluna nova ainda não existe.

## Requisitos

- Node.js **22.23.2** (versão fixada em `.nvmrc` e no Docker)
- Neon PostgreSQL para produção dinâmica
- GitHub
- RunSite Web Service
- Storage S3 compatível apenas se desejar upload direto de imagens

## Instalação

```bash
npm install
cp .env.example .env.local
```

Configure as variáveis e execute:

```bash
npm run db:setup
npm run db:seed   # opcional, somente exemplos iniciais
npm run dev
```

## Administração segura

Gere o hash da senha:

```bash
npm run admin:hash-password -- "uma-senha-forte"
```

Gere uma chave de sessão longa, por exemplo:

```bash
openssl rand -base64 48
```

Em produção `ADMIN_PASSWORD_HASH` Scrypt é obrigatório pelo preflight. Deixe `ADMIN_PASSWORD` vazio; ele existe somente como compatibilidade local.

Gere também o segredo do segundo fator:

```bash
npm run admin:generate-mfa
```

O comando imprime `ADMIN_TOTP_SECRET` e uma URI `otpauth://`. Guarde o segredo em um gerenciador de senhas, configure `ADMIN_TOTP_SECRET` somente no ambiente do servidor e adicione a conta manualmente no Google Authenticator, Authy, 1Password ou outro autenticador TOTP. **Nunca faça commit do segredo.**

## Validação local / CI

```bash
npm run check:project
npm run check:acceptance
npm run check:campaigns
npm run check:typesafety
npm run check:security
npm run check:sessions
npm run check:mfa
npm run check:recovery
npm run check:critical
npm run check:observability
npm run check:restore
npm run check:resilience
npm run check:performance
npm run check:runtime
npm run check:public-flow
npm run check:deps
npm run typecheck
npm run build
```

O `check:campaigns` protege a atribuição UTM: o slug fica imutável após a criação e campanhas com leads vinculados não podem ser apagadas.

O `check:typesafety` bloqueia regressões com `any` explícito no código de aplicação e mantém os contratos de payload/Neon tipados.

O `check:observability` protege a persistência/agregação de incidentes, a auditoria append-only com hash e o formato de backup verificável.

O `check:resilience` protege liveness/readiness/deep health, timeouts de dependências, política de S3 opcional/obrigatório, identidade do release, encerramento gracioso e o deploy gate. O self-test simula banco indisponível, schema antigo, integridade inválida, S3 degradado e timeout.

O `check:security` audita as rotas de API e garante autenticação/origem/rate limit nos pontos sensíveis. O `check:sessions` protege o contrato de sessões administrativas revogáveis, vínculo ao navegador e gerenciamento de dispositivos. O `check:mfa` protege senha → desafio temporário → TOTP, anti-replay e fail-closed em produção. O `check:recovery` protege códigos reserva de uso único, reconhecimento persistente de dispositivo e alertas administrativos. O `check:critical` exige reautenticação TOTP recente nas ações de maior impacto e valida o webhook externo assinado. O `check:public-flow` garante que produto único, lista compartilhável, páginas públicas e preview admin usem a mesma regra de visibilidade. O `check:runtime` valida Node/npm, versões exatas, Docker/CI e o estado do lockfile. O `check:deps` confirma que as dependências diretas instaladas correspondem exatamente ao `package.json` antes do typecheck/build.

Validação completa:

```bash
npm run verify
```

Preflight com variáveis reais de produção:

```bash
npm run check:env -- --production
```

E2E HTTP contra uma instância já iniciada:

```bash
E2E_ADMIN_PASSWORD="senha-do-ambiente-de-teste" E2E_ADMIN_TOTP_SECRET="SEGREDO-BASE32-DE-TESTE" npm run check:e2e -- http://127.0.0.1:3100
```

O CI sobe o build de produção em uma porta isolada e executa esse fluxo automaticamente. Ele testa home, catálogo, produto, lista compartilhável, busca, Concierge, eventos, validações de orçamento, proteção administrativa, senha, desafio MFA, TOTP inválido/válido, inventário de sessões, Central de Segurança, API autenticada e logout sem criar registros comerciais.

Depois de publicado:

```bash
npm run check:live -- https://seu-dominio.com.br
```

O smoke test verifica liveness/readiness/**deep health**, identidade do release, schema, dependências configuradas, home, CSP/HSTS/headers, cache, robots, sitemap, catálogo, busca, lista, Concierge, rejeição cross-origin, 404 real e proteção das rotas administrativas.

## Backup

Antes de qualquer migração do Neon:

```bash
npm run db:backup
```

O script é tolerante à V5: se tabelas V6 ainda não existirem, ele preserva o que estiver disponível e identifica a versão exportada. A pasta `backups/` não deve ser commitada.

Também é possível baixar um backup autenticado em **Admin → Visão Geral**. Na V6.20 o backup inclui manifesto SHA-256, schema runtime e contagens. Depois de salvar o arquivo, valide antes de confiar nele:

```bash
npm run backup:verify -- caminho/do/marques-backup-AAAA-MM-DD.json
```

Se qualquer seção for alterada ou corrompida, a verificação falha.


### Restauração segura V6.20

A restauração agora fica em **Admin → Operação → Restauração segura**. O fluxo é deliberadamente em duas fases: primeiro o **dry-run** valida SHA-256, formato, referências e mostra a comparação entre os dados atuais e o backup; somente depois é possível aplicar. A execução exige step-up TOTP e a confirmação literal `RESTAURAR`.

Durante a aplicação, o PostgreSQL serializa restaurações concorrentes, bloqueia temporariamente as tabelas comerciais, cria um snapshot do estado anterior e faz a substituição dentro da mesma transação. Se qualquer constraint, contagem ou etapa falhar, a transação é desfeita. Auditoria, sessões, MFA, dispositivos, rate limits e incidentes não são substituídos pelo backup.

Também existe o fluxo CLI:

```bash
npm run db:restore -- backups/marques-backup.json
# apenas dry-run

npm run db:restore -- backups/marques-backup.json --apply --confirm=RESTAURAR
```

Snapshots automáticos ficam disponíveis por tempo limitado na Central de Operação e podem ser reaplicados com step-up MFA + confirmação `REVERTER`.

## Storage de imagens

Sem Storage, o admin continua aceitando URLs públicas. Para upload direto configure:

```env
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
# 1 = o S3 também bloqueia readiness; vazio/0 = bloqueia apenas deep health quando configurado e indisponível
S3_REQUIRED=
```

A API verifica a assinatura binária de JPG/PNG/WEBP. A Biblioteca de Mídia não permite apagar arquivos ainda usados por produto, categoria, logo ou hero.

## Deploy

Leia **`RUNSITE.md`** e depois use **`RELEASE-CHECKLIST.md`**.

Fluxo recomendado:

1. backup do Neon atual;
2. push para `main` e CI verde;
3. aplicar `npm run db:setup` no banco;
4. configurar variáveis do RunSite e um `APP_RELEASE_ID` imutável;
5. publicar;
6. executar `check:live`;
7. executar `npm run check:deploy -- https://SEU-DOMINIO --release=SEU_RELEASE_ID`;
8. testar orçamento/admin com dados de teste e removê-los depois.

A V6.22 mantém `/api/health?mode=live` (processo), `/api/health` (readiness) e `/api/health?mode=deep` (dependências configuradas), acrescentando o smoke concorrente `check:load` ao gate de promoção. O deploy gate continua amostrando o release várias vezes para detectar rollout misto. Consulte também **`ROLLBACK-RUNBOOK.md`** antes da primeira publicação.

## Segurança e privacidade

Nunca envie ao GitHub:

- `.env` / `.env.local`;
- `DATABASE_URL`;
- `SESSION_SECRET`;
- `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH`;
- `ADMIN_TOTP_SECRET`;
- `ADMIN_SECURITY_WEBHOOK_SECRET`;
- credenciais S3;
- backups.

O site público não precisa de conta. “Minha Lista” e vistos recentemente usam armazenamento local. A telemetria é agregada; rate limit distribuído usa identificador HMAC e não grava o IP puro no Neon.

Em produção, o login administrativo exige senha + TOTP e só cria a sessão depois dos dois fatores. Cada janela TOTP utilizada é registrada de forma atômica para impedir replay do mesmo código. Sessões antigas sem evidência de MFA deixam de ser aceitas.

Com Neon ativo, o admin usa sessões revogáveis server-side. O banco guarda apenas o hash do identificador da sessão, hashes HMAC de IP/User-Agent e o User-Agent necessário para identificar o dispositivo no próprio painel. O IP bruto não é persistido. O token também é vinculado ao navegador quando esse dado está disponível, e **Admin → Segurança** permite encerrar acessos remotos.

A V6.17 adiciona um identificador aleatório persistente de dispositivo em cookie HttpOnly; o Neon recebe apenas seu hash. Novo navegador autenticado gera alerta. A mesma área **Admin → Segurança** permite gerar 10 códigos de recuperação de uso único após revalidar um TOTP atual. Cada código é armazenado apenas como HMAC-SHA256 e é invalidado atomicamente no primeiro uso. Guarde os códigos fora do site, de preferência em um gerenciador de senhas ou cópia física segura.

A V6.18 adiciona **step-up authentication** para operações críticas. Depois de uma sessão normal já autenticada com MFA, ações como backup, alteração de contatos/configurações públicas, revogação de sessões/dispositivos, exclusões destrutivas e remoções sensíveis exigem um TOTP novo. A confirmação fica vinculada à sessão no Neon por apenas 5 minutos (`last_reauth_at`); revogar a sessão revoga também essa autorização reforçada. O cliente trata HTTP 428 abrindo um modal de confirmação e repete a ação original no máximo uma vez.

Opcionalmente, eventos de segurança podem ser enviados para um endpoint externo por `ADMIN_SECURITY_WEBHOOK_URL`. Em produção o destino deve ser HTTPS e externo, e `ADMIN_SECURITY_WEBHOOK_SECRET` (mínimo 32 caracteres) assina o corpo com HMAC-SHA256. O payload não inclui IP bruto, hash de IP, cookie ou segredo.

## Lockfile e build reproduzível

Esta entrega não inclui um `package-lock.json` inventado porque o ambiente de empacotamento não possui acesso ao registry. O projeto fixa Node `22.23.2`, npm `10.9.8` e versões exatas, e já está preparado para o lockfile oficial.

No GitHub, execute manualmente **Actions → Generate package lock → Run workflow**. Baixe o artefato `package-lock`, coloque `package-lock.json` na raiz e execute:

```bash
npm run check:runtime -- --require-lock
npm ci
npm run verify
```

Depois faça commit do lockfile. A partir daí CI e Docker passam automaticamente para instalação travada com `npm ci`.


## Verificação runtime do Neon
Após aplicar ou alterar o schema, execute `npm run db:verify`. A verificação confirma tabelas/colunas críticas, vínculos de categoria, janelas de publicação e estrutura de personalização diretamente no banco. O `npm run db:setup` também executa essa verificação automaticamente ao final.


## Concorrência e carga V6.22

A V6.22 reduz round-trips do Neon nos caminhos mais usados, torna os controles de `updated_at` atômicos e mantém idempotência de orçamento no próprio banco. O catálogo usa `COUNT(*) OVER()` para devolver página + total em uma consulta no caminho comum.

Antes de promover uma publicação, além do Deploy Gate, execute um smoke leve contra o alvo real:

```bash
npm run check:load -- https://SEU-DOMINIO --requests=24 --concurrency=4 --p95=3000
```

O teste falha em erro HTTP, throttling inesperado ou p95 acima do limite informado. Ele usa URLs únicas apenas para o smoke não ser satisfeito exclusivamente pelo cache de CDN.

## V6.29 — cadeia de auditoria tamper-evident

- `admin_audit_log` ganhou `prev_integrity_hash` + `chain_version`;
- cada evento referencia criptograficamente o hash anterior;
- `admin_audit_chain_state` mantém a âncora do último ID/hash e detecta truncamento do fim da trilha;
- inserts são serializados por lock transacional para não quebrar a cadeia em concorrência;
- a migração encadeia registros antigos uma única vez e não repara adulterações silenciosamente em execuções futuras;
- `db:verify`, health/readiness e Admin → Operação validam links, hashes, âncora e triggers;
- `npm run check:audit-chain` testa também alteração, exclusão, reordenação e truncamento.

Schema runtime da cadeia: **19**.

## V6.30 — privacidade e ciclo de vida dos dados

- nova **Admin → Privacidade** para localizar uma pessoa por WhatsApp ou e-mail exatos sem colocar identificadores pessoais na URL;
- exportação individual e anonimização exigem sessão administrativa + same-origin + rate limit + step-up MFA;
- `privacy_requests` guarda somente tombstones HMAC-SHA256, nunca telefone/e-mail em texto puro;
- `PRIVACY_HASH_SECRET` é um segredo estável dedicado: em produção deve ter 32+ caracteres e não deve ser rotacionado sem migração das tombstones;
- a anonimização limpa PII, textos livres, personalizações e timeline, mas preserva status e valores agregados do negócio;
- atendimentos ainda ativos ou produção ainda não entregue bloqueiam a anonimização para evitar perda operacional acidental;
- snapshots internos de restore são eliminados no ato, e restores futuros pela API/CLI reaplicam as tombstones antes de gravar dados antigos;
- `npm run check:privacy` inclui self-test de restore e impede regressão desse contrato.

Schema runtime atual: **20**.


## V6.31 — autenticidade criptográfica dos backups

A integridade SHA-256 continua presente, mas backups novos também recebem assinatura HMAC-SHA256. Isso diferencia **arquivo corrompido** de **arquivo autenticado pela instalação Marques**.

Configure em produção:

```env
BACKUP_SIGNING_SECRET=segredo-aleatorio-estavel-com-32-ou-mais-caracteres
BACKUP_SIGNING_KEY_ID=2026-q3
```

Para rotação, troque a chave atual e mantenha temporariamente a anterior em `BACKUP_SIGNING_PREVIOUS_SECRET`. Depois de gerar novos backups com a chave atual e encerrar a janela de retenção dos antigos, remova a anterior. Nunca publique essas chaves no Git.

Validação forte:

```bash
npm run backup:verify -- caminho/backup.json --require-signature
```

Em produção, o restore HTTP exige assinatura válida; `db:restore --apply` também. Um backup legado sem assinatura pode ser analisado em dry-run/staging, mas deve ser convertido em novo backup assinado antes de uma restauração de produção.

Schema runtime permanece **20**.


## V6.32 — backups criptografados em repouso

Backups novos não saem mais do servidor contendo CRM/PII em JSON legível. A aplicação cria primeiro o backup interno assinado da V6.31 e depois o envolve em **AES-256-GCM**, com HKDF-SHA256, salt e IV aleatórios.

Produção:

```env
BACKUP_ENCRYPTION_SECRET=segredo-aleatorio-estavel-com-32-ou-mais-caracteres
BACKUP_ENCRYPTION_KEY_ID=2026-q3
```

Verificação máxima:

```bash
npm run backup:verify -- caminho/backup.encrypted.json --strict
```

`--strict` exige tanto criptografia AES-GCM quanto assinatura HMAC válida. Para rotação, mantenha temporariamente `BACKUP_ENCRYPTION_PREVIOUS_SECRET` até os backups dependentes da chave antiga saírem da retenção ou serem migrados.

Restore real em produção exige envelope criptografado; backups plaintext antigos podem ser inspecionados em staging/dry-run, mas devem ser convertidos para um backup V6.32 antes de uso em produção.

Schema runtime permanece **20**.
