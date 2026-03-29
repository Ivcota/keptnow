import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { RecipeRepository } from './recipe-repository.js';
import { createRecipe, findAllRecipes } from './use-cases.js';
import { RecipeValidationError } from './errors.js';
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
	createdAt: now,
	updatedAt: now,
	...overrides
});

const makeRepo = (overrides: Partial<typeof RecipeRepository.Service> = {}) =>
	Layer.succeed(RecipeRepository, {
		create: () => Effect.succeed(makeRecipe()),
		findAll: () => Effect.succeed([]),
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
			createRecipe(TEST_USER_ID, {
				name: '',
				ingredients: []
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(RecipeValidationError);
		expect((result as RecipeValidationError).message).toMatch(/empty/i);
	});

	it('createRecipe fails with RecipeValidationError for whitespace-only name', async () => {
		const result = await Effect.runPromise(
			createRecipe(TEST_USER_ID, {
				name: '   ',
				ingredients: []
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
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
});
