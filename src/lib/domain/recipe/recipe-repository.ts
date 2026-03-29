import { Context, Effect } from 'effect';
import type { Recipe, CreateRecipeInput, UpdateRecipeInput } from './recipe.js';
import type { RecipeRepositoryError, RecipeNotFoundError } from './errors.js';

export interface RecipeRepository {
	findAll(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
	findTrashed(userId: string, since: Date): Effect.Effect<Recipe[], RecipeRepositoryError>;
	create(userId: string, input: CreateRecipeInput): Effect.Effect<Recipe, RecipeRepositoryError>;
	update(
		userId: string,
		input: UpdateRecipeInput
	): Effect.Effect<Recipe, RecipeNotFoundError | RecipeRepositoryError>;
	trash(userId: string, id: number): Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
	restore(
		userId: string,
		id: number
	): Effect.Effect<Recipe, RecipeNotFoundError | RecipeRepositoryError>;
	pin(userId: string, id: number): Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
	unpin(userId: string, id: number): Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
}

export const RecipeRepository = Context.GenericTag<RecipeRepository>('RecipeRepository');
