import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { Layer, Effect } from 'effect';
import * as schema from '$lib/server/db/schema.js';
import { Database, type DatabaseInstance } from './database.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recipe" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "trashed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recipe_ingredient" (
  "id" serial PRIMARY KEY NOT NULL,
  "recipe_id" integer NOT NULL REFERENCES "recipe"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "canonical_name" text,
  "quantity" text,
  "unit" text
);
`;

export async function makePgliteDatabase(): Promise<DatabaseInstance> {
	const pg = new PGlite();
	await pg.exec(SCHEMA_SQL);
	return drizzle(pg, { schema }) as unknown as DatabaseInstance;
}

export const PgliteDatabaseLive = Layer.effect(
	Database,
	Effect.promise(makePgliteDatabase)
);
