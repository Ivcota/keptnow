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

function validateFields(input: {
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

export const findAllRecipes = (
	userId: string
): Effect.Effect<Recipe[], RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		return yield* repo.findAll(userId);
	});

export const findTrashedRecipes = (
	userId: string
): Effect.Effect<Recipe[], RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		const since = new Date(Date.now() - RESTORE_WINDOW_HOURS * 60 * 60 * 1000);
		return yield* repo.findTrashed(userId, since);
	});

export const createRecipe = (
	userId: string,
	input: CreateRecipeInput
): Effect.Effect<Recipe, RecipeValidationError | RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		yield* validateFields(input);
		const repo = yield* RecipeRepository;
		return yield* repo.create(userId, input);
	});

export const updateRecipe = (
	userId: string,
	input: UpdateRecipeInput
): Effect.Effect<
	Recipe,
	RecipeValidationError | RecipeNotFoundError | RecipeRepositoryError,
	RecipeRepository
> =>
	Effect.gen(function* () {
		yield* validateFields(input);
		const repo = yield* RecipeRepository;
		return yield* repo.update(userId, input);
	});

export const trashRecipe = (
	userId: string,
	id: number
): Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		yield* repo.trash(userId, id);
	});

export const restoreRecipe = (
	userId: string,
	id: number,
	now: Date = new Date()
): Effect.Effect<
	void,
	RecipeNotFoundError | RecipeRestoreExpiredError | RecipeRepositoryError,
	RecipeRepository
> =>
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		const restoredRecipe = yield* repo.restore(userId, id);
		const hoursElapsed = (now.getTime() - restoredRecipe.trashedAt!.getTime()) / (1000 * 60 * 60);
		if (hoursElapsed > RESTORE_WINDOW_HOURS) {
			return yield* Effect.fail(new RecipeRestoreExpiredError({ id }));
		}
	});

export const pinRecipe = (
	userId: string,
	id: number
): Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		yield* repo.pin(userId, id);
	});

export const unpinRecipe = (
	userId: string,
	id: number
): Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		yield* repo.unpin(userId, id);
	});
