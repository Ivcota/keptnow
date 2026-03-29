import { Context, Layer, Effect } from 'effect';
import { eq, and, isNull, isNotNull, gte, inArray } from 'drizzle-orm';
import type { Recipe, RecipeIngredient } from './recipe.js';
import { RecipeRepositoryError } from './errors.js';
import { Database, type DatabaseInstance } from '$lib/infrastructure/database.js';
import { recipe, recipeIngredient } from '$lib/server/db/schema.js';

export interface RecipeService {
	findAll(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
	findTrashed(userId: string): Effect.Effect<Recipe[], RecipeRepositoryError>;
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
