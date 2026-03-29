import { Context, Effect } from 'effect';
import type { Recipe, CreateRecipeInput } from './recipe.js';
import type { RecipeRepositoryError } from './errors.js';

export interface RecipeRepository {
	create(userId: string, input: CreateRecipeInput): Effect.Effect<Recipe, RecipeRepositoryError>;
	findAll(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
}

export const RecipeRepository = Context.GenericTag<RecipeRepository>('RecipeRepository');
