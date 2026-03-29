import { Layer, Effect } from 'effect';
import { eq, and, isNull, isNotNull, gte, inArray } from 'drizzle-orm';
import { RecipeRepository } from '$lib/domain/recipe/recipe-repository.js';
import { RecipeRepositoryError, RecipeNotFoundError } from '$lib/domain/recipe/errors.js';
import type { Recipe, RecipeIngredient } from '$lib/domain/recipe/recipe.js';
import { Database, type DatabaseInstance } from './database.js';
import { recipe, recipeIngredient } from '$lib/server/db/schema.js';

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

async function fetchWithIngredients(
	db: DatabaseInstance,
	recipeRows: (typeof recipe.$inferSelect)[]
): Promise<Recipe[]> {
	if (recipeRows.length === 0) return [];
	const ids = recipeRows.map((r) => r.id);
	const allIngredients = await db
		.select()
		.from(recipeIngredient)
		.where(
			ids.length === 1
				? eq(recipeIngredient.recipeId, ids[0])
				: inArray(recipeIngredient.recipeId, ids)
		);
	return recipeRows.map((r) =>
		rowsToRecipe(
			r,
			allIngredients.filter((i) => i.recipeId === r.id)
		)
	);
}

export const DrizzleRecipeRepository = Layer.effect(
	RecipeRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			findAll: (userId) =>
				Effect.tryPromise({
					try: async () => {
						const rows = await db
							.select()
							.from(recipe)
							.where(and(eq(recipe.userId, userId), isNull(recipe.trashedAt)));
						return fetchWithIngredients(db, rows);
					},
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to fetch recipes', cause: e })
				}),

			findTrashed: (userId, since) =>
				Effect.tryPromise({
					try: async () => {
						const rows = await db
							.select()
							.from(recipe)
							.where(
								and(
									eq(recipe.userId, userId),
									isNotNull(recipe.trashedAt),
									gte(recipe.trashedAt, since)
								)
							);
						return fetchWithIngredients(db, rows);
					},
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to fetch trashed recipes', cause: e })
				}),

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
								.where(
									and(eq(recipe.id, id), eq(recipe.userId, userId), isNull(recipe.trashedAt))
								),
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
							new RecipeRepositoryError({
								message: 'Failed to find trashed recipe',
								cause: e
							})
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new RecipeNotFoundError({ id }));
					}

					// Fetch with ingredients before clearing trashedAt so caller can check the window
					const [originalRecipe] = yield* Effect.tryPromise({
						try: () => fetchWithIngredients(db, rows),
						catch: (e) =>
							new RecipeRepositoryError({
								message: 'Failed to fetch trashed recipe ingredients',
								cause: e
							})
					});

					yield* Effect.tryPromise({
						try: () =>
							db
								.update(recipe)
								.set({ trashedAt: null, updatedAt: new Date() })
								.where(and(eq(recipe.id, id), eq(recipe.userId, userId))),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to restore recipe', cause: e })
					});

					// Return recipe with original trashedAt so the use-case can check the window
					return originalRecipe;
				})
		};
	})
);
