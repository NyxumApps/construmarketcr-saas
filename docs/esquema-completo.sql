-- Esquema base equivalente al modelo Drizzle vigente (especificación §2.1).
-- Los enums del contrato API se validan en el servidor; la base almacena text.

CREATE TABLE users (
  id serial PRIMARY KEY,
  clerk_user_id text NOT NULL CONSTRAINT users_clerk_user_id_unique UNIQUE,
  role text NOT NULL DEFAULT 'buyer',
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE validation_leads (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  province text,
  audience text NOT NULL,
  cfia_number text,
  interest text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE professional_profiles (
  id serial PRIMARY KEY,
  user_id integer NOT NULL CONSTRAINT professional_profiles_user_id_users_id_fk
    REFERENCES users(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  cfia_number text NOT NULL,
  professional_type text NOT NULL,
  province text NOT NULL,
  bio text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  is_synthetic boolean NOT NULL DEFAULT false,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_profiles_user_id_unique UNIQUE (user_id),
  CONSTRAINT professional_profiles_cfia_number_unique UNIQUE (cfia_number)
);

CREATE TABLE plans (
  id serial PRIMARY KEY,
  professional_id integer NOT NULL CONSTRAINT plans_professional_id_professional_profiles_id_fk
    REFERENCES professional_profiles(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  title text NOT NULL,
  slug text NOT NULL CONSTRAINT plans_slug_unique UNIQUE,
  description text NOT NULL,
  type text NOT NULL,
  style text NOT NULL,
  m2 integer NOT NULL,
  bedrooms integer NOT NULL,
  bathrooms integer NOT NULL,
  floors integer NOT NULL,
  price_usd numeric(10,2) NOT NULL,
  construction_min_usd numeric(12,2) NOT NULL,
  construction_max_usd numeric(12,2) NOT NULL,
  province text NOT NULL,
  image_url text NOT NULL,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  is_synthetic boolean NOT NULL DEFAULT false,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pending_plan_image_uploads (
  object_path text PRIMARY KEY,
  owner_user_id integer NOT NULL CONSTRAINT pending_plan_image_uploads_owner_user_id_users_id_fk
    REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending',
  cleanup_token text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pending_plan_image_uploads_expires_at_idx
  ON pending_plan_image_uploads(expires_at);

CREATE TABLE plan_interests (
  id serial PRIMARY KEY,
  plan_id integer NOT NULL CONSTRAINT plan_interests_plan_id_plans_id_fk
    REFERENCES plans(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  province text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Adaptación a Supabase: el esquema public queda expuesto por la Data API.
-- Solo el servidor Express accede a los datos (con un rol que omite RLS),
-- así que se activa RLS sin políticas para cerrar el acceso con clave pública.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_plan_image_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_interests ENABLE ROW LEVEL SECURITY;
-- Registro de objetos almacenados. Sustituye el metadato custom:aclPolicy
-- del almacenamiento anterior: al vivir en PostgreSQL, el cambio de
-- visibilidad se confirma en la misma transacción que el plano.

CREATE TABLE stored_objects (
  object_path text PRIMARY KEY,
  owner_clerk_user_id text NOT NULL,
  visibility text NOT NULL DEFAULT 'private',
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stored_objects ENABLE ROW LEVEL SECURITY;

-- Índices de apoyo para claves foráneas y búsquedas por estado (§2.1, adaptación).
CREATE INDEX plans_professional_id_idx ON plans(professional_id);
CREATE INDEX plans_status_idx ON plans(status);
CREATE INDEX plan_interests_plan_id_idx ON plan_interests(plan_id);
CREATE INDEX professional_profiles_status_idx ON professional_profiles(status);
CREATE INDEX pending_plan_image_uploads_owner_user_id_idx
  ON pending_plan_image_uploads(owner_user_id);
-- Compra de diseños y cotización de materiales con proveedores.

CREATE TABLE plan_purchases (
  id serial PRIMARY KEY,
  plan_id integer NOT NULL CONSTRAINT plan_purchases_plan_id_plans_id_fk
    REFERENCES plans(id),
  buyer_user_id integer NOT NULL CONSTRAINT plan_purchases_buyer_user_id_users_id_fk
    REFERENCES users(id),
  amount_usd numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_provider text NOT NULL,
  payment_reference text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CONSTRAINT plan_purchases_plan_buyer_unique UNIQUE (plan_id, buyer_user_id)
);

CREATE INDEX plan_purchases_buyer_user_id_idx ON plan_purchases(buyer_user_id);

CREATE TABLE suppliers (
  id serial PRIMARY KEY,
  slug text NOT NULL CONSTRAINT suppliers_slug_unique UNIQUE,
  name text NOT NULL,
  connector text NOT NULL,
  contact_email text,
  website text,
  provinces jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quote_requests (
  id serial PRIMARY KEY,
  purchase_id integer NOT NULL CONSTRAINT quote_requests_purchase_id_plan_purchases_id_fk
    REFERENCES plan_purchases(id),
  buyer_user_id integer NOT NULL CONSTRAINT quote_requests_buyer_user_id_users_id_fk
    REFERENCES users(id),
  province text NOT NULL,
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_requests_purchase_id_idx ON quote_requests(purchase_id);
CREATE INDEX quote_requests_buyer_user_id_idx ON quote_requests(buyer_user_id);

CREATE TABLE supplier_quotes (
  id serial PRIMARY KEY,
  quote_request_id integer NOT NULL CONSTRAINT supplier_quotes_quote_request_id_quote_requests_id_fk
    REFERENCES quote_requests(id) ON DELETE CASCADE,
  supplier_id integer NOT NULL CONSTRAINT supplier_quotes_supplier_id_suppliers_id_fk
    REFERENCES suppliers(id),
  status text NOT NULL DEFAULT 'requested',
  total_crc numeric(14,2),
  delivery_days integer,
  valid_until timestamptz,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  covered_items integer NOT NULL DEFAULT 0,
  external_reference text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_quotes_request_supplier_unique UNIQUE (quote_request_id, supplier_id)
);

CREATE INDEX supplier_quotes_supplier_id_idx ON supplier_quotes(supplier_id);
CREATE INDEX supplier_quotes_status_idx ON supplier_quotes(status);

ALTER TABLE plan_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotes ENABLE ROW LEVEL SECURITY;

-- Proveedor de demostración: permite recorrer el flujo completo sin un
-- acuerdo comercial. Se identifica como demostración en toda la interfaz.
INSERT INTO suppliers (slug, name, connector, provinces, is_demo)
VALUES (
  'proveedor-demo',
  'Proveedor de demostración',
  'demo',
  '["San José","Alajuela","Cartago","Heredia","Guanacaste","Puntarenas","Limón"]'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;
-- Bucket privado para las imágenes de planos. Solo aplica en Supabase:
-- en un PostgreSQL local sin el esquema storage se omite sin error.
-- El servidor sirve las variantes públicas tras comprobar stored_objects.

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'plan-images',
      'plan-images',
      false,
      12582912,
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;
