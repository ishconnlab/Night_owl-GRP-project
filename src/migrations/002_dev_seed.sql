-- 002 — development seed data.
--
-- Gives a fresh database something to show: every catalogue state the UI has to
-- render, two weeks of trading so the dashboard trend chart is populated, and a
-- staff sign-in for the management screens.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/migrations/002_dev_seed.sql
--
-- Idempotent: fixed primary keys + ON CONFLICT, so re-running refreshes the
-- demo values instead of duplicating rows.
--
-- DEV CREDENTIAL — local only, never used on a shared or production database:
--   staff@nightowlpharmacy.example / NightOwl!2026

BEGIN;

-- ---------------------------------------------------------------------------
-- Staff account
-- ---------------------------------------------------------------------------
INSERT INTO staff_users (id, email, full_name, password_hash, role)
VALUES (
  '33333333-3333-4333-8333-333333333301',
  'staff@nightowlpharmacy.example',
  'Night Owl Staff',
  'scrypt$ba020abcafac5e04f5d3a0a6db1e7b32$1a8f2bf91e16daaacc54ac64fa42d138e17fa9082be52e5184c5d69c5b05fc8f73e907901b704c86dc6b012dd3fe44c81fe4df2a5678fabcc9ef2d63331cfc41',
  'pharmacist'
)
ON CONFLICT (email) DO UPDATE SET
  full_name     = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash,
  role          = EXCLUDED.role,
  is_active     = TRUE;

