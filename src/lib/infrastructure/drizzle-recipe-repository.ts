import { Layer, Effect } from 'effect';
import { eq, inArray } from 'drizzle-orm';
import { RecipeRepository } from '$lib/domain/recipe/recipe-repository.js';
import { RecipeRepositoryError } from '$lib/domain/recipe/errors.js';
import type { Recipe, RecipeIngredient } from '$lib/domain/recipe/recipe.js';
import { Database } from './database.js';
import { recipe, recipeIngredient } from '$lib/server/db/schema';

function rowsToRecipe(
	recipeRow: typeof recipe.$inferSelect,
	ingredientRows: (typeof recipeIngredient.$inferSelect)[]
): Recipe {
	const ingredients: RecipeIngredient[] = ingredientRows.map((row) => ({
		id: row.id,
		recipeId: row.recipeId,
		name: row.name,
		canonicalName: row.canonicalName,
		quantity: row.quantity,
		unit: row.unit
	}));
	return {
		id: recipeRow.id,
		userId: recipeRow.userId,
		name: recipeRow.name,
		ingredients,
		createdAt: recipeRow.createdAt,
		updatedAt: recipeRow.updatedAt
	};
}

export const DrizzleRecipeRepository = Layer.effect(
	RecipeRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			create: (userId, input) =>
				Effect.tryPromise({
					try: () =>
						db.transaction(async (tx) => {
							const [recipeRow] = await tx
								.insert(recipe)
								.values({ userId, name: input.name })
								.returning();

							const ingredientRows =
								input.ingredients.length > 0
									? await tx
											.insert(recipeIngredient)
											.values(
												input.ingredients.map((ing) => ({
													recipeId: recipeRow.id,
													name: ing.name,
													canonicalName: ing.canonicalName,
													quantity: ing.quantity,
													unit: ing.unit
												}))
											)
											.returning()
									: [];

							return rowsToRecipe(recipeRow, ingredientRows);
						}),
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to create recipe', cause: e })
				}),

			findAll: (userId) =>
				Effect.tryPromise({
					try: async () => {
						const recipeRows = await db
							.select()
							.from(recipe)
							.where(eq(recipe.userId, userId));

						if (recipeRows.length === 0) return [];

						const recipeIds = recipeRows.map((r) => r.id);
						const allIngredients = await db
							.select()
							.from(recipeIngredient)
							.where(
								recipeIds.length === 1
									? eq(recipeIngredient.recipeId, recipeIds[0])
									: inArray(recipeIngredient.recipeId, recipeIds)
							);

						return recipeRows.map((r) =>
							rowsToRecipe(
								r,
								allIngredients.filter((ing) => ing.recipeId === r.id)
							)
						);
					},
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to fetch recipes', cause: e })
				})
		};
	})
);
