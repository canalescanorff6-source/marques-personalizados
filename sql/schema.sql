CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  image_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  category_id uuid,
  description text NOT NULL DEFAULT '',
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  image_urls text[] NOT NULL DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  stock_status text NOT NULL DEFAULT 'sob_encomenda' CHECK (stock_status IN ('disponivel','sob_encomenda','indisponivel')),
  tags text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  min_quantity integer CHECK (min_quantity IS NULL OR min_quantity >= 1),
  production_time text NOT NULL DEFAULT '',
  seo_title text NOT NULL DEFAULT '',
  seo_description text NOT NULL DEFAULT '',
  badge text NOT NULL DEFAULT '',
  customization_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  publish_at timestamptz,
  unpublish_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_quantity integer CHECK (min_quantity IS NULL OR min_quantity >= 1);
ALTER TABLE products ADD COLUMN IF NOT EXISTS production_time text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS publish_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unpublish_at timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS site_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name text NOT NULL DEFAULT 'Marques Papelaria',
  brand_initial text NOT NULL DEFAULT 'M',
  logo_url text NOT NULL DEFAULT '',
  hero_image_url text NOT NULL DEFAULT '',
  hero_eyebrow text NOT NULL DEFAULT 'Papelaria personalizada • Feita sob encomenda',
  hero_title text NOT NULL DEFAULT 'Detalhes que marcam a festa.',
  hero_highlight text NOT NULL DEFAULT 'marcam',
  hero_description text NOT NULL DEFAULT 'Topos de bolo, caixas, lembrancinhas, flores e kits personalizados com acabamento profissional.',
  whatsapp_number text NOT NULL DEFAULT '',
  instagram_url text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT 'Santa Inês - MA',
  contact_email text NOT NULL DEFAULT '',
  announcement text NOT NULL DEFAULT '',
  announcement_link text NOT NULL DEFAULT '',
  announcement_start_at timestamptz,
  announcement_end_at timestamptz,
  about_title text NOT NULL DEFAULT 'Papelaria feita para impressionar de perto.',
  about_text text NOT NULL DEFAULT 'Cada peça é pensada para o tema, para a montagem e para a experiência final da festa, com atenção à composição, corte e acabamento.',
  seo_title text NOT NULL DEFAULT 'Marques Papelaria | Papelaria Personalizada Premium',
  seo_description text NOT NULL DEFAULT 'Topos de bolo, caixas, lembrancinhas, flores e papelaria personalizada premium.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_image_url text NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS announcement_link text NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS announcement_start_at timestamptz;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS announcement_end_at timestamptz;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS facebook_url text NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS tiktok_url text NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS pinterest_url text NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS youtube_url text NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS google_business_url text NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS google_review_url text NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS social_default_hashtags text NOT NULL DEFAULT '#papelariapersonalizada #festapersonalizada';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS bio_title text NOT NULL DEFAULT 'Papelaria personalizada para momentos únicos.';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS bio_description text NOT NULL DEFAULT 'Veja o catálogo, conheça as coleções e peça seu orçamento pelo WhatsApp.';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS monthly_sales_goal_cents bigint NOT NULL DEFAULT 0;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS pricing_hourly_rate_cents bigint NOT NULL DEFAULT 2000 CHECK (pricing_hourly_rate_cents >= 0);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS pricing_overhead_percent integer NOT NULL DEFAULT 10 CHECK (pricing_overhead_percent BETWEEN 0 AND 100);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS pricing_waste_percent integer NOT NULL DEFAULT 10 CHECK (pricing_waste_percent BETWEEN 0 AND 100);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS pricing_target_margin_percent integer NOT NULL DEFAULT 45 CHECK (pricing_target_margin_percent BETWEEN 0 AND 90);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS pricing_payment_fee_percent integer NOT NULL DEFAULT 0 CHECK (pricing_payment_fee_percent BETWEEN 0 AND 30);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_template_first_contact text NOT NULL DEFAULT 'Olá, {nome}! Tudo bem? Aqui é da {marca}. Recebi sua solicitação sobre {interesse}{data}. Vou te ajudar a montar a melhor opção para o seu evento.';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_template_follow_up text NOT NULL DEFAULT 'Oi, {nome}! Passando para acompanhar seu pedido de {interesse}{data}. Ficou alguma dúvida ou quer que eu ajuste alguma opção para você?';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_template_quote_ready text NOT NULL DEFAULT 'Oi, {nome}! Seu orçamento de {interesse} está pronto{valor}. Posso te explicar os detalhes e próximos passos por aqui.';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_template_confirmation text NOT NULL DEFAULT 'Oi, {nome}! Estou passando para confirmar os detalhes do seu pedido de {interesse}{data}. Assim garantimos que produção, personalização e prazo fiquem certinhos.';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_template_review_request text NOT NULL DEFAULT 'Oi, {nome}! Foi um prazer preparar seu pedido com a {marca}. Se você gostou do resultado, sua avaliação ajuda muito nosso trabalho a chegar a mais pessoas. Você pode avaliar aqui: {link_avaliacao}';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_template_repurchase text NOT NULL DEFAULT 'Oi, {nome}! Tudo bem? Aqui é da {marca}. A data do seu evento do ano passado está se aproximando e eu queria saber se este ano você vai comemorar novamente ou preparar algum outro evento. Se quiser, posso te enviar novas ideias de papelaria personalizada sem compromisso.';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_template_approval text NOT NULL DEFAULT 'Oi, {nome}! A arte do seu pedido de {interesse} está pronta para aprovação. Quando puder, confira os detalhes para seguirmos com a produção.';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_template_ready text NOT NULL DEFAULT 'Oi, {nome}! Seu pedido de {interesse} está pronto. Podemos combinar a entrega ou retirada{data}. Obrigado por escolher a {marca}!';

