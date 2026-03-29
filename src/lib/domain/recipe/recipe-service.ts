import { Context, Layer, Effect } from 'effect';
import type { Recipe, CreateRecipeInput, UpdateRecipeInput } from './recipe.js';
import {
	RecipeRepositoryError,
	RecipeValidationError,
	RecipeNotFoundError,
	RecipeRestoreExpiredError
} from './errors.js';
import { RecipeRepository } from './recipe-repository.js';

export const RESTORE_WINDOW_HOURS = 24;

export interface RecipeService {
	findAll(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
	findTrashed(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
	create(
		userId: string,
		input: CreateRecipeInput
	): Effect.Effect<Recipe, RecipeValidationError | RecipeRepositoryError>;
	update(
		userId: string,
		input: UpdateRecipeInput
	): Effect.Effect<Recipe, RecipeValidationError | RecipeNotFoundError | RecipeRepositoryError>;
	trash(
		userId: string,
		id: number
	): Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
	restore(
		userId: string,
		id: number
	): Effect.Effect<void, RecipeNotFoundError | RecipeRestoreExpiredError | RecipeRepositoryError>;
}

export const RecipeService = Context.GenericTag<RecipeService>('RecipeService');

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

export const RecipeServiceLive = Layer.effect(
	RecipeService,
	Effect.gen(function* () {
		const repo = yield* RecipeRepository;
		return {
			findAll: (userId) => repo.findAll(userId),

			findTrashed: (userId) => {
				const since = new Date(Date.now() - RESTORE_WINDOW_HOURS * 60 * 60 * 1000);
				return repo.findTrashed(userId, since);
			},

			create: (userId, input) =>
				Effect.gen(function* () {
					yield* validateFields(input);
					return yield* repo.create(userId, input);
				}),

			update: (userId, input) =>
				Effect.gen(function* () {
					yield* validateFields(input);
					return yield* repo.update(userId, input);
				}),

			trash: (userId, id) => repo.trash(userId, id),

			restore: (userId, id) =>
				Effect.gen(function* () {
					const restoredRecipe = yield* repo.restore(userId, id);
					const hoursElapsed =
						(Date.now() - restoredRecipe.trashedAt!.getTime()) / (1000 * 60 * 60);
					if (hoursElapsed > RESTORE_WINDOW_HOURS) {
						return yield* Effect.fail(new RecipeRestoreExpiredError({ id }));
					}
				})
		};
	})
);

export const findAllRecipes = (
	userId: string
): Effect.Effect<Recipe[], RecipeRepositoryError, RecipeService> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.findAll(userId);
	});

export const findTrashedRecipes = (
	userId: string
): Effect.Effect<Recipe[], RecipeRepositoryError, RecipeService> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.findTrashed(userId);
	});

export const createRecipe = (
	userId: string,
	input: CreateRecipeInput
): Effect.Effect<Recipe, RecipeValidationError | RecipeRepositoryError, RecipeService> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.create(userId, input);
	});

export const updateRecipe = (
	userId: string,
	input: UpdateRecipeInput
): Effect.Effect<
	Recipe,
	RecipeValidationError | RecipeNotFoundError | RecipeRepositoryError,
	RecipeService
> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.update(userId, input);
	});

export const trashRecipe = (
	userId: string,
	id: number
): Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError, RecipeService> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.trash(userId, id);
	});

export const restoreRecipe = (
	userId: string,
	id: number
): Effect.Effect<
	void,
	RecipeNotFoundError | RecipeRestoreExpiredError | RecipeRepositoryError,
	RecipeService
> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.restore(userId, id);
	});
