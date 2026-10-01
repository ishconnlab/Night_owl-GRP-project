-- 003 — reservations.
--
-- Kept separate from 001 so the storefront can be dropped without touching
-- inventory, and so the decision trail columns can be added on their own to a
-- database that predates them. Safe to run repeatedly.
--
-- Apply with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/migrations/003_reservation_requests.sql
--
-- Reversible: see the DROP block at the bottom.

BEGIN;

CREATE TABLE IF NOT EXISTS reservation_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Short, customer-quotable handle shown on screen and printed on the label.
  reference      VARCHAR(12)  NOT NULL UNIQUE,
  medicine_id    UUID         NOT NULL,
  -- Copied, not joined: the record must still read correctly if the catalogue
  -- line is later renamed or retired.
  medicine_name  VARCHAR(255) NOT NULL,
  quantity       INTEGER      NOT NULL CHECK (quantity > 0),
  customer_name  VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(30)  NOT NULL,
  customer_email VARCHAR(180),
  note           VARCHAR(500),
  -- varchar + CHECK rather than a Postgres enum: adding a status later is an
  -- ALTER instead of a type rewrite.
  status         VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'rejected', 'collected')),
  -- Staff decision trail. A plain uuid rather than a foreign key so this table
  -- stays independent of staff_users, which may be re-seeded during setup.
  decided_by     UUID,
  decided_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Upgrade path for a table created before the decision trail existed.
ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS decided_by UUID;
ALTER TABLE reservation_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reservation_requests_status
  ON reservation_requests (status);

-- The staff queue sorts by newest first, and filters by status while doing so.
CREATE INDEX IF NOT EXISTS idx_reservation_requests_status_created
  ON reservation_requests (status, created_at DESC);

-- Deliberately no foreign key on medicine_id: a request should survive the
-- catalogue line being deleted. Add one only if stock integrity across the two
-- tables is more important than keeping the history:
--   ALTER TABLE reservation_requests
--     ADD CONSTRAINT fk_reservation_requests_medicine
--     FOREIGN KEY (medicine_id) REFERENCES medicines (id) ON DELETE CASCADE;

COMMIT;

-- ---------------------------------------------------------------------------
-- Down
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS reservation_requests;