-- V6.50 — lifecycle de mídia serializado também durante I/O externo do Storage
CREATE TABLE IF NOT EXISTS media_deletion_tombstones (
  url text PRIMARY KEY,
  storage_key text NOT NULL UNIQUE,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  storage_deleted_at timestamptz,
  last_operation text NOT NULL DEFAULT 'delete' CHECK (last_operation IN ('delete','upload')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_error_code text NOT NULL DEFAULT ''
);
ALTER TABLE media_deletion_tombstones ADD COLUMN IF NOT EXISTS storage_deleted_at timestamptz;
ALTER TABLE media_deletion_tombstones ADD COLUMN IF NOT EXISTS last_operation text NOT NULL DEFAULT 'delete';
ALTER TABLE media_deletion_tombstones ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE media_deletion_tombstones ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE media_deletion_tombstones ADD COLUMN IF NOT EXISTS last_error_code text NOT NULL DEFAULT '';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='media_deletion_tombstones_last_operation_check') THEN ALTER TABLE media_deletion_tombstones ADD CONSTRAINT media_deletion_tombstones_last_operation_check CHECK (last_operation IN ('delete','upload')); END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='media_deletion_tombstones_attempt_count_check') THEN ALTER TABLE media_deletion_tombstones ADD CONSTRAINT media_deletion_tombstones_attempt_count_check CHECK (attempt_count>=0); END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_media_deletion_tombstones_deleted_at ON media_deletion_tombstones(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_deletion_tombstones_pending ON media_deletion_tombstones(last_attempt_at) WHERE storage_deleted_at IS NULL AND last_attempt_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS media_lifecycle_leases (
  storage_key text PRIMARY KEY,
  url text NOT NULL UNIQUE,
  operation text NOT NULL CHECK (operation IN ('delete','upload')),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_lifecycle_leases_expires_at ON media_lifecycle_leases(expires_at);

CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  quote text NOT NULL,
  rating smallint NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  event_date date,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','contatado','orcado','fechado','perdido')),
  source text NOT NULL DEFAULT 'site',
  quote_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  admin_notes text NOT NULL DEFAULT '',
  quoted_value_cents integer CHECK (quoted_value_cents IS NULL OR quoted_value_cents >= 0),
  follow_up_at timestamptz,
  event_brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_at timestamptz,
  idempotency_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS quote_items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS admin_notes text NOT NULL DEFAULT '';
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS quoted_value_cents integer CHECK (quoted_value_cents IS NULL OR quoted_value_cents >= 0);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS event_brief jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pendente' CHECK (payment_status IN ('pendente','sinal','pago'));
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS paid_cents bigint NOT NULL DEFAULT 0 CHECK (paid_cents >= 0);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS production_status text NOT NULL DEFAULT 'nao_iniciado' CHECK (production_status IN ('nao_iniciado','arte','aguardando_aprovacao','producao','pronto','entregue'));
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS production_due_at timestamptz;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS repurchase_contacted_at timestamptz;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS repurchase_contact_year integer CHECK (repurchase_contact_year IS NULL OR repurchase_contact_year BETWEEN 2000 AND 2200);
CREATE INDEX IF NOT EXISTS idx_inquiries_production_status_due ON inquiries(production_status,production_due_at) WHERE status='fechado';


CREATE TABLE IF NOT EXISTS inquiry_activity (
  id bigserial PRIMARY KEY,
  inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'update',
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_events_daily (
  day date NOT NULL DEFAULT CURRENT_DATE,
  event text NOT NULL,
  path text NOT NULL DEFAULT '/',
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY(day,event,path)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_rate_limits (
  scope text NOT NULL,
  subject_hash text NOT NULL,
  key_hash text,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  PRIMARY KEY(scope,subject_hash)
);

ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '';
ALTER TABLE request_rate_limits ADD COLUMN IF NOT EXISTS key_hash text;
ALTER TABLE request_rate_limits ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE request_rate_limits SET key_hash=subject_hash WHERE key_hash IS NULL;
UPDATE request_rate_limits SET expires_at=COALESCE(expires_at,window_start+interval '15 minutes') WHERE expires_at IS NULL;
ALTER TABLE request_rate_limits ALTER COLUMN key_hash SET NOT NULL;
ALTER TABLE request_rate_limits ALTER COLUMN expires_at SET NOT NULL;

INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (slug, name, sort_order) VALUES
  ('topos-de-bolo','Topos de bolo',1),
  ('caixinhas-milk','Caixinhas Milk',2),
  ('lembrancinhas','Lembrancinhas',3),
  ('flores','Flores',4),
  ('kits-personalizados','Kits personalizados',5),
  ('outros','Outros',6)
ON CONFLICT DO NOTHING;

UPDATE products p SET category_id=c.id FROM categories c WHERE p.category_id IS NULL AND c.name=p.category;
UPDATE inquiries SET closed_at=updated_at WHERE status='fechado' AND closed_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_category_id_fkey') THEN
    ALTER TABLE products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_products_public_order ON products (active, featured DESC, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_public_category_order ON products(category_id,active,featured DESC,sort_order ASC,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_public_created ON products(active,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_public_price ON products(active,price_cents ASC) WHERE price_cents IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_public_name ON products(active,lower(name));
CREATE INDEX IF NOT EXISTS idx_products_visibility_window ON products(active,publish_at,unpublish_at);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_badge ON products(active,badge) WHERE badge<>'';
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories (active, sort_order ASC, name ASC);
CREATE INDEX IF NOT EXISTS idx_testimonials_public_order ON testimonials (active, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status_created ON inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_follow_up ON inquiries (follow_up_at) WHERE follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_closed_at ON inquiries (closed_at DESC) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiry_activity_inquiry_created ON inquiry_activity(inquiry_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiries_idempotency_key ON inquiries(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_faqs_public_order ON faqs(active,sort_order ASC,created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_faqs_question_unique ON faqs(lower(question));
CREATE INDEX IF NOT EXISTS idx_site_events_daily_event_day ON site_events_daily(event,day DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_rate_limits_window ON request_rate_limits(window_start);
CREATE UNIQUE INDEX IF NOT EXISTS idx_request_rate_limits_scope_key ON request_rate_limits(scope,key_hash) WHERE key_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_request_rate_limits_expiry ON request_rate_limits(expires_at);

CREATE OR REPLACE FUNCTION marques_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at=now();
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION marques_sync_product_category()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target categories%ROWTYPE;
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT * INTO target FROM categories WHERE id=NEW.category_id;
    IF FOUND THEN NEW.category=target.name; END IF;
  ELSIF NEW.category<>'' THEN
    SELECT * INTO target FROM categories WHERE name=NEW.category LIMIT 1;
    IF FOUND THEN NEW.category_id=target.id; END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION marques_cascade_category_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE products SET category=NEW.name WHERE category_id=NEW.id OR (category_id IS NULL AND category=OLD.name);
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION marques_media_key_from_url(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE pos integer; candidate text;
BEGIN
  pos=strpos(COALESCE(p_url,''),'/catalog/');
  IF pos=0 THEN RETURN NULL; END IF;
  candidate=substr(p_url,pos+1);
  candidate=split_part(split_part(candidate,'?',1),'#',1);
  IF candidate NOT LIKE 'catalog/%' OR candidate LIKE '%..%' OR candidate LIKE E'%\\%' THEN RETURN NULL; END IF;
  RETURN candidate;
END
$$;

CREATE OR REPLACE FUNCTION marques_media_url_tombstoned(p_url text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE media_key text;
BEGIN
  IF COALESCE(p_url,'')='' THEN RETURN false; END IF;
  media_key=marques_media_key_from_url(p_url);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_url,0));
  IF media_key IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('media-key:'||media_key,0)); END IF;
  RETURN EXISTS(SELECT 1 FROM media_deletion_tombstones WHERE url=p_url OR (media_key IS NOT NULL AND storage_key=media_key));
END
$$;

CREATE OR REPLACE FUNCTION marques_guard_media_tombstones()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE media_url text;
BEGIN
  IF TG_TABLE_NAME='products' THEN
    FOREACH media_url IN ARRAY COALESCE(NEW.image_urls,'{}'::text[]) LOOP
      IF marques_media_url_tombstoned(media_url) THEN RAISE EXCEPTION 'MEDIA_URL_TOMBSTONED'; END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME='categories' THEN
    IF marques_media_url_tombstoned(COALESCE(NEW.image_url,'')) THEN RAISE EXCEPTION 'MEDIA_URL_TOMBSTONED'; END IF;
  ELSIF TG_TABLE_NAME='site_settings' THEN
    FOREACH media_url IN ARRAY ARRAY[COALESCE(NEW.logo_url,''),COALESCE(NEW.hero_image_url,'')] LOOP
      IF marques_media_url_tombstoned(media_url) THEN RAISE EXCEPTION 'MEDIA_URL_TOMBSTONED'; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION marques_acquire_media_lease(p_url text,p_storage_key text,p_operation text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE active media_lifecycle_leases%ROWTYPE; lease_token uuid; lease_expires timestamptz;
BEGIN
  IF COALESCE(p_url,'')='' OR COALESCE(p_storage_key,'') NOT LIKE 'catalog/%' OR p_storage_key LIKE '%..%' OR p_storage_key LIKE E'%\\%' OR marques_media_key_from_url(p_url) IS DISTINCT FROM p_storage_key THEN RAISE EXCEPTION 'MEDIA_LIFECYCLE_INVALID'; END IF;
  IF p_operation NOT IN ('delete','upload') THEN RAISE EXCEPTION 'MEDIA_LIFECYCLE_OPERATION_INVALID'; END IF;
  -- Serializa o início de qualquer I/O de mídia com restores globais do banco.
  PERFORM pg_advisory_xact_lock(hashtextextended('media-lifecycle-global',0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_url,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('media-key:'||p_storage_key,0));
  -- Uma operação em outra chave nunca deve limpar lease expirada de terceiro: leases órfãs
  -- ficam visíveis ao health/restore até retry explícito da própria mídia.
  DELETE FROM media_lifecycle_leases WHERE (storage_key=p_storage_key OR url=p_url) AND expires_at<=now();
  SELECT * INTO active FROM media_lifecycle_leases WHERE storage_key=p_storage_key OR url=p_url ORDER BY expires_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('state','busy','operation',active.operation,'expires_at',active.expires_at);
  END IF;
  lease_token:=gen_random_uuid();lease_expires:=now()+interval '5 minutes';
  INSERT INTO media_lifecycle_leases(storage_key,url,operation,token,expires_at) VALUES(p_storage_key,p_url,p_operation,lease_token,lease_expires);
  RETURN jsonb_build_object('state','acquired','token',lease_token,'operation',p_operation,'expires_at',lease_expires);
END
$$;

CREATE OR REPLACE FUNCTION marques_cancel_media_lease(p_url text,p_storage_key text,p_token uuid,p_operation text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE removed integer;
BEGIN
  IF p_operation NOT IN ('delete','upload') THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_url,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('media-key:'||p_storage_key,0));
  DELETE FROM media_lifecycle_leases WHERE storage_key=p_storage_key AND url=p_url AND operation=p_operation AND token=p_token RETURNING 1 INTO removed;
  RETURN COALESCE(removed,0)=1;
END
$$;

CREATE OR REPLACE FUNCTION marques_begin_media_delete(p_url text,p_storage_key text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE lease jsonb;
BEGIN
  lease:=marques_acquire_media_lease(p_url,p_storage_key,'delete');
  IF lease->>'state'<>'acquired' THEN RETURN lease; END IF;
  IF EXISTS(SELECT 1 FROM products p CROSS JOIN LATERAL unnest(p.image_urls) media_url WHERE media_url=p_url OR marques_media_key_from_url(media_url)=p_storage_key)
    OR EXISTS(SELECT 1 FROM categories WHERE image_url=p_url OR marques_media_key_from_url(image_url)=p_storage_key)
    OR EXISTS(SELECT 1 FROM site_settings WHERE logo_url=p_url OR hero_image_url=p_url OR marques_media_key_from_url(logo_url)=p_storage_key OR marques_media_key_from_url(hero_image_url)=p_storage_key) THEN
    DELETE FROM media_lifecycle_leases WHERE token=(lease->>'token')::uuid;
    RETURN jsonb_build_object('state','in_use');
  END IF;
  DELETE FROM media_deletion_tombstones WHERE storage_key=p_storage_key AND url<>p_url;
  INSERT INTO media_deletion_tombstones(url,storage_key,deleted_at,storage_deleted_at,last_operation,attempt_count,last_attempt_at,last_error_code)
  VALUES(p_url,p_storage_key,now(),NULL,'delete',1,now(),'')
  ON CONFLICT(url) DO UPDATE SET storage_key=EXCLUDED.storage_key,deleted_at=now(),storage_deleted_at=NULL,last_operation='delete',attempt_count=media_deletion_tombstones.attempt_count+1,last_attempt_at=now(),last_error_code='';
  RETURN lease;
END
$$;

CREATE OR REPLACE FUNCTION marques_complete_media_delete(p_url text,p_storage_key text,p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE removed integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_url,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('media-key:'||p_storage_key,0));
  DELETE FROM media_lifecycle_leases WHERE storage_key=p_storage_key AND url=p_url AND operation='delete' AND token=p_token RETURNING 1 INTO removed;
  IF COALESCE(removed,0)<>1 THEN RETURN false; END IF;
  UPDATE media_deletion_tombstones SET storage_deleted_at=now(),last_operation='delete',last_attempt_at=now(),last_error_code='' WHERE storage_key=p_storage_key AND url=p_url;
  RETURN FOUND;
END
$$;

CREATE OR REPLACE FUNCTION marques_fail_media_delete(p_url text,p_storage_key text,p_token uuid,p_error_code text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE removed integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_url,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('media-key:'||p_storage_key,0));
  DELETE FROM media_lifecycle_leases WHERE storage_key=p_storage_key AND url=p_url AND operation='delete' AND token=p_token RETURNING 1 INTO removed;
  IF COALESCE(removed,0)<>1 THEN RETURN false; END IF;
  UPDATE media_deletion_tombstones SET storage_deleted_at=NULL,last_operation='delete',last_attempt_at=now(),last_error_code=left(COALESCE(p_error_code,'MEDIA_DELETE_FAILED'),80) WHERE storage_key=p_storage_key AND url=p_url;
  RETURN FOUND;
END
$$;

CREATE OR REPLACE FUNCTION marques_begin_media_upload(p_url text,p_storage_key text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN marques_acquire_media_lease(p_url,p_storage_key,'upload');
END
$$;

CREATE OR REPLACE FUNCTION marques_complete_media_upload(p_url text,p_storage_key text,p_token uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE lease_removed integer; tombstone_removed integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_url,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('media-key:'||p_storage_key,0));
  DELETE FROM media_lifecycle_leases WHERE storage_key=p_storage_key AND url=p_url AND operation='upload' AND token=p_token RETURNING 1 INTO lease_removed;
  IF COALESCE(lease_removed,0)<>1 THEN RAISE EXCEPTION 'MEDIA_UPLOAD_LEASE_LOST'; END IF;
  DELETE FROM media_deletion_tombstones WHERE url=p_url OR storage_key=p_storage_key;
  GET DIAGNOSTICS tombstone_removed=ROW_COUNT;
  RETURN tombstone_removed;
END
$$;

CREATE OR REPLACE FUNCTION marques_fail_media_upload(p_url text,p_storage_key text,p_token uuid,p_error_code text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE lease_removed integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_url,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('media-key:'||p_storage_key,0));
  DELETE FROM media_lifecycle_leases WHERE storage_key=p_storage_key AND url=p_url AND operation='upload' AND token=p_token RETURNING 1 INTO lease_removed;
  IF COALESCE(lease_removed,0)<>1 THEN RETURN false; END IF;
  DELETE FROM media_deletion_tombstones WHERE storage_key=p_storage_key AND url<>p_url;
  INSERT INTO media_deletion_tombstones(url,storage_key,deleted_at,storage_deleted_at,last_operation,attempt_count,last_attempt_at,last_error_code)
  VALUES(p_url,p_storage_key,now(),NULL,'upload',1,now(),left(COALESCE(p_error_code,'MEDIA_UPLOAD_FAILED'),80))
  ON CONFLICT(url) DO UPDATE SET storage_key=EXCLUDED.storage_key,storage_deleted_at=NULL,last_operation='upload',attempt_count=media_deletion_tombstones.attempt_count+1,last_attempt_at=now(),last_error_code=EXCLUDED.last_error_code;
  RETURN true;
END
$$;

-- Remove os atalhos V6.48/V6.49 que não serializavam a chamada externa ao Storage.
DROP FUNCTION IF EXISTS marques_reserve_media_delete(text,text);
DROP FUNCTION IF EXISTS marques_reactivate_media(text,text);

DROP TRIGGER IF EXISTS trg_products_touch_updated_at ON products;
CREATE TRIGGER trg_products_touch_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION marques_touch_updated_at();
DROP TRIGGER IF EXISTS trg_categories_touch_updated_at ON categories;
CREATE TRIGGER trg_categories_touch_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION marques_touch_updated_at();
DROP TRIGGER IF EXISTS trg_site_settings_touch_updated_at ON site_settings;
CREATE TRIGGER trg_site_settings_touch_updated_at BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION marques_touch_updated_at();
DROP TRIGGER IF EXISTS trg_testimonials_touch_updated_at ON testimonials;
CREATE TRIGGER trg_testimonials_touch_updated_at BEFORE UPDATE ON testimonials FOR EACH ROW EXECUTE FUNCTION marques_touch_updated_at();
DROP TRIGGER IF EXISTS trg_inquiries_touch_updated_at ON inquiries;
CREATE TRIGGER trg_inquiries_touch_updated_at BEFORE UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION marques_touch_updated_at();
DROP TRIGGER IF EXISTS trg_faqs_touch_updated_at ON faqs;
CREATE TRIGGER trg_faqs_touch_updated_at BEFORE UPDATE ON faqs FOR EACH ROW EXECUTE FUNCTION marques_touch_updated_at();
DROP TRIGGER IF EXISTS trg_products_sync_category ON products;
CREATE TRIGGER trg_products_sync_category BEFORE INSERT OR UPDATE OF category,category_id ON products FOR EACH ROW EXECUTE FUNCTION marques_sync_product_category();
DROP TRIGGER IF EXISTS trg_categories_cascade_name ON categories;
CREATE TRIGGER trg_categories_cascade_name AFTER UPDATE OF name ON categories FOR EACH ROW EXECUTE FUNCTION marques_cascade_category_name();

DROP TRIGGER IF EXISTS trg_products_media_tombstone_guard ON products;
CREATE TRIGGER trg_products_media_tombstone_guard BEFORE INSERT OR UPDATE OF image_urls ON products FOR EACH ROW EXECUTE FUNCTION marques_guard_media_tombstones();
DROP TRIGGER IF EXISTS trg_categories_media_tombstone_guard ON categories;
CREATE TRIGGER trg_categories_media_tombstone_guard BEFORE INSERT OR UPDATE OF image_url ON categories FOR EACH ROW EXECUTE FUNCTION marques_guard_media_tombstones();
DROP TRIGGER IF EXISTS trg_site_settings_media_tombstone_guard ON site_settings;
CREATE TRIGGER trg_site_settings_media_tombstone_guard BEFORE INSERT OR UPDATE OF logo_url,hero_image_url ON site_settings FOR EACH ROW EXECUTE FUNCTION marques_guard_media_tombstones();

-- V6 Social commerce / planejamento de conteúdo
CREATE TABLE IF NOT EXISTS social_content_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('instagram','whatsapp','facebook','tiktok','pinterest','youtube')),
  planned_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','publicado','cancelado')),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  campaign text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_social_content_plans_planned_at ON social_content_plans(planned_at ASC);
CREATE INDEX IF NOT EXISTS idx_social_content_plans_status ON social_content_plans(status,planned_at ASC);


-- V6 Growth: campanhas rastreáveis com metas comerciais
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'instagram' CHECK (channel IN ('instagram','whatsapp','facebook','tiktok','pinterest','youtube','google','outro')),
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada','ativa','encerrada')),
  starts_at timestamptz,
  ends_at timestamptz,
  goal_leads integer NOT NULL DEFAULT 0 CHECK (goal_leads >= 0),
  goal_revenue_cents bigint NOT NULL DEFAULT 0 CHECK (goal_revenue_cents >= 0),
  spend_cents bigint NOT NULL DEFAULT 0 CHECK (spend_cents >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status_period ON marketing_campaigns(status,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_channel ON marketing_campaigns(channel,status);
ALTER TABLE marketing_campaigns ADD COLUMN IF NOT EXISTS spend_cents bigint NOT NULL DEFAULT 0 CHECK (spend_cents >= 0);


-- V6.22 Concurrency & Performance: invariantes no banco + índices de carga
CREATE OR REPLACE FUNCTION marques_campaign_slug_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug THEN
    RAISE EXCEPTION 'MARKETING_CAMPAIGN_SLUG_IMMUTABLE';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS marketing_campaign_slug_immutable ON marketing_campaigns;
CREATE TRIGGER marketing_campaign_slug_immutable BEFORE UPDATE OF slug ON marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION marques_campaign_slug_immutable();

CREATE INDEX IF NOT EXISTS idx_products_public_stock_order
  ON products(stock_status,active,featured DESC,sort_order ASC,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_payment_created
  ON inquiries(payment_status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_production_created
  ON inquiries(production_status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_source_created
  ON inquiries(source,created_at DESC);


-- V6.15 Security: sessões administrativas revogáveis / controle de dispositivos
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash text NOT NULL UNIQUE,
  device_label text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  user_agent_hash text NOT NULL DEFAULT '',
  ip_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  mfa_verified_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(expires_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_cleanup ON admin_sessions(COALESCE(revoked_at,expires_at));
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz;

-- V6.16 MFA/TOTP: impede reutilização da mesma janela TOTP em produção
CREATE TABLE IF NOT EXISTS admin_mfa_used_steps (
  step bigint PRIMARY KEY,
  used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_used_steps_cleanup ON admin_mfa_used_steps(used_at);

-- V6.17 MFA Recovery + device awareness
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS device_hash text NOT NULL DEFAULT '';
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'password' CHECK (auth_method IN ('password','totp','recovery'));
CREATE INDEX IF NOT EXISTS idx_admin_sessions_device_hash ON admin_sessions(device_hash) WHERE device_hash<>'';

CREATE TABLE IF NOT EXISTS admin_mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_recovery_codes_unused ON admin_mfa_recovery_codes(created_at DESC) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_known_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_hash text NOT NULL UNIQUE,
  device_label text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  user_agent_hash text NOT NULL DEFAULT '',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_admin_known_devices_active ON admin_known_devices(last_login_at DESC) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_security_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('new_device_login','recovery_code_login','recovery_codes_rotated','device_revoked')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  device_hash text NOT NULL DEFAULT '',
  device_label text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_admin_security_events_unread ON admin_security_events(created_at DESC) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_security_events_recent ON admin_security_events(created_at DESC);


-- V6.18 Step-up authentication + security alert delivery
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS last_reauth_at timestamptz;

ALTER TABLE admin_security_events DROP CONSTRAINT IF EXISTS admin_security_events_event_type_check;
ALTER TABLE admin_security_events ADD CONSTRAINT admin_security_events_event_type_check
  CHECK (event_type IN (
    'new_device_login',
    'recovery_code_login',
    'recovery_codes_rotated',
    'device_revoked',
    'critical_reauth',
    'critical_action',
    'security_webhook_failed'
  ));


-- V6.19 Observabilidade + auditoria append-only + recuperação operacional
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical'));
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS request_id text NOT NULL DEFAULT '';
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS actor_session_id uuid;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS actor_device_hash text NOT NULL DEFAULT '';
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT '';
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS integrity_hash text NOT NULL DEFAULT '';
UPDATE admin_audit_log
SET integrity_hash=encode(digest(concat_ws('|',action,entity_type,entity_id,summary,metadata::text),'sha256'),'hex')
WHERE integrity_hash='';
CREATE INDEX IF NOT EXISTS idx_admin_audit_severity_created ON admin_audit_log(severity,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_request_id ON admin_audit_log(request_id) WHERE request_id<>'';

CREATE OR REPLACE FUNCTION admin_audit_set_integrity_hash() RETURNS trigger AS $$
BEGIN
  NEW.integrity_hash := encode(digest(concat_ws('|',NEW.action,NEW.entity_type,NEW.entity_id,NEW.summary,NEW.metadata::text),'sha256'),'hex');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS admin_audit_hash_before_insert ON admin_audit_log;
CREATE TRIGGER admin_audit_hash_before_insert BEFORE INSERT ON admin_audit_log
FOR EACH ROW EXECUTE FUNCTION admin_audit_set_integrity_hash();

CREATE OR REPLACE FUNCTION admin_audit_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS admin_audit_append_only ON admin_audit_log;
CREATE TRIGGER admin_audit_append_only BEFORE UPDATE OR DELETE ON admin_audit_log
FOR EACH ROW EXECUTE FUNCTION admin_audit_reject_mutation();

CREATE TABLE IF NOT EXISTS operational_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  scope text NOT NULL,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('warning','error','critical')),
  status_code integer NOT NULL DEFAULT 500 CHECK (status_code BETWEEN 400 AND 599),
  error_name text NOT NULL DEFAULT 'Error',
  message text NOT NULL DEFAULT '',
  last_reference text NOT NULL DEFAULT '',
  occurrences bigint NOT NULL DEFAULT 1 CHECK (occurrences >= 1),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_operational_incidents_open ON operational_incidents(last_seen_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_operational_incidents_recent ON operational_incidents(last_seen_at DESC);


-- V6.20 Recuperação segura: snapshots pré-restauração + restore atômico
CREATE TABLE IF NOT EXISTS admin_restore_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_backup_sha256 text NOT NULL DEFAULT '',
  snapshot_sha256 text NOT NULL,
  payload jsonb NOT NULL,
  counts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  restored_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_admin_restore_snapshots_recent ON admin_restore_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_restore_snapshots_expiry ON admin_restore_snapshots(expires_at);

CREATE OR REPLACE FUNCTION marques_current_business_restore_payload() RETURNS jsonb AS $$
SELECT jsonb_build_object(
  'products',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at,t.id) FROM products t WHERE t.deleted_at IS NULL),'[]'::jsonb),
  'archived_products',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at,t.id) FROM products t WHERE t.deleted_at IS NOT NULL),'[]'::jsonb),
  'categories',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.sort_order,t.name,t.id) FROM categories t),'[]'::jsonb),
  'inquiries',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at,t.id) FROM inquiries t),'[]'::jsonb),
  'settings',COALESCE((SELECT to_jsonb(t) FROM site_settings t WHERE t.id=1),'{}'::jsonb),
  'testimonials',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.sort_order,t.created_at,t.id) FROM testimonials t),'[]'::jsonb),
  'faqs',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.sort_order,t.created_at,t.id) FROM faqs t),'[]'::jsonb),
  'inquiry_activity',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at,t.id) FROM inquiry_activity t),'[]'::jsonb),
  'social_content_plans',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.planned_at,t.id) FROM social_content_plans t),'[]'::jsonb),
  'marketing_campaigns',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at,t.id) FROM marketing_campaigns t),'[]'::jsonb),
  'site_events_daily',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.day,t.event,t.path) FROM site_events_daily t),'[]'::jsonb),
  'media_deletion_tombstones',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.storage_key,t.url) FROM media_deletion_tombstones t),'[]'::jsonb)
)
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION marques_restore_payload_counts(p_payload jsonb) RETURNS jsonb AS $$
SELECT jsonb_build_object(
  'products',jsonb_array_length(COALESCE(p_payload->'products','[]'::jsonb)),
  'archived_products',jsonb_array_length(COALESCE(p_payload->'archived_products','[]'::jsonb)),
  'categories',jsonb_array_length(COALESCE(p_payload->'categories','[]'::jsonb)),
  'inquiries',jsonb_array_length(COALESCE(p_payload->'inquiries','[]'::jsonb)),
  'settings',CASE WHEN jsonb_typeof(p_payload->'settings')='object' AND p_payload->'settings'<>'{}'::jsonb THEN 1 ELSE 0 END,
  'testimonials',jsonb_array_length(COALESCE(p_payload->'testimonials','[]'::jsonb)),
  'faqs',jsonb_array_length(COALESCE(p_payload->'faqs','[]'::jsonb)),
  'inquiry_activity',jsonb_array_length(COALESCE(p_payload->'inquiry_activity','[]'::jsonb)),
  'social_content_plans',jsonb_array_length(COALESCE(p_payload->'social_content_plans','[]'::jsonb)),
  'marketing_campaigns',jsonb_array_length(COALESCE(p_payload->'marketing_campaigns','[]'::jsonb)),
  'site_events_daily',jsonb_array_length(COALESCE(p_payload->'site_events_daily','[]'::jsonb))
)
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION marques_current_business_restore_counts() RETURNS jsonb AS $$
SELECT jsonb_build_object(
  'products',(SELECT count(*)::int FROM products WHERE deleted_at IS NULL),
  'archived_products',(SELECT count(*)::int FROM products WHERE deleted_at IS NOT NULL),
  'categories',(SELECT count(*)::int FROM categories),
  'inquiries',(SELECT count(*)::int FROM inquiries),
  'settings',(SELECT count(*)::int FROM site_settings WHERE id=1),
  'testimonials',(SELECT count(*)::int FROM testimonials),
  'faqs',(SELECT count(*)::int FROM faqs),
  'inquiry_activity',(SELECT count(*)::int FROM inquiry_activity),
  'social_content_plans',(SELECT count(*)::int FROM social_content_plans),
  'marketing_campaigns',(SELECT count(*)::int FROM marketing_campaigns),
  'site_events_daily',(SELECT count(*)::int FROM site_events_daily)
)
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION marques_create_restore_snapshot(p_source_backup_sha256 text)
RETURNS TABLE(snapshot_id uuid,snapshot_sha256 text,counts jsonb,created_at timestamptz,expires_at timestamptz) AS $$
DECLARE p jsonb; h text;
BEGIN
  DELETE FROM admin_restore_snapshots WHERE expires_at<now();
  p:=marques_current_business_restore_payload();
  h:=encode(digest(p::text,'sha256'),'hex');
  RETURN QUERY INSERT INTO admin_restore_snapshots(source_backup_sha256,snapshot_sha256,payload,counts)
    VALUES(COALESCE(p_source_backup_sha256,''),h,p,marques_restore_payload_counts(p))
    RETURNING id,admin_restore_snapshots.snapshot_sha256,admin_restore_snapshots.counts,admin_restore_snapshots.created_at,admin_restore_snapshots.expires_at;
  DELETE FROM admin_restore_snapshots WHERE id IN (SELECT id FROM admin_restore_snapshots ORDER BY created_at DESC OFFSET 10);
