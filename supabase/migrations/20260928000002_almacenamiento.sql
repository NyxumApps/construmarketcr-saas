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
