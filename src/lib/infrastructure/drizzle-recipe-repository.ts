import { Layer, Effect } from 'effect';
import { eq, and, isNull, isNotNull, inArray, gte } from 'drizzle-orm';
import { RecipeRepository } from '$lib/domain/recipe/recipe-repository.js';
import { RecipeRepositoryError, RecipeNotFoundError } from '$lib/domain/recipe/errors.js';
import type { Recipe, RecipeIngredient } from '$lib/domain/recipe/recipe.js';
import { Database, type DatabaseInstance } from './database.js';
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
		trashedAt: recipeRow.trashedAt,
		createdAt: recipeRow.createdAt,
		updatedAt: recipeRow.updatedAt
	};
}

async function fetchRecipesWithIngredients(
	db: DatabaseInstance,
	recipeRows: (typeof recipe.$inferSelect)[]
): Promise<Recipe[]> {
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
							.where(and(eq(recipe.userId, userId), isNull(recipe.trashedAt)));

						return fetchRecipesWithIngredients(db, recipeRows);
					},
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to fetch recipes', cause: e })
				}),

			update: (userId, input) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(recipe)
								.where(
									and(eq(recipe.id, input.id), eq(recipe.userId, userId), isNull(recipe.trashedAt))
								),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to find recipe', cause: e })
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new RecipeNotFoundError({ id: input.id }));
					}

					return yield* Effect.tryPromise({
						try: () =>
							db.transaction(async (tx) => {
								const [recipeRow] = await tx
									.update(recipe)
									.set({ name: input.name, updatedAt: new Date() })
									.where(and(eq(recipe.id, input.id), eq(recipe.userId, userId)))
									.returning();

								// Replace all ingredients
								await tx
									.delete(recipeIngredient)
									.where(eq(recipeIngredient.recipeId, input.id));

								const ingredientRows =
									input.ingredients.length > 0
										? await tx
												.insert(recipeIngredient)
												.values(
													input.ingredients.map((ing) => ({
														recipeId: input.id,
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
							new RecipeRepositoryError({ message: 'Failed to update recipe', cause: e })
					});
				}),

			trash: (userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(recipe)
								.where(and(eq(recipe.id, id), eq(recipe.userId, userId), isNull(recipe.trashedAt))),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to find recipe', cause: e })
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new RecipeNotFoundError({ id }));
					}

					yield* Effect.tryPromise({
						try: () =>
							db
								.update(recipe)
								.set({ trashedAt: new Date(), updatedAt: new Date() })
								.where(and(eq(recipe.id, id), eq(recipe.userId, userId))),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to trash recipe', cause: e })
					});
				}),

			restore: (userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(recipe)
								.where(
									and(eq(recipe.id, id), eq(recipe.userId, userId), isNotNull(recipe.trashedAt))
								),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to find trashed recipe', cause: e })
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new RecipeNotFoundError({ id }));
					}

					yield* Effect.tryPromise({
						try: () =>
							db
								.update(recipe)
								.set({ trashedAt: null, updatedAt: new Date() })
								.where(and(eq(recipe.id, id), eq(recipe.userId, userId))),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to restore recipe', cause: e })
					});
				}),

			findTrashed: (userId) =>
				Effect.tryPromise({
					try: async () => {
						const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
						const recipeRows = await db
							.select()
							.from(recipe)
							.where(
								and(
									eq(recipe.userId, userId),
									isNotNull(recipe.trashedAt),
									gte(recipe.trashedAt, windowStart)
								)
							);

						return fetchRecipesWithIngredients(db, recipeRows);
					},
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to fetch trashed recipes', cause: e })
				})
		};
	})
);