-- ---------------------------------------------------------------------------
-- Inventory
--
-- Between them these rows cover: healthy stock, out of stock, at/below the
-- reorder level, and batches expiring inside and outside the alert windows.
-- ---------------------------------------------------------------------------
INSERT INTO medicines (
  id, name, quantity_in_stock, unit_price, expiration_date,
  batch_number, supplier_name, min_stock_level, is_active
) VALUES
  ('11111111-1111-4111-8111-111111111101', 'Amoxicillin 500mg capsules',   240,  12.40, CURRENT_DATE + 400, 'AMX-2401', 'Northgate Wholesale',   40, TRUE),
  ('11111111-1111-4111-8111-111111111102', 'Paracetamol 500mg tablets',   1800,   4.15, CURRENT_DATE + 520, 'PCM-8812', 'Northgate Wholesale',  300, TRUE),
  ('11111111-1111-4111-8111-111111111103', 'Ibuprofen 200mg tablets',       95,   6.80, CURRENT_DATE + 300, 'IBU-1145', 'Riverside Supply',    150, TRUE),
  ('11111111-1111-4111-8111-111111111104', 'Omeprazole 20mg capsules',       0,  18.95, CURRENT_DATE + 260, 'OMP-0033', 'Riverside Supply',     60, TRUE),
  ('11111111-1111-4111-8111-111111111105', 'Amoxicillin 250mg syrup',       12,   9.60, CURRENT_DATE +   9, 'AMX-2402', 'Northgate Wholesale',   50, TRUE),
  ('11111111-1111-4111-8111-111111111106', 'Loratadine 10mg tablets',      310,   7.25, CURRENT_DATE +  21, 'LOR-5520', 'Riverside Supply',     80, TRUE),
  ('11111111-1111-4111-8111-111111111107', 'Metformin 500mg tablets',        6,  11.10, CURRENT_DATE + 180, 'MET-7719', 'Northgate Wholesale',   75, TRUE),
  ('11111111-1111-4111-8111-111111111108', 'Vitamin D3 1000IU',            520,   5.30, CURRENT_DATE + 640, 'VTD-9004', 'Riverside Supply',    100, TRUE),
  ('11111111-1111-4111-8111-111111111109', 'Salbutamol inhaler',            45,  32.00, CURRENT_DATE + 120, 'SAL-3308', 'Northgate Wholesale',   20, TRUE),
  ('11111111-1111-4111-8111-111111111110', 'Cetirizine 10mg tablets',        0,   3.95, CURRENT_DATE + 210, 'CET-6612', 'Riverside Supply',     90, TRUE),
  ('11111111-1111-4111-8111-111111111111', 'Insulin Glargine pen',           28,  58.40, CURRENT_DATE + 150, 'INS-1001', 'Northgate Wholesale',   15, TRUE),
  ('11111111-1111-4111-8111-111111111112', 'Ciprofloxacin 500mg tablets',   75,  15.85, CURRENT_DATE +   3, 'CIP-4407', 'Riverside Supply',     25, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  quantity_in_stock = EXCLUDED.quantity_in_stock,
  unit_price        = EXCLUDED.unit_price,
  expiration_date   = EXCLUDED.expiration_date,
  batch_number      = EXCLUDED.batch_number,
  supplier_name     = EXCLUDED.supplier_name,
  min_stock_level   = EXCLUDED.min_stock_level,
  is_active         = EXCLUDED.is_active,
  updated_at        = now();

-- Retired lines: kept for history, must never reach the catalogue or dashboard.
INSERT INTO medicines (
  id, name, quantity_in_stock, unit_price, expiration_date,
  batch_number, supplier_name, min_stock_level, is_active
) VALUES
  ('22222222-2222-4222-8222-222222222201', 'Phenobarbital 30mg (discontinued)', 500, 2.10, CURRENT_DATE +  90, 'PHE-0001', 'Riverside Supply', 0, FALSE),
  ('22222222-2222-4222-8222-222222222202', 'Aspirin 75mg (legacy pack)',         300, 1.95, CURRENT_DATE -  30, 'ASP-0002', 'Riverside Supply', 0, FALSE)
ON CONFLICT (id) DO UPDATE SET
  quantity_in_stock = EXCLUDED.quantity_in_stock,
  is_active         = EXCLUDED.is_active,
  updated_at        = now();

-- ---------------------------------------------------------------------------
-- Two weeks of trading
--
-- Declared as orders (a header plus their lines) rather than bare totals, so
-- the sales history and receipt screens have something real to render. Prices
-- are read from the medicine row and the totals are computed in SQL, so the
-- seeded history stays consistent with the catalogue.
--
-- Previous dev/legacy sales are cleared first so re-running never inflates the
-- revenue tiles.
-- ---------------------------------------------------------------------------
DELETE FROM sale_items WHERE sale_id IN (
  SELECT id FROM sales WHERE reference LIKE 'DEV-%' OR reference LIKE 'LEGACY-%'
);
DELETE FROM sales WHERE reference LIKE 'DEV-%' OR reference LIKE 'LEGACY-%';

-- order_ref, slot, days_ago, hour, medicine_id, quantity
CREATE TEMP TABLE dev_orders (order_ref text, slot int, days_ago int, hour int) ON COMMIT DROP;
CREATE TEMP TABLE dev_order_lines (
  order_ref text, line int, medicine_id uuid, quantity int
) ON COMMIT DROP;

INSERT INTO dev_orders (order_ref, slot, days_ago, hour) VALUES
  ('DEV-0001', 1,  0, 10), ('DEV-0001', 2,  0, 15), ('DEV-0001', 3,  0, 17),
  ('DEV-0002', 1,  1,  9), ('DEV-0002', 2,  1, 11), ('DEV-0002', 3,  1, 16),
  ('DEV-0003', 1,  2, 10), ('DEV-0003', 2,  2, 13), ('DEV-0003', 3,  2, 18),
  ('DEV-0004', 1,  3,  9), ('DEV-0004', 2,  3, 14),
  ('DEV-0005', 1,  4, 10), ('DEV-0005', 2,  4, 12), ('DEV-0005', 3,  4, 19),
  ('DEV-0006', 1,  5,  9), ('DEV-0006', 2,  5, 15),
  ('DEV-0007', 1,  6, 11), ('DEV-0007', 2,  6, 16), ('DEV-0007', 3,  6, 20),
  ('DEV-0008', 1,  7, 10), ('DEV-0008', 2,  7, 14),
  ('DEV-0009', 1,  8,  9), ('DEV-0009', 2,  8, 13), ('DEV-0009', 3,  8, 18),
  ('DEV-0010', 1,  9, 10), ('DEV-0010', 2,  9, 16),
  ('DEV-0011', 1, 10, 11), ('DEV-0011', 2, 10, 15),
  ('DEV-0012', 1, 11,  9), ('DEV-0012', 2, 11, 14), ('DEV-0012', 3, 11, 19),
  ('DEV-0013', 1, 12, 10), ('DEV-0013', 2, 12, 13),
  ('DEV-0014', 1, 13,  9), ('DEV-0014', 2, 13, 12), ('DEV-0014', 3, 13, 17);

INSERT INTO dev_order_lines (order_ref, line, medicine_id, quantity) VALUES
  ('DEV-0001', 1, '11111111-1111-4111-8111-111111111102', 12),
  ('DEV-0001', 2, '11111111-1111-4111-8111-111111111108',  6),
  ('DEV-0002', 1, '11111111-1111-4111-8111-111111111101',  2),
  ('DEV-0002', 2, '11111111-1111-4111-8111-111111111102', 10),
  ('DEV-0003', 1, '11111111-1111-4111-8111-111111111109',  3),
  ('DEV-0003', 2, '11111111-1111-4111-8111-111111111108', 20),
  ('DEV-0004', 1, '11111111-1111-4111-8111-111111111103',  8),
  ('DEV-0005', 1, '11111111-1111-4111-8111-111111111111',  2),
  ('DEV-0005', 2, '11111111-1111-4111-8111-111111111102', 25),
  ('DEV-0006', 1, '11111111-1111-4111-8111-111111111105',  3),
  ('DEV-0006', 2, '11111111-1111-4111-8111-111111111106', 10),
  ('DEV-0007', 1, '11111111-1111-4111-8111-111111111112',  4),
  ('DEV-0007', 2, '11111111-1111-4111-8111-111111111102', 30),
  ('DEV-0008', 1, '11111111-1111-4111-8111-111111111107',  5),
  ('DEV-0008', 2, '11111111-1111-4111-8111-111111111101',  4),
  ('DEV-0009', 1, '11111111-1111-4111-8111-111111111106', 20),
  ('DEV-0009', 2, '11111111-1111-4111-8111-111111111103', 10),
  ('DEV-0010', 1, '11111111-1111-4111-8111-111111111102', 18),
  ('DEV-0011', 1, '11111111-1111-4111-8111-111111111109',  2),
  ('DEV-0011', 2, '11111111-1111-4111-8111-111111111110', 15),
  ('DEV-0012', 1, '11111111-1111-4111-8111-111111111111',  3),
  ('DEV-0013', 1, '11111111-1111-4111-8111-111111111105',  2),
  ('DEV-0013', 2, '11111111-1111-4111-8111-111111111102', 12),
  ('DEV-0014', 1, '11111111-1111-4111-8111-111111111103',  6),
  ('DEV-0014', 2, '11111111-1111-4111-8111-111111111108', 15),
  ('DEV-0014', 3, '11111111-1111-4111-8111-111111111106',  5);

-- Headers, with the total summed from the lines below.
INSERT INTO sales (id, reference, sold_at, total_amount)
SELECT
  gen_random_uuid(),
  o.order_ref,
  now() - ((o.days_ago || ' days')::interval) - ((o.hour || ' hours')::interval),
  COALESCE((
    SELECT sum(m.unit_price * l.quantity)
      FROM dev_order_lines l
      JOIN medicines m ON m.id = l.medicine_id
     WHERE l.order_ref = o.order_ref
  ), 0)
FROM dev_orders o
ON CONFLICT (reference) DO NOTHING;

-- Lines, priced from the catalogue at seed time.
INSERT INTO sale_items (sale_id, medicine_id, medicine_name, quantity, unit_price, line_total)
SELECT
  s.id,
  l.medicine_id,
  m.name,
  l.quantity,
  m.unit_price,
  m.unit_price * l.quantity
FROM dev_order_lines l
JOIN medicines m ON m.id = l.medicine_id
JOIN sales   s ON s.reference = l.order_ref
WHERE NOT EXISTS (
  SELECT 1 FROM sale_items si WHERE si.sale_id = s.id
);

-- ---------------------------------------------------------------------------
-- Down
-- ---------------------------------------------------------------------------
-- DELETE FROM sale_items;
-- DELETE FROM sales;
-- DELETE FROM medicines;
-- DELETE FROM staff_users;

COMMIT;
