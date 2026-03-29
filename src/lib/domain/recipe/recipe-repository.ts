import { Context, Effect } from 'effect';
import type { Recipe, CreateRecipeInput, UpdateRecipeInput } from './recipe.js';
import type { RecipeRepositoryError, RecipeNotFoundError } from './errors.js';

export interface RecipeRepository {
	create(userId: string, input: CreateRecipeInput): Effect.Effect<Recipe, RecipeRepositoryError>;
	findAll(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
	update(
		userId: string,
		input: UpdateRecipeInput
	): Effect.Effect<Recipe, RecipeRepositoryError | RecipeNotFoundError>;
	trash(
		userId: string,
		id: number
	): Effect.Effect<void, RecipeRepositoryError | RecipeNotFoundError>;
	restore(
		userId: string,
		id: number
	): Effect.Effect<void, RecipeRepositoryError | RecipeNotFoundError>;
	findTrashed(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
}

export const RecipeRepository = Context.GenericTag<RecipeRepository>('RecipeRepository');
