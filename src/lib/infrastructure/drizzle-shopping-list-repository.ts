import { Layer, Effect } from 'effect';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { ShoppingListRepository } from '$lib/domain/shopping-list/shopping-list-repository.js';
import {
	ShoppingListRepositoryError,
	ShoppingListItemNotFoundError
} from '$lib/domain/shopping-list/errors.js';
import type {
	ShoppingListItem,
	RecipeShoppingItemInput
} from '$lib/domain/shopping-list/shopping-list-item.js';
import { Database } from './database.js';
import { shoppingListItem } from '$lib/server/db/schema.js';

function rowToItem(row: typeof shoppingListItem.$inferSelect): ShoppingListItem {
	return {
		id: row.id,
		userId: row.userId,
		canonicalKey: row.canonicalKey,
		displayName: row.displayName,
		checked: row.checked,
		sourceType: row.sourceType,
		sourceRestockItemId: row.sourceRestockItemId,
		sourceRecipeNames: row.sourceRecipeNames ?? null,
		carriedStorageLocation: row.carriedStorageLocation,
		carriedTrackingType: row.carriedTrackingType,
		createdAt: row.createdAt
	};
}

export const DrizzleShoppingListRepository = Layer.effect(
	ShoppingListRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			findAll: (userId) =>
				Effect.tryPromise({
					try: () =>
						db
							.select()
							.from(shoppingListItem)
							.where(eq(shoppingListItem.userId, userId))
							.then((rows) => rows.map(rowToItem)),
					catch: (e) =>
						new ShoppingListRepositoryError({
							message: 'Failed to fetch shopping list',
							cause: e
						})
				}),

			addMissingRestock: (userId, items) =>
				Effect.tryPromise({
					try: async () => {
						if (items.length === 0) return;
						// ON CONFLICT (user_id, canonical_key) DO NOTHING — skip already-present keys
						await db
							.insert(shoppingListItem)
							.values(
								items.map((item) => ({
									userId,
									canonicalKey: item.canonicalKey,
									displayName: item.displayName,
									checked: false,
									sourceType: 'restock' as const,
									sourceRestockItemId: item.sourceRestockItemId,
									carriedStorageLocation: item.carriedStorageLocation,
									carriedTrackingType: item.carriedTrackingType
								}))
							)
							.onConflictDoNothing();
					},
					catch: (e) =>
						new ShoppingListRepositoryError({
							message: 'Failed to add restock shopping items',
							cause: e
						})
				}),

			removeUncheckedStale: (userId, activeCanonicalKeys) =>
				Effect.tryPromise({
					try: async () => {
						const conditions = [
							eq(shoppingListItem.userId, userId),
							eq(shoppingListItem.checked, false)
						];
						if (activeCanonicalKeys.length > 0) {
							conditions.push(notInArray(shoppingListItem.canonicalKey, activeCanonicalKeys));
						}
						await db.delete(shoppingListItem).where(and(...conditions));
					},
					catch: (e) =>
						new ShoppingListRepositoryError({
							message: 'Failed to remove stale shopping items',
							cause: e
						})
				}),

			mergeRecipeIngredients: (userId, items) =>
				Effect.tryPromise({
					try: async () => {
						if (items.length === 0) return;
						// INSERT new recipe items; on conflict (user_id, canonical_key) update only sourceRecipeNames
						await db
							.insert(shoppingListItem)
							.values(
								items.map((item) => ({
									userId,
									canonicalKey: item.canonicalKey,
									displayName: item.displayName,
									checked: false,
									sourceType: 'recipe' as const,
									sourceRecipeNames: item.sourceRecipeNames,
									carriedStorageLocation: item.carriedStorageLocation,
									carriedTrackingType: item.carriedTrackingType
								}))
							)
							.onConflictDoUpdate({
								target: [shoppingListItem.userId, shoppingListItem.canonicalKey],
								set: { sourceRecipeNames: sql`excluded.source_recipe_names` }
							});
					},
					catch: (e) =>
						new ShoppingListRepositoryError({
							message: 'Failed to merge recipe shopping items',
							cause: e
						})
				}),

			setChecked: (userId, id, checked) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(shoppingListItem)
								.where(and(eq(shoppingListItem.id, id), eq(shoppingListItem.userId, userId))),
						catch: (e) =>
							new ShoppingListRepositoryError({
								message: 'Failed to find shopping list item',
								cause: e
							})
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new ShoppingListItemNotFoundError({ id }));
					}

					yield* Effect.tryPromise({
						try: () =>
							db
								.update(shoppingListItem)
								.set({ checked })
								.where(and(eq(shoppingListItem.id, id), eq(shoppingListItem.userId, userId))),
						catch: (e) =>
							new ShoppingListRepositoryError({
								message: 'Failed to update shopping list item',
								cause: e
							})
					});
				}),

			clearAll: (userId) =>
				Effect.tryPromise({
					try: () =>
						db
							.delete(shoppingListItem)
							.where(eq(shoppingListItem.userId, userId))
							.then(() => undefined),
					catch: (e) =>
						new ShoppingListRepositoryError({
							message: 'Failed to clear shopping list',
							cause: e
						})
				})
		};
	})
);
