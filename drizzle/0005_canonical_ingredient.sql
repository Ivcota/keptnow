CREATE TABLE "canonical_ingredient" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit_category" text NOT NULL,
	CONSTRAINT "canonical_ingredient_name_unique" UNIQUE("name")
);
