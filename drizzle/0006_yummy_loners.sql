CREATE TYPE "public"."household_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "recipe_note" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"invite_code" text,
	"invite_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_list_item" DROP CONSTRAINT "shopping_list_item_user_id_canonical_key_unique";--> statement-breakpoint
ALTER TABLE "food_item" ADD COLUMN "household_id" text;--> statement-breakpoint
ALTER TABLE "food_item" ADD COLUMN "quantity_value" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "food_item" ADD COLUMN "quantity_unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "food_item" ADD COLUMN "canonical_ingredient_id" integer;--> statement-breakpoint
ALTER TABLE "recipe" ADD COLUMN "household_id" text;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD COLUMN "canonical_ingredient_id" integer;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD COLUMN "quantity_value" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD COLUMN "quantity_unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD COLUMN "household_id" text;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD COLUMN "quantity_value" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD COLUMN "quantity_unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "household_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "household_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "household_role" "household_role";--> statement-breakpoint
ALTER TABLE "recipe_note" ADD CONSTRAINT "recipe_note_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_item" ADD CONSTRAINT "food_item_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_item" ADD CONSTRAINT "food_item_canonical_ingredient_id_canonical_ingredient_id_fk" FOREIGN KEY ("canonical_ingredient_id") REFERENCES "public"."canonical_ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_canonical_ingredient_id_canonical_ingredient_id_fk" FOREIGN KEY ("canonical_ingredient_id") REFERENCES "public"."canonical_ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_item" DROP COLUMN "tracking_type";--> statement-breakpoint
ALTER TABLE "food_item" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "food_item" DROP COLUMN "quantity";--> statement-breakpoint
ALTER TABLE "recipe_ingredient" DROP COLUMN "quantity";--> statement-breakpoint
ALTER TABLE "recipe_ingredient" DROP COLUMN "unit";--> statement-breakpoint
ALTER TABLE "shopping_list_item" DROP COLUMN "carried_tracking_type";--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_household_id_canonical_key_unique" UNIQUE("household_id","canonical_key");