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