END
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS marques_restore_business_payload(jsonb,jsonb,text);
DROP FUNCTION IF EXISTS marques_restore_business_payload(jsonb,jsonb,text,jsonb);
CREATE OR REPLACE FUNCTION marques_restore_business_payload(
  p_payload jsonb,
  p_expected_counts jsonb,
  p_source_backup_sha256 text DEFAULT '',
  p_privacy_tombstones jsonb DEFAULT '[]'::jsonb,
  p_media_tombstone_mode text DEFAULT 'merge'
) RETURNS jsonb AS $$
DECLARE actual jsonb; seq text; before_payload jsonb; safety_id uuid; safety_sha text; safety_expires timestamptz; normalized_inquiries jsonb; restore_generation bigint; tombstone_count integer:=0; media_tombstone_count integer:=0; media_tombstone_mode text:='preserved';
BEGIN
  IF jsonb_typeof(p_payload)<>'object' OR jsonb_typeof(p_payload->'settings')<>'object' THEN RAISE EXCEPTION 'restore payload invalid'; END IF;
  IF p_media_tombstone_mode NOT IN ('merge','exact') THEN RAISE EXCEPTION 'media tombstone mode invalid'; END IF;
  IF jsonb_typeof(COALESCE(p_privacy_tombstones,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'privacy tombstones invalid'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_privacy_tombstones,'[]'::jsonb)) item
    WHERE jsonb_typeof(item)<>'object'
      OR COALESCE(item->>'subject_hash','') !~ '^[0-9a-fA-F]{64}$'
      OR COALESCE(item->>'identity_type','') NOT IN ('phone','email')
      OR COALESCE(item->>'action','anonymized')<>'anonymized'
  ) THEN RAISE EXCEPTION 'privacy tombstone invalid'; END IF;
  IF p_payload ? 'media_deletion_tombstones' THEN
    IF jsonb_typeof(p_payload->'media_deletion_tombstones')<>'array' THEN RAISE EXCEPTION 'media tombstones invalid'; END IF;
    IF EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_payload->'media_deletion_tombstones') item
      WHERE jsonb_typeof(item)<>'object'
        OR COALESCE(item->>'url','')=''
        OR COALESCE(item->>'storage_key','') NOT LIKE 'catalog/%'
        OR COALESCE(item->>'storage_key','') LIKE '%..%'
        OR COALESCE(item->>'storage_key','') LIKE E'%\%'
        OR marques_media_key_from_url(item->>'url') IS DISTINCT FROM item->>'storage_key'
        OR COALESCE(item->>'deleted_at','')=''
    ) THEN RAISE EXCEPTION 'media tombstone invalid'; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(p_payload->'media_deletion_tombstones')) IS DISTINCT FROM (SELECT count(DISTINCT item->>'storage_key') FROM jsonb_array_elements(p_payload->'media_deletion_tombstones') item) THEN RAISE EXCEPTION 'media tombstone storage key duplicate'; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(p_payload->'media_deletion_tombstones')) IS DISTINCT FROM (SELECT count(DISTINCT item->>'url') FROM jsonb_array_elements(p_payload->'media_deletion_tombstones') item) THEN RAISE EXCEPTION 'media tombstone url duplicate'; END IF;
  END IF;
  -- Compatibilidade V6.19–V6.22: snapshots/backups antigos não possuíam inquiries.version.
  -- Cada restore recebe uma geração nova para invalidar drafts abertos antes da restauração.
  restore_generation:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  SELECT COALESCE(jsonb_agg(
    CASE WHEN jsonb_typeof(item)='object' THEN jsonb_set(item,'{version}',to_jsonb(
      restore_generation + GREATEST(CASE WHEN COALESCE(item->>'version','') ~ '^[0-9]+$' THEN (item->>'version')::bigint ELSE 1 END,1)
    ),true) ELSE item END
  ),'[]'::jsonb) INTO normalized_inquiries
  FROM jsonb_array_elements(COALESCE(p_payload->'inquiries','[]'::jsonb)) item;
  p_payload:=jsonb_set(p_payload,'{inquiries}',normalized_inquiries,true);
  IF marques_restore_payload_counts(p_payload)<>p_expected_counts THEN RAISE EXCEPTION 'restore payload count mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('marques_restore_business_payload'));
  -- Nenhum restore pode atravessar um PutObject/DeleteObject já iniciado. Novos begins
  -- ficam serializados pelo mesmo lock global; leases existentes fazem o restore abortar.
  PERFORM pg_advisory_xact_lock(hashtextextended('media-lifecycle-global',0));
  IF EXISTS(SELECT 1 FROM media_lifecycle_leases) THEN RAISE EXCEPTION 'MEDIA_LIFECYCLE_ACTIVE'; END IF;

  -- V6.33: o vault de tombstones viaja dentro do backup criptografado e é mesclado
  -- na mesma transação antes de qualquer troca do CRM. Isso preserva apagamentos
  -- conhecidos pelo backup mesmo após reconstrução completa do Neon.
  INSERT INTO privacy_requests(subject_hash,identity_type,action,matched_inquiries,created_at,last_applied_at)
  SELECT
    lower(item->>'subject_hash'),
    item->>'identity_type',
    'anonymized',
    GREATEST(CASE WHEN COALESCE(item->>'matched_inquiries','') ~ '^[0-9]+$' THEN (item->>'matched_inquiries')::integer ELSE 0 END,0),
    CASE WHEN COALESCE(item->>'created_at','')<>'' THEN (item->>'created_at')::timestamptz ELSE now() END,
    CASE WHEN COALESCE(item->>'last_applied_at','')<>'' THEN (item->>'last_applied_at')::timestamptz ELSE now() END
  FROM jsonb_array_elements(COALESCE(p_privacy_tombstones,'[]'::jsonb)) item
  ON CONFLICT(subject_hash,identity_type) DO UPDATE SET
    action='anonymized',
    matched_inquiries=GREATEST(privacy_requests.matched_inquiries,EXCLUDED.matched_inquiries),
    created_at=LEAST(privacy_requests.created_at,EXCLUDED.created_at),
    last_applied_at=GREATEST(privacy_requests.last_applied_at,EXCLUDED.last_applied_at);
  GET DIAGNOSTICS tombstone_count=ROW_COUNT;

  LOCK TABLE inquiry_activity,social_content_plans,inquiries,products,categories,testimonials,faqs,marketing_campaigns,site_events_daily,site_settings,media_deletion_tombstones IN ACCESS EXCLUSIVE MODE;
  DELETE FROM admin_restore_snapshots WHERE expires_at<now();
  before_payload:=marques_current_business_restore_payload();
  safety_sha:=encode(digest(before_payload::text,'sha256'),'hex');
  INSERT INTO admin_restore_snapshots(source_backup_sha256,snapshot_sha256,payload,counts)
    VALUES(COALESCE(p_source_backup_sha256,''),safety_sha,before_payload,marques_restore_payload_counts(before_payload))
    RETURNING id,expires_at INTO safety_id,safety_expires;

  DELETE FROM inquiry_activity;
  DELETE FROM social_content_plans;
  DELETE FROM inquiries;
  DELETE FROM products;
  DELETE FROM categories;
  DELETE FROM testimonials;
  DELETE FROM faqs;
  DELETE FROM marketing_campaigns;
  DELETE FROM site_events_daily;
  DELETE FROM site_settings;

  IF p_payload ? 'media_deletion_tombstones' THEN
    IF p_media_tombstone_mode='exact' THEN
      DELETE FROM media_deletion_tombstones;
      INSERT INTO media_deletion_tombstones(url,storage_key,deleted_at)
      SELECT url,storage_key,deleted_at FROM jsonb_populate_recordset(NULL::media_deletion_tombstones,p_payload->'media_deletion_tombstones');
      GET DIAGNOSTICS media_tombstone_count=ROW_COUNT;
      media_tombstone_mode:='exact';
    ELSE
      INSERT INTO media_deletion_tombstones(url,storage_key,deleted_at)
      SELECT url,storage_key,deleted_at FROM jsonb_populate_recordset(NULL::media_deletion_tombstones,p_payload->'media_deletion_tombstones')
      ON CONFLICT(storage_key) DO UPDATE SET url=EXCLUDED.url,deleted_at=GREATEST(media_deletion_tombstones.deleted_at,EXCLUDED.deleted_at);
      GET DIAGNOSTICS media_tombstone_count=ROW_COUNT;
      media_tombstone_mode:='merged';
    END IF;
  END IF;

  INSERT INTO categories SELECT * FROM jsonb_populate_recordset(NULL::categories,COALESCE(p_payload->'categories','[]'::jsonb));
  INSERT INTO products SELECT * FROM jsonb_populate_recordset(NULL::products,COALESCE(p_payload->'products','[]'::jsonb)||COALESCE(p_payload->'archived_products','[]'::jsonb));
  INSERT INTO site_settings SELECT * FROM jsonb_populate_record(NULL::site_settings,p_payload->'settings');
  INSERT INTO testimonials SELECT * FROM jsonb_populate_recordset(NULL::testimonials,COALESCE(p_payload->'testimonials','[]'::jsonb));
  INSERT INTO faqs SELECT * FROM jsonb_populate_recordset(NULL::faqs,COALESCE(p_payload->'faqs','[]'::jsonb));
  INSERT INTO marketing_campaigns SELECT * FROM jsonb_populate_recordset(NULL::marketing_campaigns,COALESCE(p_payload->'marketing_campaigns','[]'::jsonb));
  INSERT INTO inquiries SELECT * FROM jsonb_populate_recordset(NULL::inquiries,COALESCE(p_payload->'inquiries','[]'::jsonb));
  INSERT INTO inquiry_activity SELECT * FROM jsonb_populate_recordset(NULL::inquiry_activity,COALESCE(p_payload->'inquiry_activity','[]'::jsonb));
  INSERT INTO social_content_plans SELECT * FROM jsonb_populate_recordset(NULL::social_content_plans,COALESCE(p_payload->'social_content_plans','[]'::jsonb));
  INSERT INTO site_events_daily SELECT * FROM jsonb_populate_recordset(NULL::site_events_daily,COALESCE(p_payload->'site_events_daily','[]'::jsonb));

  actual:=marques_current_business_restore_counts();
  IF actual<>p_expected_counts THEN RAISE EXCEPTION 'restore result count mismatch: expected %, actual %',p_expected_counts,actual; END IF;
  seq:=pg_get_serial_sequence('inquiry_activity','id');
  IF seq IS NOT NULL THEN PERFORM setval(seq,GREATEST(COALESCE((SELECT max(id) FROM inquiry_activity),1),1),(SELECT count(*)>0 FROM inquiry_activity)); END IF;
  DELETE FROM admin_restore_snapshots WHERE id IN (SELECT id FROM admin_restore_snapshots ORDER BY created_at DESC OFFSET 10);
  RETURN jsonb_build_object('counts',actual,'snapshot_id',safety_id,'snapshot_sha256',safety_sha,'snapshot_expires_at',safety_expires,'privacy_tombstones_merged',tombstone_count,'media_tombstones_mode',media_tombstone_mode,'media_tombstones_restored',media_tombstone_count);
