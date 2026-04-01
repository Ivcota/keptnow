import { Context, Effect } from 'effect';
import type { Recipe, CreateRecipeInput, UpdateRecipeInput } from './recipe.js';
import type { RecipeRepositoryError, RecipeNotFoundError } from './errors.js';

export class RecipeRepository extends Context.Tag('RecipeRepository')<
	RecipeRepository,
	{
		readonly findAll: (userId: string) => Effect.Effect<Recipe[], RecipeRepositoryError>;
		readonly findTrashed: (
			userId: string,
			since: Date
		) => Effect.Effect<Recipe[], RecipeRepositoryError>;
		readonly create: (
			userId: string,
			input: CreateRecipeInput
		) => Effect.Effect<Recipe, RecipeRepositoryError>;
		readonly update: (
			userId: string,
			input: UpdateRecipeInput
		) => Effect.Effect<Recipe, RecipeNotFoundError | RecipeRepositoryError>;
		readonly trash: (
			userId: string,
			id: number
		) => Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
		readonly restore: (
			userId: string,
			id: number
		) => Effect.Effect<Recipe, RecipeNotFoundError | RecipeRepositoryError>;
		readonly pin: (
			userId: string,
			id: number
		) => Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
		readonly unpin: (
			userId: string,
			id: number
		) => Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
	}
>() {}
