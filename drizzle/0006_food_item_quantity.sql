-- Add new quantity columns (nullable for migration)
ALTER TABLE "food_item" ADD COLUMN "quantity_value" numeric;
ALTER TABLE "food_item" ADD COLUMN "quantity_unit" text;
ALTER TABLE "food_item" ADD COLUMN "canonical_ingredient_id" integer REFERENCES "canonical_ingredient"("id");

-- Migrate count items: copy integer quantity directly
UPDATE "food_item"
SET "quantity_value" = "quantity",
    "quantity_unit" = 'count'
WHERE "tracking_type" = 'count'
  AND "quantity" IS NOT NULL;

-- Migrate count items with null quantity (shouldn't normally happen, use 1)
UPDATE "food_item"
SET "quantity_value" = 1,
    "quantity_unit" = 'count'
WHERE "tracking_type" = 'count'
  AND "quantity" IS NULL;

-- Migrate amount (percentage) items: default to count=1 placeholder
-- These cannot be accurately converted without user input
UPDATE "food_item"
SET "quantity_value" = 1,
    "quantity_unit" = 'count'
WHERE "tracking_type" = 'amount';

-- Make columns NOT NULL now that all rows are backfilled
ALTER TABLE "food_item" ALTER COLUMN "quantity_value" SET NOT NULL;
ALTER TABLE "food_item" ALTER COLUMN "quantity_unit" SET NOT NULL;

-- Drop deprecated columns
ALTER TABLE "food_item" DROP COLUMN "tracking_type";
ALTER TABLE "food_item" DROP COLUMN "amount";
ALTER TABLE "food_item" DROP COLUMN "quantity";