END
$$ LANGUAGE plpgsql;


-- V6.23 Resiliência comercial: versionamento monotônico + invariantes de CRM
CREATE INDEX IF NOT EXISTS idx_inquiries_version ON inquiries(id,version);
CREATE INDEX IF NOT EXISTS idx_inquiries_terminal_history ON inquiries(created_at DESC,id DESC) WHERE status IN ('fechado','perdido');
CREATE INDEX IF NOT EXISTS idx_inquiries_open_attention ON inquiries(follow_up_at,created_at DESC) WHERE status NOT IN ('fechado','perdido');

CREATE OR REPLACE FUNCTION marques_inquiry_version_monotonic() RETURNS trigger AS $$
BEGIN
  NEW.version:=GREATEST(COALESCE(NEW.version,0),COALESCE(OLD.version,1)+1,2);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_inquiries_version_monotonic ON inquiries;
CREATE TRIGGER trg_inquiries_version_monotonic BEFORE UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION marques_inquiry_version_monotonic();

CREATE OR REPLACE FUNCTION marques_inquiry_commercial_guard() RETURNS trigger AS $$
DECLARE commercial_changed boolean;
BEGIN
  commercial_changed:=TG_OP='INSERT' OR ROW(NEW.status,NEW.quoted_value_cents,NEW.payment_status,NEW.paid_cents,NEW.production_status)
    IS DISTINCT FROM ROW(OLD.status,OLD.quoted_value_cents,OLD.payment_status,OLD.paid_cents,OLD.production_status);
  IF NOT commercial_changed THEN RETURN NEW; END IF;
  IF NEW.payment_status='pendente' AND COALESCE(NEW.paid_cents,0)>0 THEN
    RAISE EXCEPTION 'CRM_PAYMENT_PENDING_WITH_VALUE' USING ERRCODE='23514';
  END IF;
  IF NEW.payment_status='sinal' AND (COALESCE(NEW.quoted_value_cents,0)<=0 OR COALESCE(NEW.paid_cents,0)<=0 OR NEW.paid_cents>=NEW.quoted_value_cents) THEN
    RAISE EXCEPTION 'CRM_PAYMENT_SIGNAL_INVALID' USING ERRCODE='23514';
  END IF;
  IF NEW.payment_status='pago' AND (COALESCE(NEW.quoted_value_cents,0)<=0 OR COALESCE(NEW.paid_cents,0)<NEW.quoted_value_cents) THEN
    RAISE EXCEPTION 'CRM_PAYMENT_PAID_INVALID' USING ERRCODE='23514';
  END IF;
  IF NEW.production_status<>'nao_iniciado' AND NEW.status<>'fechado' THEN
    RAISE EXCEPTION 'CRM_PRODUCTION_REQUIRES_CLOSED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_inquiries_commercial_guard ON inquiries;
