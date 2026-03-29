import { describe, it, expect, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '$lib/server/db/schema.js';
import { Database, type DatabaseInstance } from '$lib/infrastructure/database.js';
import { RecipeService, RecipeServiceLive } from './recipe-service.js';

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

async function makeFreshDatabase(): Promise<DatabaseInstance> {
	const pg = new PGlite();
	await pg.exec(SCHEMA_SQL);
	return drizzle(pg, { schema }) as unknown as DatabaseInstance;
}

const USER_A = 'user-a';
const USER_B = 'user-b';

describe('RecipeService (boundary — PGLite)', () => {
	let db: DatabaseInstance;
	let testLayer: Layer.Layer<RecipeService>;

	beforeEach(async () => {
		db = await makeFreshDatabase();

		// Insert test users required by FK constraint
		await db.insert(schema.user).values([
			{ id: USER_A, name: 'User A', email: 'a@example.com' },
			{ id: USER_B, name: 'User B', email: 'b@example.com' }
		]);

		testLayer = RecipeServiceLive.pipe(
			Layer.provide(Layer.succeed(Database, db))
		);
	});

	const run = <A, E>(effect: Effect.Effect<A, E, RecipeService>) =>
		Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

	it('findAll returns recipes with ingredients populated', async () => {
		const [recipeRow] = await db
			.insert(schema.recipe)
			.values({ userId: USER_A, name: 'Pasta' })
			.returning();
		await db.insert(schema.recipeIngredient).values([
			{ recipeId: recipeRow.id, name: 'Flour', quantity: '200', unit: 'g' },
			{ recipeId: recipeRow.id, name: 'Eggs', quantity: '2', unit: null }
		]);

		const recipes = await run(
			Effect.gen(function* () {
				const svc = yield* RecipeService;
				return yield* svc.findAll(USER_A);
			})
		);

		expect(recipes).toHaveLength(1);
		expect(recipes[0].name).toBe('Pasta');
		expect(recipes[0].ingredients).toHaveLength(2);
		expect(recipes[0].ingredients.map((i) => i.name).sort()).toEqual(['Eggs', 'Flour']);
	});

	it('findAll excludes trashed recipes', async () => {
		await db.insert(schema.recipe).values({ userId: USER_A, name: 'Active Recipe' });
		await db
			.insert(schema.recipe)
			.values({ userId: USER_A, name: 'Trashed Recipe', trashedAt: new Date() });

		const recipes = await run(
			Effect.gen(function* () {
				const svc = yield* RecipeService;
				return yield* svc.findAll(USER_A);
			})
		);

		expect(recipes).toHaveLength(1);
		expect(recipes[0].name).toBe('Active Recipe');
	});

	it('findAll only returns recipes for the given user', async () => {
		await db.insert(schema.recipe).values({ userId: USER_A, name: 'A Recipe' });
		await db.insert(schema.recipe).values({ userId: USER_B, name: 'B Recipe' });

		const [recipesA, recipesB] = await Promise.all([
			run(Effect.gen(function* () { const svc = yield* RecipeService; return yield* svc.findAll(USER_A); })),
			run(Effect.gen(function* () { const svc = yield* RecipeService; return yield* svc.findAll(USER_B); }))
		]);

		expect(recipesA).toHaveLength(1);
		expect(recipesA[0].name).toBe('A Recipe');
		expect(recipesB).toHaveLength(1);
		expect(recipesB[0].name).toBe('B Recipe');
	});

	it('findTrashed returns recipes trashed within the 24h window', async () => {
		const recentTrashedAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
		await db
			.insert(schema.recipe)
			.values({ userId: USER_A, name: 'Recently Trashed', trashedAt: recentTrashedAt });

		const recipes = await run(
			Effect.gen(function* () {
				const svc = yield* RecipeService;
				return yield* svc.findTrashed(USER_A);
			})
		);

		expect(recipes).toHaveLength(1);
		expect(recipes[0].name).toBe('Recently Trashed');
	});

	it('findTrashed excludes recipes trashed more than 24h ago', async () => {
		const expiredTrashedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
		await db
			.insert(schema.recipe)
			.values({ userId: USER_A, name: 'Expired Trash', trashedAt: expiredTrashedAt });

		const recipes = await run(
			Effect.gen(function* () {
				const svc = yield* RecipeService;
				return yield* svc.findTrashed(USER_A);
			})
		);

		expect(recipes).toHaveLength(0);
	});

	it('findTrashed excludes active (non-trashed) recipes', async () => {
		await db.insert(schema.recipe).values({ userId: USER_A, name: 'Active Recipe' });

		const recipes = await run(
			Effect.gen(function* () {
				const svc = yield* RecipeService;
				return yield* svc.findTrashed(USER_A);
			})
		);

		expect(recipes).toHaveLength(0);
	});

	it('findTrashed only returns trashed recipes for the given user', async () => {
		const trashedAt = new Date(Date.now() - 60 * 60 * 1000);
		await db.insert(schema.recipe).values({ userId: USER_A, name: 'A Trashed', trashedAt });
		await db.insert(schema.recipe).values({ userId: USER_B, name: 'B Trashed', trashedAt });

		const recipesA = await run(
			Effect.gen(function* () {
				const svc = yield* RecipeService;
				return yield* svc.findTrashed(USER_A);
			})
		);

		expect(recipesA).toHaveLength(1);
		expect(recipesA[0].name).toBe('A Trashed');
	});

	it('findTrashed returns ingredients for trashed recipes', async () => {
		const trashedAt = new Date(Date.now() - 30 * 60 * 1000);
		const [recipeRow] = await db
			.insert(schema.recipe)
			.values({ userId: USER_A, name: 'Trashed With Ingredients', trashedAt })
			.returning();
		await db
			.insert(schema.recipeIngredient)
			.values({ recipeId: recipeRow.id, name: 'Sugar', quantity: '100', unit: 'g' });

		const recipes = await run(
			Effect.gen(function* () {
				const svc = yield* RecipeService;
				return yield* svc.findTrashed(USER_A);
			})
		);

		expect(recipes).toHaveLength(1);
		expect(recipes[0].ingredients).toHaveLength(1);
		expect(recipes[0].ingredients[0].name).toBe('Sugar');
	});
});
