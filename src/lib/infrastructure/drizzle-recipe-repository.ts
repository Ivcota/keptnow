import { Layer, Effect } from 'effect';
import { eq, and, isNull, isNotNull, gte, inArray } from 'drizzle-orm';
import { RecipeRepository } from '$lib/domain/recipe/recipe-repository.js';
import { RecipeRepositoryError, RecipeNotFoundError } from '$lib/domain/recipe/errors.js';
import type { Recipe, Ingredient, Note } from '$lib/domain/recipe/recipe.js';
import type { Quantity } from '$lib/domain/shared/quantity.js';
import { Database, type DatabaseInstance } from './database.js';
import { recipe, recipeIngredient, recipeNote } from '$lib/server/db/schema.js';

function rowsToRecipe(
	recipeRow: typeof recipe.$inferSelect,
	ingredientRows: (typeof recipeIngredient.$inferSelect)[],
	noteRows: (typeof recipeNote.$inferSelect)[]
): Recipe {
	const ingredients: Ingredient[] = ingredientRows.map((row) => ({
		id: row.id,
		recipeId: row.recipeId,
		name: row.name,
		canonicalName: row.canonicalName,
		canonicalIngredientId: row.canonicalIngredientId,
		quantity: { value: Number(row.quantityValue), unit: row.quantityUnit } as Quantity
	}));
	const notes: Note[] = noteRows.map((row) => ({
		id: row.id,
		recipeId: row.recipeId,
		text: row.text
	}));
	return {
		id: recipeRow.id,
		userId: recipeRow.userId,
		name: recipeRow.name,
		ingredients,
		notes,
		pinnedAt: recipeRow.pinnedAt,
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
	const [allIngredients, allNotes] = await Promise.all([
		db
			.select()
			.from(recipeIngredient)
			.where(
				ids.length === 1
					? eq(recipeIngredient.recipeId, ids[0])
					: inArray(recipeIngredient.recipeId, ids)
			),
		db
			.select()
			.from(recipeNote)
			.where(
				ids.length === 1
					? eq(recipeNote.recipeId, ids[0])
					: inArray(recipeNote.recipeId, ids)
			)
	]);
	return recipeRows.map((r) =>
		rowsToRecipe(
			r,
			allIngredients.filter((i) => i.recipeId === r.id),
			allNotes.filter((n) => n.recipeId === r.id)
		)
	);
}

function scopeCondition(householdId: string | null, userId: string) {
	return householdId ? eq(recipe.householdId, householdId) : eq(recipe.userId, userId);
}

export const DrizzleRecipeRepository = Layer.effect(
	RecipeRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			findAll: (householdId, userId) =>
				Effect.tryPromise({
					try: async () => {
						const rows = await db
							.select()
							.from(recipe)
							.where(and(scopeCondition(householdId, userId), isNull(recipe.trashedAt)));
						return fetchWithIngredients(db, rows);
					},
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to fetch recipes', cause: e })
				}),

			findTrashed: (householdId, userId, since) =>
				Effect.tryPromise({
					try: async () => {
						const rows = await db
							.select()
							.from(recipe)
							.where(
								and(
									scopeCondition(householdId, userId),
									isNotNull(recipe.trashedAt),
									gte(recipe.trashedAt, since)
								)
							);
						return fetchWithIngredients(db, rows);
					},
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to fetch trashed recipes', cause: e })
				}),

			create: (householdId, userId, input) =>
				Effect.tryPromise({
					try: () =>
						db.transaction(async (tx) => {
							const [recipeRow] = await tx
								.insert(recipe)
								.values({ userId, householdId, name: input.name })
								.returning();

							const ingredientRows =
								input.ingredients.length > 0
									? await tx
											.insert(recipeIngredient)
											.values(
												input.ingredients.map((ing) => ({
													recipeId: recipeRow.id,
													name: ing.name,
													canonicalName: ing.canonicalName ?? null,
													canonicalIngredientId: ing.canonicalIngredientId ?? null,
													quantityValue: String(ing.quantity.value),
													quantityUnit: ing.quantity.unit
												}))
											)
											.returning()
									: [];

							const noteRows =
								input.notes.length > 0
									? await tx
											.insert(recipeNote)
											.values(
												input.notes.map((n) => ({
													recipeId: recipeRow.id,
													text: n.text
												}))
											)
											.returning()
									: [];

							return rowsToRecipe(recipeRow, ingredientRows, noteRows);
						}),
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to create recipe', cause: e })
				}),

			update: (householdId, userId, input) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(recipe)
								.where(
									and(eq(recipe.id, input.id), scopeCondition(householdId, userId), isNull(recipe.trashedAt))
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
									.where(and(eq(recipe.id, input.id), scopeCondition(householdId, userId)))
									.returning();

								await tx
									.delete(recipeIngredient)
									.where(eq(recipeIngredient.recipeId, input.id));

								await tx
									.delete(recipeNote)
									.where(eq(recipeNote.recipeId, input.id));

								const ingredientRows =
									input.ingredients.length > 0
										? await tx
												.insert(recipeIngredient)
												.values(
													input.ingredients.map((ing) => ({
														recipeId: input.id,
														name: ing.name,
														canonicalName: ing.canonicalName ?? null,
														canonicalIngredientId: ing.canonicalIngredientId ?? null,
														quantityValue: String(ing.quantity.value),
														quantityUnit: ing.quantity.unit
													}))
												)
												.returning()
										: [];

								const noteRows =
									input.notes.length > 0
										? await tx
												.insert(recipeNote)
												.values(
													input.notes.map((n) => ({
														recipeId: input.id,
														text: n.text
													}))
												)
												.returning()
										: [];

								return rowsToRecipe(recipeRow, ingredientRows, noteRows);
							}),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to update recipe', cause: e })
					});
				}),

			trash: (householdId, userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(recipe)
								.where(
									and(eq(recipe.id, id), scopeCondition(householdId, userId), isNull(recipe.trashedAt))
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
								.set({ pinnedAt: null, trashedAt: new Date(), updatedAt: new Date() })
								.where(and(eq(recipe.id, id), scopeCondition(householdId, userId))),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to trash recipe', cause: e })
					});
				}),

			restore: (householdId, userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(recipe)
								.where(
									and(eq(recipe.id, id), scopeCondition(householdId, userId), isNotNull(recipe.trashedAt))
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
								.where(and(eq(recipe.id, id), scopeCondition(householdId, userId))),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to restore recipe', cause: e })
					});

					// Return recipe with original trashedAt so the use-case can check the window
					return originalRecipe;
				}),

			pin: (householdId, userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(recipe)
								.where(
									and(eq(recipe.id, id), scopeCondition(householdId, userId), isNull(recipe.trashedAt))
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
								.set({ pinnedAt: new Date(), updatedAt: new Date() })
								.where(and(eq(recipe.id, id), scopeCondition(householdId, userId))),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to pin recipe', cause: e })
					});
				}),

			unpin: (householdId, userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(recipe)
								.where(
									and(eq(recipe.id, id), scopeCondition(householdId, userId), isNull(recipe.trashedAt))
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
								.set({ pinnedAt: null, updatedAt: new Date() })
								.where(and(eq(recipe.id, id), scopeCondition(householdId, userId))),
						catch: (e) =>
							new RecipeRepositoryError({ message: 'Failed to unpin recipe', cause: e })
					});
				}),

			unpinAll: (householdId, userId) =>
				Effect.tryPromise({
					try: () =>
						db
							.update(recipe)
							.set({ pinnedAt: null, updatedAt: new Date() })
							.where(and(scopeCondition(householdId, userId), isNotNull(recipe.pinnedAt))),
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to unpin all recipes', cause: e })
				}).pipe(Effect.asVoid)
		};
	})
);