CREATE TRIGGER trg_inquiries_commercial_guard BEFORE INSERT OR UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION marques_inquiry_commercial_guard();


-- V6.26 Produção escalável: fila ativa, pós-venda e histórico entregue por cursor
CREATE INDEX IF NOT EXISTS idx_inquiries_delivered_history ON inquiries(updated_at DESC,id DESC) WHERE status='fechado' AND production_status='entregue';
CREATE INDEX IF NOT EXISTS idx_inquiries_post_sale_pending ON inquiries(updated_at DESC,id DESC) WHERE status='fechado' AND production_status='entregue' AND review_requested_at IS NULL;

-- V6.27 Agenda escalável: calendário global por janela sem depender do CRM paginado
CREATE INDEX IF NOT EXISTS idx_inquiries_event_agenda ON inquiries(event_date,id) WHERE status<>'perdido' AND event_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_follow_up_agenda ON inquiries(follow_up_at,id) WHERE status NOT IN ('fechado','perdido') AND follow_up_at IS NOT NULL;


-- V6.28 Reativação global: ciclo anual rastreável sem depender do CRM paginado
CREATE OR REPLACE FUNCTION marques_anniversary_date(p_event_date date,p_year integer) RETURNS date AS $$
SELECT make_date(
  p_year,
  extract(month from p_event_date)::int,
  LEAST(
    extract(day from p_event_date)::int,
    extract(day from (date_trunc('month',make_date(p_year,extract(month from p_event_date)::int,1))+interval '1 month - 1 day'))::int
  )
)
$$ LANGUAGE sql IMMUTABLE STRICT;
CREATE INDEX IF NOT EXISTS idx_inquiries_repurchase_event ON inquiries(event_date,id) WHERE status='fechado' AND event_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_repurchase_contact ON inquiries(repurchase_contact_year,repurchase_contacted_at DESC) WHERE repurchase_contacted_at IS NOT NULL;

