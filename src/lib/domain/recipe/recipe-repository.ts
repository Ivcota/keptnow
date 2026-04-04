import { Context, Effect } from 'effect';
import type { Recipe, CreateRecipeInput, UpdateRecipeInput } from './recipe.js';
import type { RecipeRepositoryError, RecipeNotFoundError } from './errors.js';

export class RecipeRepository extends Context.Tag('RecipeRepository')<
	RecipeRepository,
	{
		readonly findAll: (
			householdId: string | null,
			userId: string
		) => Effect.Effect<Recipe[], RecipeRepositoryError>;
		readonly findTrashed: (
			householdId: string | null,
			userId: string,
			since: Date
		) => Effect.Effect<Recipe[], RecipeRepositoryError>;
		readonly create: (
			householdId: string | null,
			userId: string,
			input: CreateRecipeInput
		) => Effect.Effect<Recipe, RecipeRepositoryError>;
		readonly update: (
			householdId: string | null,
			userId: string,
			input: UpdateRecipeInput
		) => Effect.Effect<Recipe, RecipeNotFoundError | RecipeRepositoryError>;
		readonly trash: (
			householdId: string | null,
			userId: string,
			id: number
		) => Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
		readonly restore: (
			householdId: string | null,
			userId: string,
			id: number
		) => Effect.Effect<Recipe, RecipeNotFoundError | RecipeRepositoryError>;
		readonly pin: (
			householdId: string | null,
			userId: string,
			id: number
		) => Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
		readonly unpin: (
			householdId: string | null,
			userId: string,
			id: number
		) => Effect.Effect<void, RecipeNotFoundError | RecipeRepositoryError>;
		readonly unpinAll: (
			householdId: string | null,
			userId: string
		) => Effect.Effect<void, RecipeRepositoryError>;
	}
>() {}
