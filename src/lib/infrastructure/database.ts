import { Context, Layer, Effect } from 'effect';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '$lib/server/db/schema';

export type DatabaseInstance = PostgresJsDatabase<typeof schema>;

export const Database = Context.GenericTag<DatabaseInstance>('Database');

export const DatabaseLive = Layer.effect(
	Database,
	Effect.promise(async () => {
		const { db } = await import('$lib/server/db');
		return db;
	})
);
