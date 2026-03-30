-- Add canonical_name to recipe_ingredient for cleaner display names
ALTER TABLE "recipe_ingredient" ADD COLUMN "canonical_name" text;
