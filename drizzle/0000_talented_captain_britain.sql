CREATE TABLE "task" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp,
	"deleted_at" timestamp
);
