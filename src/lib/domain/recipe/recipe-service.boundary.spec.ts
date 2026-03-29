import { describe, it, expect, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '$lib/server/db/schema.js';
import { Database, type DatabaseInstance } from '$lib/infrastructure/database.js';
import { RecipeService, RecipeServiceLive } from './recipe-service.js';
import { RecipeValidationError, RecipeNotFoundError, RecipeRestoreExpiredError } from './errors.js';

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

	describe('create', () => {
		it('persists recipe and ingredients atomically', async () => {
			const result = await run(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.create(USER_A, {
						name: 'Omelette',
						ingredients: [
							{ name: 'Eggs', canonicalName: null, quantity: '3', unit: null },
							{ name: 'Butter', canonicalName: null, quantity: '10', unit: 'g' }
						]
					});
				})
			);

			expect(result.name).toBe('Omelette');
			expect(result.userId).toBe(USER_A);
			expect(result.id).toBeTypeOf('number');
			expect(result.ingredients).toHaveLength(2);
			expect(result.ingredients.map((i) => i.name).sort()).toEqual(['Butter', 'Eggs']);

			// Verify persisted in DB
			const dbRecipes = await db
				.select()
				.from(schema.recipe)
				.where(eq(schema.recipe.userId, USER_A));
			expect(dbRecipes).toHaveLength(1);
		});

		it('persists recipe with no ingredients', async () => {
			const result = await run(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.create(USER_A, { name: 'Plain Dish', ingredients: [] });
				})
			);

			expect(result.name).toBe('Plain Dish');
			expect(result.ingredients).toHaveLength(0);
		});

		it('fails with RecipeValidationError for empty recipe name', async () => {
			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.create(USER_A, { name: '  ', ingredients: [] }).pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeValidationError);

			// DB must be untouched
			const rows = await db.select().from(schema.recipe);
			expect(rows).toHaveLength(0);
		});

		it('fails with RecipeValidationError for empty ingredient name', async () => {
			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc
						.create(USER_A, {
							name: 'Valid',
							ingredients: [{ name: '', canonicalName: null, quantity: null, unit: null }]
						})
						.pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeValidationError);

			const rows = await db.select().from(schema.recipe);
			expect(rows).toHaveLength(0);
		});
	});

	describe('update', () => {
		it('replaces all ingredients', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, name: 'Old Name' })
				.returning();
			await db.insert(schema.recipeIngredient).values([
				{ recipeId: recipeRow.id, name: 'Old Ingredient', canonicalName: null, quantity: null, unit: null }
			]);

			const result = await run(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.update(USER_A, {
						id: recipeRow.id,
						name: 'New Name',
						ingredients: [
							{ name: 'New Ingredient A', canonicalName: null, quantity: '1', unit: 'cup' },
							{ name: 'New Ingredient B', canonicalName: null, quantity: null, unit: null }
						]
					});
				})
			);

			expect(result.name).toBe('New Name');
			expect(result.ingredients).toHaveLength(2);
			expect(result.ingredients.map((i) => i.name).sort()).toEqual([
				'New Ingredient A',
				'New Ingredient B'
			]);

			// Old ingredient should be gone
			const remaining = await db
				.select()
				.from(schema.recipeIngredient)
				.where(eq(schema.recipeIngredient.recipeId, recipeRow.id));
			expect(remaining.map((i) => i.name)).not.toContain('Old Ingredient');
		});

		it('fails with RecipeNotFoundError for non-existent recipe', async () => {
			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc
						.update(USER_A, { id: 99999, name: 'X', ingredients: [] })
						.pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeNotFoundError when updating another user recipe', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_B, name: 'B Recipe' })
				.returning();

			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc
						.update(USER_A, { id: recipeRow.id, name: 'Hijacked', ingredients: [] })
						.pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeValidationError for empty recipe name', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, name: 'Original' })
				.returning();

			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc
						.update(USER_A, { id: recipeRow.id, name: '', ingredients: [] })
						.pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeValidationError);
		});
	});

	describe('trash', () => {
		it('sets trashedAt on the recipe', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, name: 'To Trash' })
				.returning();

			await run(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					yield* svc.trash(USER_A, recipeRow.id);
				})
			);

			const [updated] = await db
				.select()
				.from(schema.recipe)
				.where(eq(schema.recipe.id, recipeRow.id));
			expect(updated.trashedAt).toBeInstanceOf(Date);
		});

		it('fails with RecipeNotFoundError for non-existent recipe', async () => {
			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.trash(USER_A, 99999).pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeNotFoundError when trashing another user recipe', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_B, name: 'B Recipe' })
				.returning();

			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.trash(USER_A, recipeRow.id).pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});
	});

	describe('restore', () => {
		it('clears trashedAt within the 24h window', async () => {
			const recentTrashedAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, name: 'Restorable', trashedAt: recentTrashedAt })
				.returning();

			await run(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					yield* svc.restore(USER_A, recipeRow.id);
				})
			);

			const [updated] = await db
				.select()
				.from(schema.recipe)
				.where(eq(schema.recipe.id, recipeRow.id));
			expect(updated.trashedAt).toBeNull();
		});

		it('fails with RecipeRestoreExpiredError when trashedAt is beyond 24h', async () => {
			const expiredTrashedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, name: 'Expired', trashedAt: expiredTrashedAt })
				.returning();

			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.restore(USER_A, recipeRow.id).pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeRestoreExpiredError);
		});

		it('fails with RecipeNotFoundError for non-existent recipe', async () => {
			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.restore(USER_A, 99999).pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeNotFoundError for an active (non-trashed) recipe', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, name: 'Active' })
				.returning();

			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.restore(USER_A, recipeRow.id).pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeNotFoundError when restoring another user recipe', async () => {
			const trashedAt = new Date(Date.now() - 60 * 60 * 1000);
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_B, name: 'B Trashed', trashedAt })
				.returning();

			const error = await Effect.runPromise(
				Effect.gen(function* () {
					const svc = yield* RecipeService;
					return yield* svc.restore(USER_A, recipeRow.id).pipe(Effect.flip);
				}).pipe(Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});
	});
});
