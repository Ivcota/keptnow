import { Context, Layer, Effect } from 'effect';
import { eq, and, isNull, isNotNull, gte, inArray } from 'drizzle-orm';
import type { Recipe, RecipeIngredient, CreateRecipeInput, UpdateRecipeInput } from './recipe.js';
import {
	RecipeRepositoryError,
	RecipeValidationError,
	RecipeNotFoundError
} from './errors.js';
import { Database, type DatabaseInstance } from '$lib/infrastructure/database.js';
import { recipe, recipeIngredient } from '$lib/server/db/schema.js';

export interface RecipeService {
	findAll(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
	findTrashed(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
	create(
		userId: string,
		input: CreateRecipeInput
	): Effect.Effect<Recipe, RecipeValidationError | RecipeRepositoryError>;
	update(
		userId: string,
		input: UpdateRecipeInput
	): Effect.Effect<Recipe, RecipeValidationError | RecipeNotFoundError | RecipeRepositoryError>;
}

export const RecipeService = Context.GenericTag<RecipeService>('RecipeService');

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

function validateFields(input: {
	name: string;
	ingredients: { name: string }[];
}): Effect.Effect<void, RecipeValidationError> {
	return Effect.gen(function* () {
		if (!input.name.trim()) {
			yield* Effect.fail(new RecipeValidationError({ message: 'Recipe name must not be empty' }));
		}
		for (const ingredient of input.ingredients) {
			if (!ingredient.name.trim()) {
				yield* Effect.fail(
					new RecipeValidationError({ message: 'Ingredient name must not be empty' })
				);
			}
		}
	});
}

export const RecipeServiceLive = Layer.effect(
	RecipeService,
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
					catch: (e) => new RecipeRepositoryError({ message: 'Failed to fetch recipes', cause: e })
				}),

			findTrashed: (userId) =>
				Effect.tryPromise({
					try: async () => {
						const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
						const rows = await db
							.select()
							.from(recipe)
							.where(
								and(
									eq(recipe.userId, userId),
									isNotNull(recipe.trashedAt),
									gte(recipe.trashedAt, windowStart)
								)
							);
						return fetchWithIngredients(db, rows);
					},
					catch: (e) =>
						new RecipeRepositoryError({ message: 'Failed to fetch trashed recipes', cause: e })
				}),

			create: (userId, input) =>
				Effect.gen(function* () {
					yield* validateFields(input);
					return yield* Effect.tryPromise({
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
					});
				}),

			update: (userId, input) =>
				Effect.gen(function* () {
					yield* validateFields(input);

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
				})
		};
	})
);

export const findAllRecipes = (
	userId: string
): Effect.Effect<Recipe[], RecipeRepositoryError, RecipeService> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.findAll(userId);
	});

export const findTrashedRecipes = (
	userId: string
): Effect.Effect<Recipe[], RecipeRepositoryError, RecipeService> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.findTrashed(userId);
	});

export const createRecipe = (
	userId: string,
	input: CreateRecipeInput
): Effect.Effect<Recipe, RecipeValidationError | RecipeRepositoryError, RecipeService> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.create(userId, input);
	});

export const updateRecipe = (
	userId: string,
	input: UpdateRecipeInput
): Effect.Effect<
	Recipe,
	RecipeValidationError | RecipeNotFoundError | RecipeRepositoryError,
	RecipeService
> =>
	Effect.gen(function* () {
		const svc = yield* RecipeService;
		return yield* svc.update(userId, input);
	});
