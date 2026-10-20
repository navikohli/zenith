CREATE TABLE feedback_products (
  key text PRIMARY KEY, name text NOT NULL,
  board_id uuid NOT NULL UNIQUE REFERENCES boards(id),
  segment_id uuid NOT NULL UNIQUE REFERENCES segments(id),
  allowed_origins jsonb NOT NULL, repository text NOT NULL,
  environment text NOT NULL, app_url text NOT NULL,
  identity_secret text NOT NULL, deployment_secret text NOT NULL, approval_secret text NOT NULL,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE product_user_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_key text NOT NULL REFERENCES feedback_products(key),
  app_user_id text NOT NULL, principal_id uuid NOT NULL REFERENCES principal(id),
  email text NOT NULL, display_name text NOT NULL, active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX product_user_subject_idx ON product_user_bindings(product_key, app_user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX product_user_active_principal_idx ON product_user_bindings(product_key, principal_id) WHERE active = true;
--> statement-breakpoint
CREATE TABLE feedback_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_key text NOT NULL REFERENCES feedback_products(key),
  canonical_post_id uuid NOT NULL REFERENCES posts(id), source_ids jsonb NOT NULL,
  owner_id uuid NOT NULL REFERENCES principal(id), session_id text NOT NULL, claim_hash text NOT NULL,
  phase text NOT NULL DEFAULT 'claimed', revision integer NOT NULL DEFAULT 1,
  state jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_work_phase_check CHECK (phase IN ('claimed','planned','approved','implementing','ready','deployed','released'))
);
--> statement-breakpoint
CREATE INDEX feedback_work_product_phase_idx ON feedback_work(product_key, phase);
--> statement-breakpoint
ALTER TABLE posts ADD COLUMN product_user_binding_id uuid REFERENCES product_user_bindings(id);
--> statement-breakpoint
CREATE INDEX posts_product_user_binding_idx ON posts(product_user_binding_id);
