import { Effect } from 'effect';
import { RecipeRepository } from './recipe-repository.js';
import {
	RecipeValidationError,
	RecipeRepositoryError,
	RecipeNotFoundError,
	RecipeRestoreExpiredError
} from './errors.js';
import type { Recipe, CreateRecipeInput, UpdateRecipeInput } from './recipe.js';

export const RESTORE_WINDOW_HOURS = 24;

export const createRecipe = (
	userId: string,
	input: CreateRecipeInput
): Effect.Effect<Recipe, RecipeValidationError | RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		yield* validateRecipeFields(input);
		const repo = yield* RecipeRepository;
		return yield* repo.create(userId, input);
	});

export const findAllRecipes = (
	userId: string
): Effect.Effect<Recipe[], RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		return yield* repo.findAll(userId);
	});

export const updateRecipe = (
	userId: string,
	input: UpdateRecipeInput
): Effect.Effect<
	Recipe,
	RecipeValidationError | RecipeRepositoryError | RecipeNotFoundError,
	RecipeRepository
> =>
	Effect.gen(function* () {
		yield* validateRecipeFields(input);
		const repo = yield* RecipeRepository;
		return yield* repo.update(userId, input);
	});

export const trashRecipe = (
	userId: string,
	id: number
): Effect.Effect<void, RecipeRepositoryError | RecipeNotFoundError, RecipeRepository> =>
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		yield* repo.trash(userId, id);
	});

export const restoreRecipe = (
	userId: string,
	id: number,
	trashedAt: Date,
	now: Date = new Date()
): Effect.Effect<
	void,
	RecipeRepositoryError | RecipeNotFoundError | RecipeRestoreExpiredError,
	RecipeRepository
> =>
	Effect.gen(function* () {
		const msElapsed = now.getTime() - trashedAt.getTime();
		const hoursElapsed = msElapsed / (1000 * 60 * 60);
		if (hoursElapsed > RESTORE_WINDOW_HOURS) {
			yield* Effect.fail(new RecipeRestoreExpiredError({ id }));
		}
		const repo = yield* RecipeRepository;
		yield* repo.restore(userId, id);
	});

export const findTrashedRecipes = (
	userId: string
): Effect.Effect<Recipe[], RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		return yield* repo.findTrashed(userId);
	});

function validateRecipeFields(input: {
	name: string;
	ingredients: { name: string }[];
}): Effect.Effect<void, RecipeValidationError> {
	return Effect.gen(function* () {
		if (!input.name.trim()) {
			yield* Effect.fail(new RecipeValidationError({ message: 'Recipe name must not be empty' }));
		}
		for (const ingredient of input.ingredients) {
			if (!ingredient.name.trim()) {
				yield* Effect.fail(
					new RecipeValidationError({ message: 'Ingredient name must not be empty' })
				);
			}
		}
	});
}