-- V6.29 Auditoria tamper-evident: cadeia criptográfica serializada por ID
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS prev_integrity_hash text NOT NULL DEFAULT '';
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS chain_version smallint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS admin_audit_chain_state (
  singleton smallint PRIMARY KEY DEFAULT 1 CHECK (singleton=1),
  last_audit_id bigint,
  last_hash text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO admin_audit_chain_state(singleton,last_audit_id,last_hash)
VALUES(1,NULL,'') ON CONFLICT(singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION marques_admin_audit_hash(
  p_prev_integrity_hash text,
  p_id bigint,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_summary text,
  p_metadata jsonb,
  p_severity text,
  p_request_id text,
  p_actor_session_id uuid,
  p_actor_device_hash text,
  p_auth_method text,
  p_created_at timestamptz
) RETURNS text AS $$
SELECT encode(digest(jsonb_build_object(
  'v',1,
  'prev',COALESCE(p_prev_integrity_hash,''),
  'id',p_id,
  'action',COALESCE(p_action,''),
  'entity_type',COALESCE(p_entity_type,''),
  'entity_id',COALESCE(p_entity_id,''),
  'summary',COALESCE(p_summary,''),
  'metadata',COALESCE(p_metadata,'{}'::jsonb),
  'severity',COALESCE(p_severity,''),
  'request_id',COALESCE(p_request_id,''),
  'actor_session_id',COALESCE(p_actor_session_id::text,''),
  'actor_device_hash',COALESCE(p_actor_device_hash,''),
  'auth_method',COALESCE(p_auth_method,''),
  'created_at_us',floor(extract(epoch from p_created_at)*1000000)::bigint
)::text,'sha256'),'hex')
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION admin_audit_chain_prepare() RETURNS trigger AS $$
DECLARE
  state_row admin_audit_chain_state%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(62829001);
  SELECT * INTO state_row FROM admin_audit_chain_state WHERE singleton=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'admin audit chain state missing'; END IF;
  IF state_row.last_audit_id IS NOT NULL AND NEW.id<=state_row.last_audit_id THEN
    RAISE EXCEPTION 'admin audit id must be monotonic';
  END IF;
  NEW.prev_integrity_hash:=COALESCE(state_row.last_hash,'');
  NEW.chain_version:=1;
  NEW.integrity_hash:=marques_admin_audit_hash(
    NEW.prev_integrity_hash,NEW.id,NEW.action,NEW.entity_type,NEW.entity_id,NEW.summary,NEW.metadata,
    NEW.severity,NEW.request_id,NEW.actor_session_id,NEW.actor_device_hash,NEW.auth_method,NEW.created_at
  );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION admin_audit_chain_advance() RETURNS trigger AS $$
BEGIN
  UPDATE admin_audit_chain_state
  SET last_audit_id=NEW.id,last_hash=NEW.integrity_hash,updated_at=now()
  WHERE singleton=1;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Migração + troca de triggers em uma única instrução transacional. Se o backfill
-- falhar, a proteção append-only anterior não fica removida pela metade.
DO $$
DECLARE
  rec record;
  previous_hash text := '';
  calculated_hash text := '';
  final_id bigint := NULL;
BEGIN
  PERFORM pg_advisory_xact_lock(62829001);
  EXECUTE 'DROP TRIGGER IF EXISTS admin_audit_append_only ON admin_audit_log';
  EXECUTE 'DROP TRIGGER IF EXISTS admin_audit_hash_before_insert ON admin_audit_log';
  EXECUTE 'DROP TRIGGER IF EXISTS admin_audit_chain_before_insert ON admin_audit_log';
  EXECUTE 'DROP TRIGGER IF EXISTS admin_audit_chain_after_insert ON admin_audit_log';

  -- Registros anteriores à V6.29 chegam como chain_version=0. O backfill só
  -- acontece nesse estado de migração; setup posterior não mascara adulteração.
  IF EXISTS(SELECT 1 FROM admin_audit_log WHERE chain_version=0) THEN
    FOR rec IN SELECT * FROM admin_audit_log ORDER BY id FOR UPDATE LOOP
      calculated_hash:=marques_admin_audit_hash(
        previous_hash,rec.id,rec.action,rec.entity_type,rec.entity_id,rec.summary,rec.metadata,
        rec.severity,rec.request_id,rec.actor_session_id,rec.actor_device_hash,rec.auth_method,rec.created_at
      );
      UPDATE admin_audit_log
      SET prev_integrity_hash=previous_hash,integrity_hash=calculated_hash,chain_version=1
      WHERE id=rec.id;
      previous_hash:=calculated_hash;
      final_id:=rec.id;
    END LOOP;
    UPDATE admin_audit_chain_state
    SET last_audit_id=final_id,last_hash=previous_hash,updated_at=now()
    WHERE singleton=1;
  END IF;

  EXECUTE 'CREATE TRIGGER admin_audit_chain_before_insert BEFORE INSERT ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION admin_audit_chain_prepare()';
  EXECUTE 'CREATE TRIGGER admin_audit_chain_after_insert AFTER INSERT ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION admin_audit_chain_advance()';
  EXECUTE 'CREATE TRIGGER admin_audit_append_only BEFORE UPDATE OR DELETE ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION admin_audit_reject_mutation()';
END
$$;
ALTER TABLE admin_audit_log ALTER COLUMN chain_version SET DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_admin_audit_chain_version_id ON admin_audit_log(chain_version,id);

-- V6.30 Privacidade/LGPD operacional: anonimização, tombstones e ciclo de vida
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_inquiries_anonymized_at ON inquiries(anonymized_at DESC) WHERE anonymized_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_privacy_email ON inquiries(lower(email)) WHERE email IS NOT NULL AND anonymized_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_privacy_whatsapp ON inquiries((regexp_replace(whatsapp,'[^0-9]','','g'))) WHERE whatsapp<>'' AND anonymized_at IS NULL;

CREATE TABLE IF NOT EXISTS privacy_requests (
  subject_hash text NOT NULL,
  identity_type text NOT NULL CHECK (identity_type IN ('phone','email')),
  action text NOT NULL DEFAULT 'anonymized' CHECK (action IN ('anonymized')),
  matched_inquiries integer NOT NULL DEFAULT 0 CHECK (matched_inquiries>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(subject_hash,identity_type)
);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_applied ON privacy_requests(last_applied_at DESC);

CREATE OR REPLACE FUNCTION marques_anonymize_privacy_subject(
  p_phone_normalized text,
  p_email_normalized text,
  p_phone_hash text,
  p_email_hash text
) RETURNS jsonb AS $$
DECLARE
  matched_ids uuid[]:=ARRAY[]::uuid[];
  matched_count integer:=0;
  active_count integer:=0;
  activity_deleted integer:=0;
  snapshots_deleted integer:=0;
BEGIN
  PERFORM pg_advisory_xact_lock(63030001);
  SELECT COALESCE(array_agg(id ORDER BY created_at,id),ARRAY[]::uuid[]),COUNT(*)::int,
    COUNT(*) FILTER (WHERE status NOT IN ('fechado','perdido') OR (status='fechado' AND production_status<>'entregue'))::int
  INTO matched_ids,matched_count,active_count
  FROM inquiries
  WHERE anonymized_at IS NULL AND (
    (COALESCE(p_phone_normalized,'')<>'' AND regexp_replace(whatsapp,'[^0-9]','','g')=p_phone_normalized)
    OR (COALESCE(p_email_normalized,'')<>'' AND lower(trim(COALESCE(email,'')))=p_email_normalized)
  );

  IF active_count>0 THEN
    RAISE EXCEPTION 'PRIVACY_ACTIVE_INQUIRIES:%',active_count USING ERRCODE='23514';
  END IF;

  IF cardinality(matched_ids)>0 THEN
    DELETE FROM inquiry_activity WHERE inquiry_id=ANY(matched_ids);
    GET DIAGNOSTICS activity_deleted=ROW_COUNT;

    UPDATE inquiries SET
      name='Cliente anonimizado',
      whatsapp='',
      email=NULL,
      event_date=NULL,
      message='',
      quote_items=COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'product_id',COALESCE(item->>'product_id',''),
        'name',COALESCE(item->>'name',''),
        'category',COALESCE(item->>'category',''),
        'quantity',GREATEST(CASE WHEN COALESCE(item->>'quantity','') ~ '^[0-9]+$' THEN (item->>'quantity')::integer ELSE 1 END,1)
      )) FROM jsonb_array_elements(COALESCE(inquiries.quote_items,'[]'::jsonb)) item),'[]'::jsonb),
      admin_notes='',
      follow_up_at=NULL,
      event_brief='{}'::jsonb,
      idempotency_key=NULL,
      production_due_at=NULL,
      review_requested_at=NULL,
      repurchase_contacted_at=NULL,
      repurchase_contact_year=NULL,
      anonymized_at=now(),
      updated_at=now()
    WHERE id=ANY(matched_ids);
  END IF;

  DELETE FROM admin_restore_snapshots;
  GET DIAGNOSTICS snapshots_deleted=ROW_COUNT;

  IF COALESCE(p_phone_hash,'')<>'' THEN
    INSERT INTO privacy_requests(subject_hash,identity_type,action,matched_inquiries)
    VALUES(p_phone_hash,'phone','anonymized',matched_count)
    ON CONFLICT(subject_hash,identity_type) DO UPDATE SET action='anonymized',matched_inquiries=GREATEST(privacy_requests.matched_inquiries,EXCLUDED.matched_inquiries),last_applied_at=now();
  END IF;
  IF COALESCE(p_email_hash,'')<>'' THEN
    INSERT INTO privacy_requests(subject_hash,identity_type,action,matched_inquiries)
    VALUES(p_email_hash,'email','anonymized',matched_count)
    ON CONFLICT(subject_hash,identity_type) DO UPDATE SET action='anonymized',matched_inquiries=GREATEST(privacy_requests.matched_inquiries,EXCLUDED.matched_inquiries),last_applied_at=now();
  END IF;

  RETURN jsonb_build_object('matched',matched_count,'anonymized',matched_count,'activity_deleted',activity_deleted,'snapshots_deleted',snapshots_deleted,'active_blocked',0);
