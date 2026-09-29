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
