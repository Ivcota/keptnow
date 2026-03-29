import { Effect } from 'effect';
import { RecipeRepository } from './recipe-repository.js';
import { RecipeValidationError, RecipeRepositoryError } from './errors.js';
import type { Recipe, CreateRecipeInput } from './recipe.js';

export const createRecipe = (
	userId: string,
	input: CreateRecipeInput
): Effect.Effect<Recipe, RecipeValidationError | RecipeRepositoryError, RecipeRepository> =>
	Effect.gen(function* () {
		if (!input.name.trim()) {
			yield* Effect.fail(new RecipeValidationError({ message: 'Recipe name must not be empty' }));
		}
		for (const ingredient of input.ingredients) {
			if (!ingredient.name.trim()) {
				yield* Effect.fail(new RecipeValidationError({ message: 'Ingredient name must not be empty' }));
			}
		}
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