END
$$ LANGUAGE plpgsql;


-- V6.35 — recibos append-only de backup offsite verificado
CREATE TABLE IF NOT EXISTS offsite_backup_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_sha256 text NOT NULL CHECK (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  object_key text NOT NULL,
  destination_fingerprint text NOT NULL CHECK (destination_fingerprint ~ '^[0-9a-f]{16,64}$'),
  bytes bigint NOT NULL CHECK (bytes > 0),
  retention_days integer NOT NULL CHECK (retention_days BETWEEN 7 AND 3650),
  deleted_count integer NOT NULL DEFAULT 0 CHECK (deleted_count >= 0),
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offsite_backup_receipts_verified ON offsite_backup_receipts(verified_at DESC,id DESC);
CREATE OR REPLACE FUNCTION marques_offsite_backup_receipts_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'offsite_backup_receipts é append-only'; END; $$;
DROP TRIGGER IF EXISTS offsite_backup_receipts_append_only ON offsite_backup_receipts;
CREATE TRIGGER offsite_backup_receipts_append_only BEFORE UPDATE OR DELETE ON offsite_backup_receipts FOR EACH ROW EXECUTE FUNCTION marques_offsite_backup_receipts_append_only();


-- V6.36 — recibos append-only de ensaio real de recuperação
CREATE TABLE IF NOT EXISTS recovery_drill_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_object_key text NOT NULL,
  backup_sha256 text NOT NULL CHECK (backup_sha256 ~ '^[0-9a-f]{64}$'),
  drill_target_fingerprint text NOT NULL CHECK (drill_target_fingerprint ~ '^[0-9a-f]{16,64}$'),
  duration_ms bigint NOT NULL CHECK (duration_ms >= 0),
  succeeded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recovery_drill_receipts_succeeded ON recovery_drill_receipts(succeeded_at DESC,id DESC);
CREATE OR REPLACE FUNCTION marques_recovery_drill_receipts_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'recovery_drill_receipts é append-only'; END; $$;
DROP TRIGGER IF EXISTS recovery_drill_receipts_append_only ON recovery_drill_receipts;
CREATE TRIGGER recovery_drill_receipts_append_only BEFORE UPDATE OR DELETE ON recovery_drill_receipts FOR EACH ROW EXECUTE FUNCTION marques_recovery_drill_receipts_append_only();


-- V6.37 — recibos append-only do espelho de mídia
CREATE TABLE IF NOT EXISTS media_backup_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_count integer NOT NULL CHECK (source_count >= 0),
  mirrored_count integer NOT NULL CHECK (mirrored_count >= 0),
  skipped_count integer NOT NULL CHECK (skipped_count >= 0),
  verified_bytes bigint NOT NULL CHECK (verified_bytes >= 0),
  destination_fingerprint text NOT NULL CHECK (destination_fingerprint ~ '^[0-9a-f]{16,64}$'),
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_backup_receipts_verified ON media_backup_receipts(verified_at DESC,id DESC);
CREATE OR REPLACE FUNCTION marques_media_backup_receipts_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'media_backup_receipts é append-only'; END; $$;
DROP TRIGGER IF EXISTS media_backup_receipts_append_only ON media_backup_receipts;
CREATE TRIGGER media_backup_receipts_append_only BEFORE UPDATE OR DELETE ON media_backup_receipts FOR EACH ROW EXECUTE FUNCTION marques_media_backup_receipts_append_only();

-- V6.39 — recibos append-only do ensaio real de recuperação de mídia
CREATE TABLE IF NOT EXISTS media_recovery_drill_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_count integer NOT NULL CHECK (object_count >= 0),
  verified_bytes bigint NOT NULL CHECK (verified_bytes >= 0),
  vault_fingerprint text NOT NULL CHECK (vault_fingerprint ~ '^[0-9a-f]{16,64}$'),
  drill_target_fingerprint text NOT NULL CHECK (drill_target_fingerprint ~ '^[0-9a-f]{16,64}$'),
  duration_ms bigint NOT NULL CHECK (duration_ms >= 0),
  succeeded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_recovery_drill_receipts_succeeded ON media_recovery_drill_receipts(succeeded_at DESC,id DESC);
CREATE OR REPLACE FUNCTION marques_media_recovery_drill_receipts_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'media_recovery_drill_receipts é append-only'; END; $$;
DROP TRIGGER IF EXISTS media_recovery_drill_receipts_append_only ON media_recovery_drill_receipts;
CREATE TRIGGER media_recovery_drill_receipts_append_only BEFORE UPDATE OR DELETE ON media_recovery_drill_receipts FOR EACH ROW EXECUTE FUNCTION marques_media_recovery_drill_receipts_append_only();
