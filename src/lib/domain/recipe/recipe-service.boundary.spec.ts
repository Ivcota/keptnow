import { describe, it, expect, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '$lib/server/db/schema.js';
import { Database, type DatabaseInstance } from '$lib/infrastructure/database.js';
import { DrizzleRecipeRepository } from '$lib/infrastructure/drizzle-recipe-repository.js';
import { RecipeRepository } from './recipe-repository.js';
import { RecipeValidationError, RecipeNotFoundError, RecipeRestoreExpiredError } from './errors.js';
import {
	findAllRecipes,
	findTrashedRecipes,
	createRecipe,
	updateRecipe,
	trashRecipe,
	restoreRecipe,
	pinRecipe,
	unpinRecipe
} from './use-cases.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "household" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "invite_code" text,
  "invite_expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "household_id" text REFERENCES "household"("id"),
  "household_role" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "canonical_ingredient" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL UNIQUE,
  "unit_category" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "recipe" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "household_id" text REFERENCES "household"("id"),
  "name" text NOT NULL,
  "pinned_at" timestamp,
  "trashed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recipe_ingredient" (
  "id" serial PRIMARY KEY NOT NULL,
  "recipe_id" integer NOT NULL REFERENCES "recipe"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "canonical_name" text,
  "canonical_ingredient_id" integer REFERENCES "canonical_ingredient"("id"),
  "quantity_value" numeric NOT NULL,
  "quantity_unit" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "recipe_note" (
  "id" serial PRIMARY KEY NOT NULL,
  "recipe_id" integer NOT NULL REFERENCES "recipe"("id") ON DELETE CASCADE,
  "text" text NOT NULL
);
`;

async function makeFreshDatabase(): Promise<DatabaseInstance> {
	const pg = new PGlite();
	await pg.exec(SCHEMA_SQL);
	return drizzle(pg, { schema }) as unknown as DatabaseInstance;
}

const HOUSEHOLD_A = 'household-a';
const HOUSEHOLD_B = 'household-b';
const USER_A = 'user-a';
const USER_B = 'user-b';
const USER_C = 'user-c'; // member of HOUSEHOLD_B

describe('Recipe use-cases (boundary — PGLite)', () => {
	let db: DatabaseInstance;
	let testLayer: Layer.Layer<RecipeRepository>;

	beforeEach(async () => {
		db = await makeFreshDatabase();

		// Insert test households
		await db.insert(schema.household).values([
			{ id: HOUSEHOLD_A, name: 'Household A' },
			{ id: HOUSEHOLD_B, name: 'Household B' }
		]);

		// Insert test users required by FK constraint, linked to households
		await db.insert(schema.user).values([
			{ id: USER_A, name: 'User A', email: 'a@example.com', householdId: HOUSEHOLD_A },
			{ id: USER_B, name: 'User B', email: 'b@example.com', householdId: HOUSEHOLD_A },
			{ id: USER_C, name: 'User C', email: 'c@example.com', householdId: HOUSEHOLD_B }
		]);

		const dbLayer = Layer.succeed(Database, db);
		testLayer = DrizzleRecipeRepository.pipe(Layer.provide(dbLayer));
	});

	const run = <A, E>(effect: Effect.Effect<A, E, RecipeRepository>) =>
		Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

	it('findAllRecipes returns recipes with ingredients populated', async () => {
		const [recipeRow] = await db
			.insert(schema.recipe)
			.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Pasta' })
			.returning();
		await db.insert(schema.recipeIngredient).values([
			{ recipeId: recipeRow.id, name: 'Flour', quantityValue: '200', quantityUnit: 'g' },
			{ recipeId: recipeRow.id, name: 'Eggs', quantityValue: '2', quantityUnit: 'count' }
		]);

		const recipes = await run(findAllRecipes(HOUSEHOLD_A, USER_A));

		expect(recipes).toHaveLength(1);
		expect(recipes[0].name).toBe('Pasta');
		expect(recipes[0].ingredients).toHaveLength(2);
		expect(recipes[0].ingredients.map((i) => i.name).sort()).toEqual(['Eggs', 'Flour']);
	});

	it('findAllRecipes excludes trashed recipes', async () => {
		await db.insert(schema.recipe).values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Active Recipe' });
		await db
			.insert(schema.recipe)
			.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Trashed Recipe', trashedAt: new Date() });

		const recipes = await run(findAllRecipes(HOUSEHOLD_A, USER_A));

		expect(recipes).toHaveLength(1);
		expect(recipes[0].name).toBe('Active Recipe');
	});

	it('findAllRecipes returns all recipes for household (both users)', async () => {
		await db.insert(schema.recipe).values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'A Recipe' });
		await db.insert(schema.recipe).values({ userId: USER_B, householdId: HOUSEHOLD_A, name: 'B Recipe' });

		const recipes = await run(findAllRecipes(HOUSEHOLD_A, USER_A));

		expect(recipes).toHaveLength(2);
		expect(recipes.map((r) => r.name).sort()).toEqual(['A Recipe', 'B Recipe']);
	});

	it('findAllRecipes only returns recipes for the given household', async () => {
		await db.insert(schema.recipe).values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'A Recipe' });
		await db.insert(schema.recipe).values({ userId: USER_C, householdId: HOUSEHOLD_B, name: 'C Recipe' });

		const [recipesA, recipesC] = await Promise.all([
			run(findAllRecipes(HOUSEHOLD_A, USER_A)),
			run(findAllRecipes(HOUSEHOLD_B, USER_C))
		]);

		expect(recipesA).toHaveLength(1);
		expect(recipesA[0].name).toBe('A Recipe');
		expect(recipesC).toHaveLength(1);
		expect(recipesC[0].name).toBe('C Recipe');
	});

	it('findTrashedRecipes returns recipes trashed within the 24h window', async () => {
		const recentTrashedAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
		await db
			.insert(schema.recipe)
			.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Recently Trashed', trashedAt: recentTrashedAt });

		const recipes = await run(findTrashedRecipes(HOUSEHOLD_A, USER_A));

		expect(recipes).toHaveLength(1);
		expect(recipes[0].name).toBe('Recently Trashed');
	});

	it('findTrashedRecipes excludes recipes trashed more than 24h ago', async () => {
		const expiredTrashedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
		await db
			.insert(schema.recipe)
			.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Expired Trash', trashedAt: expiredTrashedAt });

		const recipes = await run(findTrashedRecipes(HOUSEHOLD_A, USER_A));

		expect(recipes).toHaveLength(0);
	});

	it('findTrashedRecipes excludes active (non-trashed) recipes', async () => {
		await db.insert(schema.recipe).values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Active Recipe' });

		const recipes = await run(findTrashedRecipes(HOUSEHOLD_A, USER_A));

		expect(recipes).toHaveLength(0);
	});

	it('findTrashedRecipes returns trashed recipes for all users in the household', async () => {
		const trashedAt = new Date(Date.now() - 60 * 60 * 1000);
		await db.insert(schema.recipe).values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'A Trashed', trashedAt });
		await db.insert(schema.recipe).values({ userId: USER_B, householdId: HOUSEHOLD_A, name: 'B Trashed', trashedAt });

		const recipes = await run(findTrashedRecipes(HOUSEHOLD_A, USER_A));

		expect(recipes).toHaveLength(2);
		expect(recipes.map((r) => r.name).sort()).toEqual(['A Trashed', 'B Trashed']);
	});

	it('findTrashedRecipes only returns trashed recipes for the given household', async () => {
		const trashedAt = new Date(Date.now() - 60 * 60 * 1000);
		await db.insert(schema.recipe).values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'A Trashed', trashedAt });
		await db.insert(schema.recipe).values({ userId: USER_C, householdId: HOUSEHOLD_B, name: 'C Trashed', trashedAt });

		const recipesA = await run(findTrashedRecipes(HOUSEHOLD_A, USER_A));

		expect(recipesA).toHaveLength(1);
		expect(recipesA[0].name).toBe('A Trashed');
	});

	it('findTrashedRecipes returns ingredients for trashed recipes', async () => {
		const trashedAt = new Date(Date.now() - 30 * 60 * 1000);
		const [recipeRow] = await db
			.insert(schema.recipe)
			.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Trashed With Ingredients', trashedAt })
			.returning();
		await db
			.insert(schema.recipeIngredient)
			.values({ recipeId: recipeRow.id, name: 'Sugar', quantityValue: '100', quantityUnit: 'g' });

		const recipes = await run(findTrashedRecipes(HOUSEHOLD_A, USER_A));

		expect(recipes).toHaveLength(1);
		expect(recipes[0].ingredients).toHaveLength(1);
		expect(recipes[0].ingredients[0].name).toBe('Sugar');
	});

	describe('createRecipe', () => {
		it('persists recipe and ingredients atomically', async () => {
			const result = await run(
				createRecipe(HOUSEHOLD_A, USER_A, {
					name: 'Omelette',
					ingredients: [
						{ name: 'Eggs', quantity: { value: 3, unit: 'count' } },
						{ name: 'Butter', quantity: { value: 10, unit: 'g' } }
					],
					notes: []
				})
			);

			expect(result.name).toBe('Omelette');
			expect(result.userId).toBe(USER_A);
			expect(result.id).toBeTypeOf('number');
			expect(result.ingredients).toHaveLength(2);
			expect(result.ingredients.map((i) => i.name).sort()).toEqual(['Butter', 'Eggs']);

			// Verify persisted in DB with household_id
			const dbRecipes = await db
				.select()
				.from(schema.recipe)
				.where(eq(schema.recipe.householdId, HOUSEHOLD_A));
			expect(dbRecipes).toHaveLength(1);
			expect(dbRecipes[0].householdId).toBe(HOUSEHOLD_A);
		});

		it('persists recipe with no ingredients', async () => {
			const result = await run(
				createRecipe(HOUSEHOLD_A, USER_A, { name: 'Plain Dish', ingredients: [], notes: [] })
			);

			expect(result.name).toBe('Plain Dish');
			expect(result.ingredients).toHaveLength(0);
		});

		it('persists recipe with notes', async () => {
			const result = await run(
				createRecipe(HOUSEHOLD_A, USER_A, {
					name: 'Seasoned Dish',
					ingredients: [{ name: 'Chicken', quantity: { value: 500, unit: 'g' } }],
					notes: [{ text: 'Season to taste' }, { text: 'Oil for frying' }]
				})
			);

			expect(result.notes).toHaveLength(2);
			expect(result.notes.map((n) => n.text).sort()).toEqual(['Oil for frying', 'Season to taste']);
		});

		it('fails with RecipeValidationError for empty recipe name', async () => {
			const error = await Effect.runPromise(
				createRecipe(HOUSEHOLD_A, USER_A, { name: '  ', ingredients: [], notes: [] }).pipe(
					Effect.flip,
					Effect.provide(testLayer)
				)
			);

			expect(error).toBeInstanceOf(RecipeValidationError);

			// DB must be untouched
			const rows = await db.select().from(schema.recipe);
			expect(rows).toHaveLength(0);
		});

		it('fails with RecipeValidationError for empty ingredient name', async () => {
			const error = await Effect.runPromise(
				createRecipe(HOUSEHOLD_A, USER_A, {
					name: 'Valid',
					ingredients: [{ name: '', quantity: { value: 1, unit: 'count' } }],
					notes: []
				}).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeValidationError);

			const rows = await db.select().from(schema.recipe);
			expect(rows).toHaveLength(0);
		});
	});

	describe('updateRecipe', () => {
		it('replaces all ingredients', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Old Name' })
				.returning();
			await db.insert(schema.recipeIngredient).values([
				{
					recipeId: recipeRow.id,
					name: 'Old Ingredient',
					quantityValue: '1',
					quantityUnit: 'count'
				}
			]);

			const result = await run(
				updateRecipe(HOUSEHOLD_A, USER_A, {
					id: recipeRow.id,
					name: 'New Name',
					ingredients: [
						{ name: 'New Ingredient A', quantity: { value: 1, unit: 'ml' } },
						{ name: 'New Ingredient B', quantity: { value: 2, unit: 'count' } }
					],
					notes: []
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
				updateRecipe(HOUSEHOLD_A, USER_A, { id: 99999, name: 'X', ingredients: [], notes: [] }).pipe(
					Effect.flip,
					Effect.provide(testLayer)
				)
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeNotFoundError when updating recipe from different household', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_C, householdId: HOUSEHOLD_B, name: 'C Recipe' })
				.returning();

			const error = await Effect.runPromise(
				updateRecipe(HOUSEHOLD_A, USER_A, {
					id: recipeRow.id,
					name: 'Hijacked',
					ingredients: [],
					notes: []
				}).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('succeeds when updating a recipe created by another member of the same household', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_B, householdId: HOUSEHOLD_A, name: 'B Recipe' })
				.returning();

			const result = await run(
				updateRecipe(HOUSEHOLD_A, USER_A, {
					id: recipeRow.id,
					name: 'Updated by A',
					ingredients: [],
					notes: []
				})
			);

			expect(result.name).toBe('Updated by A');
		});

		it('fails with RecipeValidationError for empty recipe name', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Original' })
				.returning();

			const error = await Effect.runPromise(
				updateRecipe(HOUSEHOLD_A, USER_A, { id: recipeRow.id, name: '', ingredients: [], notes: [] }).pipe(
					Effect.flip,
					Effect.provide(testLayer)
				)
			);

			expect(error).toBeInstanceOf(RecipeValidationError);
		});
	});

	describe('trashRecipe', () => {
		it('sets trashedAt on the recipe', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'To Trash' })
				.returning();

			await run(trashRecipe(HOUSEHOLD_A, USER_A, recipeRow.id));

			const [updated] = await db
				.select()
				.from(schema.recipe)
				.where(eq(schema.recipe.id, recipeRow.id));
			expect(updated.trashedAt).toBeInstanceOf(Date);
		});

		it('fails with RecipeNotFoundError for non-existent recipe', async () => {
			const error = await Effect.runPromise(
				trashRecipe(HOUSEHOLD_A, USER_A, 99999).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeNotFoundError when trashing recipe from different household', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_C, householdId: HOUSEHOLD_B, name: 'C Recipe' })
				.returning();

			const error = await Effect.runPromise(
				trashRecipe(HOUSEHOLD_A, USER_A, recipeRow.id).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('succeeds when trashing a recipe created by another member of the same household', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_B, householdId: HOUSEHOLD_A, name: 'B Recipe' })
				.returning();

			await run(trashRecipe(HOUSEHOLD_A, USER_A, recipeRow.id));

			const [updated] = await db
				.select()
				.from(schema.recipe)
				.where(eq(schema.recipe.id, recipeRow.id));
			expect(updated.trashedAt).toBeInstanceOf(Date);
		});
	});

	describe('restoreRecipe', () => {
		it('clears trashedAt within the 24h window', async () => {
			const recentTrashedAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Restorable', trashedAt: recentTrashedAt })
				.returning();

			await run(restoreRecipe(HOUSEHOLD_A, USER_A, recipeRow.id));

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
				.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Expired', trashedAt: expiredTrashedAt })
				.returning();

			const error = await Effect.runPromise(
				restoreRecipe(HOUSEHOLD_A, USER_A, recipeRow.id).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeRestoreExpiredError);
		});

		it('fails with RecipeNotFoundError for non-existent recipe', async () => {
			const error = await Effect.runPromise(
				restoreRecipe(HOUSEHOLD_A, USER_A, 99999).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeNotFoundError for an active (non-trashed) recipe', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Active' })
				.returning();

			const error = await Effect.runPromise(
				restoreRecipe(HOUSEHOLD_A, USER_A, recipeRow.id).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeNotFoundError when restoring recipe from different household', async () => {
			const trashedAt = new Date(Date.now() - 60 * 60 * 1000);
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_C, householdId: HOUSEHOLD_B, name: 'C Trashed', trashedAt })
				.returning();

			const error = await Effect.runPromise(
				restoreRecipe(HOUSEHOLD_A, USER_A, recipeRow.id).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});
	});

	describe('pinRecipe', () => {
		it('sets pinnedAt on the recipe', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Pinnable' })
				.returning();

			await run(pinRecipe(HOUSEHOLD_A, USER_A, recipeRow.id));

			const [updated] = await db
				.select()
				.from(schema.recipe)
				.where(eq(schema.recipe.id, recipeRow.id));
			expect(updated.pinnedAt).not.toBeNull();
		});

		it('fails with RecipeNotFoundError for non-existent recipe', async () => {
			const error = await Effect.runPromise(
				pinRecipe(HOUSEHOLD_A, USER_A, 99999).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});

		it('fails with RecipeNotFoundError for a trashed recipe', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Trashed', trashedAt: new Date() })
				.returning();

			const error = await Effect.runPromise(
				pinRecipe(HOUSEHOLD_A, USER_A, recipeRow.id).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});
	});

	describe('unpinRecipe', () => {
		it('clears pinnedAt on the recipe', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'Pinned', pinnedAt: new Date() })
				.returning();

			await run(unpinRecipe(HOUSEHOLD_A, USER_A, recipeRow.id));

			const [updated] = await db
				.select()
				.from(schema.recipe)
				.where(eq(schema.recipe.id, recipeRow.id));
			expect(updated.pinnedAt).toBeNull();
		});

		it('fails with RecipeNotFoundError for non-existent recipe', async () => {
			const error = await Effect.runPromise(
				unpinRecipe(HOUSEHOLD_A, USER_A, 99999).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});
	});

	describe('household isolation', () => {
		it('users in the same household see each other\'s recipes', async () => {
			await db.insert(schema.recipe).values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'A Recipe' });
			await db.insert(schema.recipe).values({ userId: USER_B, householdId: HOUSEHOLD_A, name: 'B Recipe' });

			const recipesSeenByA = await run(findAllRecipes(HOUSEHOLD_A, USER_A));
			const recipesSeenByB = await run(findAllRecipes(HOUSEHOLD_A, USER_B));

			expect(recipesSeenByA).toHaveLength(2);
			expect(recipesSeenByB).toHaveLength(2);
		});

		it('users in different households cannot see each other\'s recipes', async () => {
			await db.insert(schema.recipe).values({ userId: USER_A, householdId: HOUSEHOLD_A, name: 'A Recipe' });
			await db.insert(schema.recipe).values({ userId: USER_C, householdId: HOUSEHOLD_B, name: 'C Recipe' });

			const recipesA = await run(findAllRecipes(HOUSEHOLD_A, USER_A));
			const recipesC = await run(findAllRecipes(HOUSEHOLD_B, USER_C));

			expect(recipesA).toHaveLength(1);
			expect(recipesA[0].name).toBe('A Recipe');
			expect(recipesC).toHaveLength(1);
			expect(recipesC[0].name).toBe('C Recipe');
		});

		it('household members can modify each other\'s recipes', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_B, householdId: HOUSEHOLD_A, name: 'B Recipe' })
				.returning();

			// User A (same household as B) should be able to pin B's recipe
			await run(pinRecipe(HOUSEHOLD_A, USER_A, recipeRow.id));

			const [updated] = await db
				.select()
				.from(schema.recipe)
				.where(eq(schema.recipe.id, recipeRow.id));
			expect(updated.pinnedAt).not.toBeNull();
		});

		it('users cannot modify recipes from a different household', async () => {
			const [recipeRow] = await db
				.insert(schema.recipe)
				.values({ userId: USER_C, householdId: HOUSEHOLD_B, name: 'C Recipe' })
				.returning();

			// User A (different household) should NOT be able to trash C's recipe
			const error = await Effect.runPromise(
				trashRecipe(HOUSEHOLD_A, USER_A, recipeRow.id).pipe(Effect.flip, Effect.provide(testLayer))
			);

			expect(error).toBeInstanceOf(RecipeNotFoundError);
		});
	});
});
