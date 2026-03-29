import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { createFoodItems } from '$lib/domain/inventory/use-cases.js';
import { DrizzleFoodItemRepository } from './drizzle-food-item-repository.js';
import { Database } from './database.js';
import type { FoodItem } from '$lib/domain/inventory/food-item.js';

const TEST_USER_ID = 'user-1';

const makeDbLayer = (mockDb: object) =>
	DrizzleFoodItemRepository.pipe(Layer.provide(Layer.succeed(Database, mockDb as never)));

const makeFoodItemRow = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	id: 1,
	userId: TEST_USER_ID,
	name: 'Milk',
	canonicalName: null,
	storageLocation: 'fridge',
	quantity: { value: 2, unit: 'count' },
	canonicalIngredientId: null,
	expirationDate: null,
	trashedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides
});

describe('DrizzleFoodItemRepository', () => {
	it('bulkCreate inserts all items in a single transaction and returns them', () => {
		const row1 = makeFoodItemRow({ id: 1, name: 'Milk' });
		const row2 = makeFoodItemRow({ id: 2, name: 'Eggs', quantity: { value: 12, unit: 'count' } });

		const mockDb = {
			transaction: (fn: (tx: unknown) => Promise<FoodItem[]>) => {
				const tx = {
					insert: () => ({
						values: () => ({
							returning: () => Promise.resolve([row1, row2])
						})
					})
				};
				return fn(tx);
			}
		};

		return Effect.runPromise(
			createFoodItems(TEST_USER_ID, [
				{
					name: 'Milk',
					storageLocation: 'fridge',
					quantity: { value: 2, unit: 'count' },
					expirationDate: null
				},
				{
					name: 'Eggs',
					storageLocation: 'fridge',
					quantity: { value: 12, unit: 'count' },
					expirationDate: null
				}
			]).pipe(Effect.provide(makeDbLayer(mockDb)))
		).then((result) => {
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe('Milk');
			expect(result[1].name).toBe('Eggs');
		});
	});
});
