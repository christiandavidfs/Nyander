-- Add 'yearly' to the plan CHECK constraint
ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_plan_check;

ALTER TABLE sponsors ADD CONSTRAINT sponsors_plan_check
  CHECK (plan IN ('trial', 'monthly', 'yearly'));
