import { Context, Layer, Effect } from 'effect';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '$lib/server/db/schema';

export type DatabaseInstance = PostgresJsDatabase<typeof schema>;

export class Database extends Context.Tag('Database')<Database, DatabaseInstance>() {}

export const DatabaseLive = Layer.effect(
	Database,
	Effect.promise(async () => {
		const { db } = await import('$lib/server/db');
		return db;
	})
);
