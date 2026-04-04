-- Change shopping_list_item unique constraint from (user_id, canonical_key) to (household_id, canonical_key)
-- This makes deduplication household-scoped rather than user-scoped

ALTER TABLE "shopping_list_item" DROP CONSTRAINT IF EXISTS "shopping_list_item_user_id_canonical_key_unique";
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_household_id_canonical_key_unique" UNIQUE("household_id","canonical_key");
