-- 001 — core pharmacy schema.
--
-- Single source of truth for the whole application. Safe to run repeatedly:
-- every statement is guarded, so it also upgrades a database that was created
-- by an earlier partial run.
--
-- Apply with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/migrations/001_core_schema.sql
--
-- Reversible: see the DROP block at the bottom.

BEGIN;

-- ---------------------------------------------------------------------------
-- medicines (inventory)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  quantity_in_stock INTEGER      NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
  unit_price        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  expiration_date   DATE,
  batch_number      VARCHAR(64),
  supplier_id       UUID,
  supplier_name     VARCHAR(255),
  min_stock_level   INTEGER      NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Added after the first cut of the catalogue so existing rows keep their data.
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ  NOT NULL DEFAULT now();
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ  NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_medicines_is_active  ON medicines (is_active);
CREATE INDEX IF NOT EXISTS idx_medicines_name_lower ON medicines (lower(name));
CREATE INDEX IF NOT EXISTS idx_medicines_expiration  ON medicines (expiration_date)
  WHERE expiration_date IS NOT NULL AND is_active;

-- ---------------------------------------------------------------------------
-- staff_users (staff sign-in for the management screens)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(180) NOT NULL UNIQUE,
  full_name     VARCHAR(120) NOT NULL,
  -- scrypt digest, format: scrypt$<salt-hex>$<hash-hex>
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(30)  NOT NULL DEFAULT 'pharmacist',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- sales (sale header: when, how much, who)
--
-- `created_at` is when the row was written, `sold_at` is when the transaction
-- happened. They are identical today but only sold_at should drive reporting.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference    VARCHAR(20)  NOT NULL UNIQUE,
  sold_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES staff_users (id) ON DELETE SET NULL
);

-- Upgrade path for a database created before `reference` existed: backfill a
-- stable value per row, then enforce NOT NULL + UNIQUE.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS reference VARCHAR(20);
UPDATE sales
   SET reference = 'LEGACY-' || left(replace(id::text, '-', ''), 12)
 WHERE reference IS NULL;
ALTER TABLE sales ALTER COLUMN reference SET NOT NULL;

-- Backfilled from sold_at so historical rows are not stamped with the migration
-- time and then reported as a late sale spike.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE sales SET created_at = sold_at WHERE created_at > sold_at;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_reference_key') THEN
    ALTER TABLE sales ADD CONSTRAINT sales_reference_key UNIQUE (reference);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_sold_at    ON sales (sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales (created_by);

-- ---------------------------------------------------------------------------
-- sale_items (one row per line, snapshots price and name)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       UUID         NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
  medicine_id   UUID         REFERENCES medicines (id) ON DELETE SET NULL,
  medicine_name VARCHAR(255) NOT NULL,
  quantity      INTEGER      NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total    NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id     ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_medicine_id ON sale_items (medicine_id);

-- ---------------------------------------------------------------------------
-- stock_alerts (expiration and low-stock notifications)
--
-- One row per (kind, medicine, threshold). Re-scanning updates the existing row
-- instead of piling up duplicates, and a medicine that recovers is marked
-- `resolved` rather than deleted, so staff keep the history.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            VARCHAR(20)  NOT NULL CHECK (kind IN ('expiring', 'low_stock')),
  medicine_id     UUID         NOT NULL REFERENCES medicines (id) ON DELETE CASCADE,
  severity        VARCHAR(20)  NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  -- expiring: the 30/14/7/1 day boundary that was crossed.
  -- low_stock: the min_stock_level that was reached.
  threshold_days  INTEGER,
  days_remaining  INTEGER,
  message         VARCHAR(255) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES staff_users (id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  UNIQUE (kind, medicine_id, threshold_days)
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts (status, severity);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_kind   ON stock_alerts (kind);

COMMIT;

-- ---------------------------------------------------------------------------
-- Down
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS stock_alerts, sale_items, sales, staff_users, medicines;
