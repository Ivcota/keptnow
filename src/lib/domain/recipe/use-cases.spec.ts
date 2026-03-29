import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { RecipeRepository } from './recipe-repository.js';
import {
	createRecipe,
	findAllRecipes,
	updateRecipe,
	trashRecipe,
	restoreRecipe,
	findTrashedRecipes,
	RESTORE_WINDOW_HOURS
} from './use-cases.js';
import {
	RecipeValidationError,
	RecipeNotFoundError,
	RecipeRestoreExpiredError
} from './errors.js';
import type { Recipe } from './recipe.js';

const TEST_USER_ID = 'user-1';

const now = new Date();

const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
	id: 1,
	userId: TEST_USER_ID,
	name: 'Chicken Soup',
	ingredients: [
		{ id: 1, recipeId: 1, name: 'Chicken', canonicalName: 'chicken', quantity: '1', unit: 'lb' }
	],
	trashedAt: null,
	createdAt: now,
	updatedAt: now,
	...overrides
});

const makeRepo = (overrides: Partial<typeof RecipeRepository.Service> = {}) =>
	Layer.succeed(RecipeRepository, {
		create: () => Effect.succeed(makeRecipe()),
		findAll: () => Effect.succeed([]),
		update: () => Effect.succeed(makeRecipe()),
		trash: () => Effect.succeed(undefined as void),
		restore: () => Effect.succeed(undefined as void),
		findTrashed: () => Effect.succeed([]),
		...overrides
	});

describe('domain/recipe', () => {
	it('createRecipe delegates to repository on valid input', async () => {
		const created = makeRecipe({ name: 'Pasta' });

		const result = await Effect.runPromise(
			createRecipe(TEST_USER_ID, {
				name: 'Pasta',
				ingredients: [{ name: 'Noodles', canonicalName: 'noodles', quantity: '200', unit: 'g' }]
			}).pipe(Effect.provide(makeRepo({ create: () => Effect.succeed(created) })))
		);

		expect(result).toEqual(created);
	});

	it('createRecipe fails with RecipeValidationError for empty name', async () => {
		const result = await Effect.runPromise(
			createRecipe(TEST_USER_ID, { name: '', ingredients: [] }).pipe(
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(RecipeValidationError);
		expect((result as RecipeValidationError).message).toMatch(/empty/i);
	});

	it('createRecipe fails with RecipeValidationError for whitespace-only name', async () => {
		const result = await Effect.runPromise(
			createRecipe(TEST_USER_ID, { name: '   ', ingredients: [] }).pipe(
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(RecipeValidationError);
		expect((result as RecipeValidationError).message).toMatch(/empty/i);
	});

	it('createRecipe fails when an ingredient has an empty name', async () => {
		const result = await Effect.runPromise(
			createRecipe(TEST_USER_ID, {
				name: 'Soup',
				ingredients: [
					{ name: 'Water', canonicalName: 'water', quantity: '2', unit: 'cups' },
					{ name: '', canonicalName: null, quantity: null, unit: null }
				]
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(RecipeValidationError);
		expect((result as RecipeValidationError).message).toMatch(/ingredient/i);
	});

	it('createRecipe succeeds with no ingredients', async () => {
		const created = makeRecipe({ ingredients: [] });

		const result = await Effect.runPromise(
			createRecipe(TEST_USER_ID, { name: 'Mystery Dish', ingredients: [] }).pipe(
				Effect.provide(makeRepo({ create: () => Effect.succeed(created) }))
			)
		);

		expect(result).toEqual(created);
	});

	it('findAllRecipes returns items from repository', async () => {
		const recipes = [makeRecipe({ id: 1 }), makeRecipe({ id: 2, name: 'Tacos' })];

		const result = await Effect.runPromise(
			findAllRecipes(TEST_USER_ID).pipe(
				Effect.provide(makeRepo({ findAll: () => Effect.succeed(recipes) }))
			)
		);

		expect(result).toEqual(recipes);
	});

	it('findAllRecipes returns empty array when no recipes exist', async () => {
		const result = await Effect.runPromise(
			findAllRecipes(TEST_USER_ID).pipe(Effect.provide(makeRepo()))
		);

		expect(result).toEqual([]);
	});

	it('updateRecipe delegates to repository on valid input', async () => {
		const updated = makeRecipe({ name: 'Pasta Carbonara' });

		const result = await Effect.runPromise(
			updateRecipe(TEST_USER_ID, {
				id: 1,
				name: 'Pasta Carbonara',
				ingredients: [{ name: 'Pasta', canonicalName: 'pasta', quantity: '200', unit: 'g' }]
			}).pipe(Effect.provide(makeRepo({ update: () => Effect.succeed(updated) })))
		);

		expect(result).toEqual(updated);
	});

	it('updateRecipe applies same validation as createRecipe', async () => {
		const result = await Effect.runPromise(
			updateRecipe(TEST_USER_ID, { id: 1, name: '', ingredients: [] }).pipe(
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(RecipeValidationError);
		expect((result as RecipeValidationError).message).toMatch(/empty/i);
	});

	it('updateRecipe propagates RecipeNotFoundError', async () => {
		const result = await Effect.runPromise(
			updateRecipe(TEST_USER_ID, { id: 99, name: 'Ghost Recipe', ingredients: [] }).pipe(
				Effect.provide(makeRepo({ update: () => Effect.fail(new RecipeNotFoundError({ id: 99 })) })),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(RecipeNotFoundError);
		expect((result as RecipeNotFoundError).id).toBe(99);
	});

	it('trashRecipe delegates to repository', async () => {
		const result = await Effect.runPromise(
			trashRecipe(TEST_USER_ID, 1).pipe(Effect.provide(makeRepo()))
		);
		expect(result).toBeUndefined();
	});

	it('restoreRecipe succeeds when trashed within window', async () => {
		const now = new Date();
		const trashedAt = new Date(now.getTime() - (RESTORE_WINDOW_HOURS - 1) * 60 * 60 * 1000);

		const result = await Effect.runPromise(
			restoreRecipe(TEST_USER_ID, 1, trashedAt, now).pipe(Effect.provide(makeRepo()))
		);
		expect(result).toBeUndefined();
	});

	it('restoreRecipe fails with RecipeRestoreExpiredError when window has passed', async () => {
		const now = new Date();
		const trashedAt = new Date(now.getTime() - (RESTORE_WINDOW_HOURS + 1) * 60 * 60 * 1000);

		const result = await Effect.runPromise(
			restoreRecipe(TEST_USER_ID, 1, trashedAt, now).pipe(
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);
		expect(result).toBeInstanceOf(RecipeRestoreExpiredError);
		expect((result as RecipeRestoreExpiredError).id).toBe(1);
	});

	it('restoreRecipe fails exactly at the boundary (24h elapsed)', async () => {
		const now = new Date();
		const trashedAt = new Date(now.getTime() - RESTORE_WINDOW_HOURS * 60 * 60 * 1000 - 1);

		const result = await Effect.runPromise(
			restoreRecipe(TEST_USER_ID, 1, trashedAt, now).pipe(
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);
		expect(result).toBeInstanceOf(RecipeRestoreExpiredError);
	});

	it('findTrashedRecipes returns items from repository', async () => {
		const trashed = [makeRecipe({ id: 3, trashedAt: new Date() })];

		const result = await Effect.runPromise(
			findTrashedRecipes(TEST_USER_ID).pipe(
				Effect.provide(makeRepo({ findTrashed: () => Effect.succeed(trashed) }))
			)
		);

		expect(result).toEqual(trashed);
	});
});
