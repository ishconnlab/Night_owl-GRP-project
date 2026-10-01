-- 004 — dev mock data: the reservation queue.
--
-- Gives the staff reservation screen something to work through without anyone
-- having to submit requests by hand: every workflow state, spread over the last
-- few days, for the demo customer.
--
-- DEV CREDENTIAL / CONTACT DETAIL — local only, never used on a shared or
-- production database.
--   customer : Ish — 0787377750
--
-- Stock consistency is the subtle part. `pending` and `rejected` hold nothing,
-- but `accepted` and `collected` mean the units have been taken off the shelf by
-- ReservationsService.holdStock(). This file therefore puts back anything it
-- removed on a previous run before it inserts anything, and subtracts the holds
-- for the new rows in the same transaction — so re-running it never drifts the
-- inventory figures on the dashboard.
--
-- Safe to run repeatedly.
--
-- Apply with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/migrations/004_dev_mock_data.sql
--
-- Reversible: see the DROP block at the bottom.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Clear the previous run, returning any stock the held rows were holding.
-- ---------------------------------------------------------------------------

WITH removed AS (
  DELETE FROM reservation_requests
   WHERE reference LIKE 'DEV-RES-%'
  RETURNING medicine_id, quantity, status
),
held AS (
  SELECT medicine_id, SUM(quantity)::int AS units
    FROM removed
   WHERE status IN ('accepted', 'collected')
   GROUP BY medicine_id
)
UPDATE medicines m
   SET quantity_in_stock = m.quantity_in_stock + held.units
  FROM held
 WHERE m.id = held.medicine_id;

-- ---------------------------------------------------------------------------
-- 2. The queue itself. Reference format matches what createReservation() issues
--    (`RES-<base36>`) with a DEV- prefix so this fixture can never be confused
--    with a real customer request.
-- ---------------------------------------------------------------------------

INSERT INTO reservation_requests
  (reference, medicine_id, medicine_name, quantity,
   customer_name, customer_phone, customer_email, note, status, created_at)
VALUES
  -- Awaiting a decision: the two requests the counter should act on first.
  ('DEV-RES-0001', '11111111-1111-4111-8111-111111111101',
   'Amoxicillin 500mg capsules', 2,
   'Ish', '0787377750', 'ish@nightowlpharmacy.example',
   'Collecting on Saturday morning if possible.', 'pending',
   now() - interval '40 minutes'),

  ('DEV-RES-0002', '11111111-1111-4111-8111-111111111112',
   'Ciprofloxacin 500mg tablets', 4,
   'Ish', '0787377750', 'ish@nightowlpharmacy.example',
   'Course runs to the end of the month.', 'pending',
   now() - interval '3 hours'),

  ('DEV-RES-0003', '11111111-1111-4111-8111-111111111106',
   'Loratadine 10mg tablets', 1,
   'Ish', '0787377750', NULL,
   'Breathing in through the nose.', 'pending',
   now() - interval '1 day 2 hours'),

  -- Already accepted: stock is held for these, so accepting and releasing them
  -- from the queue is a real hold/release round trip.
  ('DEV-RES-0004', '11111111-1111-4111-8111-111111111102',
   'Paracetamol 500mg tablets', 12,
   'Ish', '0787377750', NULL,
   'Held at the counter until Friday.', 'accepted',
   now() - interval '2 days'),

  -- Collected: the full journey, reference quoted by the customer.
  ('DEV-RES-0005', '11111111-1111-4111-8111-111111111108',
   'Vitamin D3 1000IU', 6,
   'Ish', '0787377750', NULL,
   'Collected and signed for.', 'collected',
   now() - interval '5 days'),

  -- Rejected: shows why a request can close without anything happening.
  ('DEV-RES-0006', '11111111-1111-4111-8111-111111111110',
   'Cetirizine 10mg tablets', 2,
   'Ish', '0787377750', NULL,
   'Out of stock, no supplier delivery until next week.', 'rejected',
   now() - interval '6 days')
ON CONFLICT (reference) DO NOTHING;

-- Staff decision trail for the rows that are no longer pending. Matches the
-- account seeded by 002_dev_seed.sql, and is left NULL rather than guarded by a
-- foreign key so this file still runs on a database where staff_users was
-- re-seeded or cleared.
UPDATE reservation_requests
   SET status     = CASE reference
                     WHEN 'DEV-RES-0004' THEN 'accepted'
                     WHEN 'DEV-RES-0005' THEN 'collected'
                     WHEN 'DEV-RES-0006' THEN 'rejected'
                     ELSE status
                   END,
       decided_by = '33333333-3333-4333-8333-333333333301',
       decided_at = created_at + interval '30 minutes'
 WHERE reference LIKE 'DEV-RES-%'
   AND reference IN ('DEV-RES-0004', 'DEV-RES-0005', 'DEV-RES-0006');

-- ---------------------------------------------------------------------------
-- 3. Take the held units off the shelf, mirroring holdStock() server-side.
-- ---------------------------------------------------------------------------

-- No stock guard here on purpose: medicines.quantity_in_stock carries a
-- `>= 0` CHECK, so an impossible fixture aborts this transaction loudly rather
-- than leaving accepted reservations that were never actually held.
WITH holds AS (
  SELECT medicine_id, SUM(quantity)::int AS units
    FROM reservation_requests
   WHERE reference LIKE 'DEV-RES-%'
     AND status IN ('accepted', 'collected')
   GROUP BY medicine_id
)
UPDATE medicines m
   SET quantity_in_stock = m.quantity_in_stock - holds.units
  FROM holds
 WHERE m.id = holds.medicine_id;

COMMIT;

-- ---------------------------------------------------------------------------
-- Down
-- ---------------------------------------------------------------------------
-- WITH removed AS (
--   DELETE FROM reservation_requests
--    WHERE reference LIKE 'DEV-RES-%'
--   RETURNING medicine_id, quantity, status
-- ),
-- held AS (
--   SELECT medicine_id, SUM(quantity)::int AS units
--     FROM removed
--    WHERE status IN ('accepted', 'collected')
--    GROUP BY medicine_id
-- )
-- UPDATE medicines m
--    SET quantity_in_stock = m.quantity_in_stock + held.units
--   FROM held
--  WHERE m.id = held.medicine_id;
