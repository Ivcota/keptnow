import { Layer, Effect } from 'effect';
import { and, eq, isNull, isNotNull, gte } from 'drizzle-orm';
import { FoodItemRepository } from '$lib/domain/inventory/food-item-repository.js';
import { FoodItemRepositoryError, FoodItemNotFoundError } from '$lib/domain/inventory/errors.js';
import type { FoodItem } from '$lib/domain/inventory/food-item.js';
import type { QuantityUnit } from '$lib/domain/shared/quantity.js';
import { Database } from './database.js';
import { foodItem } from '$lib/server/db/schema';

function rowToFoodItem(row: typeof foodItem.$inferSelect): FoodItem {
	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		canonicalName: row.canonicalName,
		storageLocation: row.storageLocation,
		quantity: {
			value: Number(row.quantityValue),
			unit: row.quantityUnit as QuantityUnit
		},
		canonicalIngredientId: row.canonicalIngredientId,
		expirationDate: row.expirationDate,
		trashedAt: row.trashedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

function scopeCondition(householdId: string | null, userId: string) {
	return householdId ? eq(foodItem.householdId, householdId) : eq(foodItem.userId, userId);
}

export const DrizzleFoodItemRepository = Layer.effect(
	FoodItemRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			create: (householdId, userId, input) =>
				Effect.tryPromise({
					try: () =>
						db
							.insert(foodItem)
							.values({
								userId,
								householdId,
								name: input.name,
								canonicalName: input.canonicalName ?? null,
								storageLocation: input.storageLocation,
								quantityValue: String(input.quantity.value),
								quantityUnit: input.quantity.unit,
								expirationDate: input.expirationDate
							})
							.returning()
							.then((rows) => rowToFoodItem(rows[0])),
					catch: (e) =>
						new FoodItemRepositoryError({ message: 'Failed to create food item', cause: e })
				}),
			bulkCreate: (householdId, userId, items) =>
				Effect.tryPromise({
					try: () =>
						db.transaction((tx) =>
							tx
								.insert(foodItem)
								.values(
									items.map((item) => ({
										userId,
										householdId,
										name: item.name,
										canonicalName: item.canonicalName ?? null,
										storageLocation: item.storageLocation,
										quantityValue: String(item.quantity.value),
										quantityUnit: item.quantity.unit,
										expirationDate: item.expirationDate
									}))
								)
								.returning()
								.then((rows) => rows.map(rowToFoodItem))
						),
					catch: (e) =>
						new FoodItemRepositoryError({ message: 'Failed to bulk create food items', cause: e })
				}),
			findAll: (householdId, userId) =>
				Effect.tryPromise({
					try: () =>
						db
							.select()
							.from(foodItem)
							.where(and(scopeCondition(householdId, userId), isNull(foodItem.trashedAt)))
							.then((rows) => rows.map(rowToFoodItem)),
					catch: (e) =>
						new FoodItemRepositoryError({ message: 'Failed to fetch food items', cause: e })
				}),
			update: (householdId, userId, input) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(foodItem)
								.where(
									and(
										eq(foodItem.id, input.id),
										scopeCondition(householdId, userId),
										isNull(foodItem.trashedAt)
									)
								),
						catch: (e) =>
							new FoodItemRepositoryError({ message: 'Failed to find food item', cause: e })
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new FoodItemNotFoundError({ id: input.id }));
					}

					return yield* Effect.tryPromise({
						try: () =>
							db
								.update(foodItem)
								.set({
									name: input.name,
									canonicalName: input.canonicalName ?? null,
									storageLocation: input.storageLocation,
									quantityValue: String(input.quantity.value),
									quantityUnit: input.quantity.unit,
									expirationDate: input.expirationDate,
									updatedAt: new Date()
								})
								.where(and(eq(foodItem.id, input.id), scopeCondition(householdId, userId)))
								.returning()
								.then((rows) => rowToFoodItem(rows[0])),
						catch: (e) =>
							new FoodItemRepositoryError({ message: 'Failed to update food item', cause: e })
					});
				}),
			trash: (householdId, userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(foodItem)
								.where(
									and(eq(foodItem.id, id), scopeCondition(householdId, userId), isNull(foodItem.trashedAt))
								),
						catch: (e) =>
							new FoodItemRepositoryError({ message: 'Failed to find food item', cause: e })
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new FoodItemNotFoundError({ id }));
					}

					yield* Effect.tryPromise({
						try: () =>
							db
								.update(foodItem)
								.set({ trashedAt: new Date(), updatedAt: new Date() })
								.where(and(eq(foodItem.id, id), scopeCondition(householdId, userId))),
						catch: (e) =>
							new FoodItemRepositoryError({ message: 'Failed to trash food item', cause: e })
					});
				}),
			restore: (householdId, userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(foodItem)
								.where(
									and(
										eq(foodItem.id, id),
										scopeCondition(householdId, userId),
										isNotNull(foodItem.trashedAt)
									)
								),
						catch: (e) =>
							new FoodItemRepositoryError({ message: 'Failed to find trashed food item', cause: e })
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new FoodItemNotFoundError({ id }));
					}

					yield* Effect.tryPromise({
						try: () =>
							db
								.update(foodItem)
								.set({ trashedAt: null, updatedAt: new Date() })
								.where(and(eq(foodItem.id, id), scopeCondition(householdId, userId))),
						catch: (e) =>
							new FoodItemRepositoryError({ message: 'Failed to restore food item', cause: e })
					});
				}),
			findTrashed: (householdId, userId) =>
				Effect.tryPromise({
					try: () => {
						const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
						return db
							.select()
							.from(foodItem)
							.where(
								and(
									scopeCondition(householdId, userId),
									isNotNull(foodItem.trashedAt),
									gte(foodItem.trashedAt, windowStart)
								)
							)
							.then((rows) => rows.map(rowToFoodItem));
					},
					catch: (e) =>
						new FoodItemRepositoryError({ message: 'Failed to fetch trashed food items', cause: e })
				}),
			patchCanonicalName: (householdId, userId, id, canonicalName) =>
				Effect.tryPromise({
					try: () =>
						db
							.update(foodItem)
							.set({ canonicalName, updatedAt: new Date() })
							.where(and(eq(foodItem.id, id), scopeCondition(householdId, userId)))
							.then(() => undefined as void),
					catch: (e) =>
						new FoodItemRepositoryError({
							message: 'Failed to patch canonical name',
							cause: e
						})
				}),
			trashAll: (householdId, userId) =>
				Effect.tryPromise({
					try: () =>
						db
							.update(foodItem)
							.set({ trashedAt: new Date(), updatedAt: new Date() })
							.where(and(scopeCondition(householdId, userId), isNull(foodItem.trashedAt)))
							.then(() => undefined as void),
					catch: (e) =>
						new FoodItemRepositoryError({ message: 'Failed to trash all food items', cause: e })
				})
		};
	})
);
