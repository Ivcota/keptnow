import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { FoodItemRepository } from './food-item-repository.js';
import {
	createFoodItem,
	createFoodItems,
	findAllFoodItems,
	updateFoodItem,
	trashFoodItem,
	restoreFoodItem,
	RESTORE_WINDOW_HOURS
} from './use-cases.js';
import {
	FoodItemValidationError,
	FoodItemNotFoundError,
	FoodItemRestoreExpiredError
} from './errors.js';
import type { FoodItem } from './food-item.js';
import { getRestockItems } from './restock.js';
import { DEFAULT_EXPIRATION_CONFIG } from './expiration.js';

const TEST_USER_ID = 'user-1';

const now = new Date();

const makeFoodItem = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	id: 1,
	userId: TEST_USER_ID,
	name: 'Milk',
	canonicalName: null,
	storageLocation: 'fridge',
	quantity: { value: 2, unit: 'count' },
	canonicalIngredientId: null,
	expirationDate: null,
	trashedAt: null,
	createdAt: now,
	updatedAt: now,
	...overrides
});

const makeRepo = (overrides: Partial<typeof FoodItemRepository.Service> = {}) =>
	Layer.succeed(FoodItemRepository, {
		create: () => Effect.succeed(makeFoodItem()),
		bulkCreate: () => Effect.succeed([]),
		findAll: () => Effect.succeed([]),
		update: () => Effect.succeed(makeFoodItem()),
		trash: () => Effect.succeed(undefined as void),
		restore: () => Effect.succeed(undefined as void),
		findTrashed: () => Effect.succeed([]),
		patchCanonicalName: () => Effect.succeed(undefined as void),
		...overrides
	});

describe('domain/inventory', () => {
	it('createFoodItem delegates to repository on valid input', async () => {
		const created = makeFoodItem({ name: 'Eggs', quantity: { value: 12, unit: 'count' } });

		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Eggs',
				storageLocation: 'fridge',
				quantity: { value: 12, unit: 'count' },
				expirationDate: null
			}).pipe(Effect.provide(makeRepo({ create: () => Effect.succeed(created) })))
		);

		expect(result).toEqual(created);
	});

	it('findAllFoodItems returns items from repository', async () => {
		const items = [makeFoodItem({ id: 1 }), makeFoodItem({ id: 2, name: 'Cheese' })];

		const result = await Effect.runPromise(
			findAllFoodItems(TEST_USER_ID).pipe(
				Effect.provide(makeRepo({ findAll: () => Effect.succeed(items) }))
			)
		);

		expect(result).toEqual(items);
	});

	it('createFoodItem fails with FoodItemValidationError for empty name', async () => {
		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: '',
				storageLocation: 'pantry',
				quantity: { value: 1, unit: 'count' },
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/empty/i);
	});

	it('createFoodItem fails when quantity value is zero', async () => {
		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Olive Oil',
				storageLocation: 'pantry',
				quantity: { value: 0, unit: 'ml' },
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/greater than 0/i);
	});

	it('createFoodItem fails when quantity value is negative', async () => {
		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Olive Oil',
				storageLocation: 'pantry',
				quantity: { value: -5, unit: 'ml' },
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/greater than 0/i);
	});

	it('createFoodItem accepts valid volume quantity', async () => {
		const created = makeFoodItem({ quantity: { value: 473, unit: 'ml' } });

		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Olive Oil',
				storageLocation: 'pantry',
				quantity: { value: 473, unit: 'ml' },
				expirationDate: null
			}).pipe(Effect.provide(makeRepo({ create: () => Effect.succeed(created) })))
		);

		expect(result).toEqual(created);
	});

	it('createFoodItem accepts valid mass quantity', async () => {
		const created = makeFoodItem({ quantity: { value: 500, unit: 'g' } });

		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Flour',
				storageLocation: 'pantry',
				quantity: { value: 500, unit: 'g' },
				expirationDate: null
			}).pipe(Effect.provide(makeRepo({ create: () => Effect.succeed(created) })))
		);

		expect(result).toEqual(created);
	});

	it('updateFoodItem delegates to repository on valid input', async () => {
		const updated = makeFoodItem({ name: 'Oat Milk', storageLocation: 'pantry' });

		const result = await Effect.runPromise(
			updateFoodItem(TEST_USER_ID, {
				id: 1,
				name: 'Oat Milk',
				storageLocation: 'pantry',
				quantity: { value: 2, unit: 'count' },
				expirationDate: null
			}).pipe(Effect.provide(makeRepo({ update: () => Effect.succeed(updated) })))
		);

		expect(result).toEqual(updated);
	});

	it('updateFoodItem applies same validation as createFoodItem', async () => {
		const result = await Effect.runPromise(
			updateFoodItem(TEST_USER_ID, {
				id: 1,
				name: '',
				storageLocation: 'fridge',
				quantity: { value: 1, unit: 'count' },
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/empty/i);
	});

	it('updateFoodItem propagates FoodItemNotFoundError', async () => {
		const result = await Effect.runPromise(
			updateFoodItem(TEST_USER_ID, {
				id: 99,
				name: 'Ghost Item',
				storageLocation: 'fridge',
				quantity: { value: 1, unit: 'count' },
				expirationDate: null
			}).pipe(
				Effect.provide(
					makeRepo({ update: () => Effect.fail(new FoodItemNotFoundError({ id: 99 })) })
				),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(FoodItemNotFoundError);
		expect((result as FoodItemNotFoundError).id).toBe(99);
	});

	it('trashFoodItem delegates to repository', async () => {
		const result = await Effect.runPromise(
			trashFoodItem(TEST_USER_ID, 1).pipe(Effect.provide(makeRepo()))
		);
		expect(result).toBeUndefined();
	});

	it('restoreFoodItem succeeds when trashed within window', async () => {
		const now = new Date();
		const trashedAt = new Date(now.getTime() - (RESTORE_WINDOW_HOURS - 1) * 60 * 60 * 1000);

		const result = await Effect.runPromise(
			restoreFoodItem(TEST_USER_ID, 1, trashedAt, now).pipe(Effect.provide(makeRepo()))
		);
		expect(result).toBeUndefined();
	});

	it('restoreFoodItem fails with FoodItemRestoreExpiredError when window has passed', async () => {
		const now = new Date();
		const trashedAt = new Date(now.getTime() - (RESTORE_WINDOW_HOURS + 1) * 60 * 60 * 1000);

		const result = await Effect.runPromise(
			restoreFoodItem(TEST_USER_ID, 1, trashedAt, now).pipe(Effect.provide(makeRepo()), Effect.flip)
		);
		expect(result).toBeInstanceOf(FoodItemRestoreExpiredError);
		expect((result as FoodItemRestoreExpiredError).id).toBe(1);
	});

	it('restoreFoodItem fails exactly at the boundary (24h elapsed)', async () => {
		const now = new Date();
		const trashedAt = new Date(now.getTime() - RESTORE_WINDOW_HOURS * 60 * 60 * 1000 - 1);

		const result = await Effect.runPromise(
			restoreFoodItem(TEST_USER_ID, 1, trashedAt, now).pipe(Effect.provide(makeRepo()), Effect.flip)
		);
		expect(result).toBeInstanceOf(FoodItemRestoreExpiredError);
	});

	it('createFoodItems delegates to repository when all items are valid', async () => {
		const item1 = makeFoodItem({ id: 1, name: 'Milk' });
		const item2 = makeFoodItem({ id: 2, name: 'Eggs', quantity: { value: 12, unit: 'count' } });
		const created = [item1, item2];

		const result = await Effect.runPromise(
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
			]).pipe(Effect.provide(makeRepo({ bulkCreate: () => Effect.succeed(created) })))
		);

		expect(result).toEqual(created);
	});

	it('createFoodItems fails with FoodItemValidationError when one item has an empty name', async () => {
		const result = await Effect.runPromise(
			createFoodItems(TEST_USER_ID, [
				{
					name: 'Milk',
					storageLocation: 'fridge',
					quantity: { value: 2, unit: 'count' },
					expirationDate: null
				},
				{
					name: '',
					storageLocation: 'pantry',
					quantity: { value: 1, unit: 'count' },
					expirationDate: null
				}
			]).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/empty/i);
	});

	it('createFoodItems fails on first invalid item and does not call bulkCreate', async () => {
		let bulkCreateCalled = false;

		const result = await Effect.runPromise(
			createFoodItems(TEST_USER_ID, [
				{
					name: 'Bad Item',
					storageLocation: 'pantry',
					quantity: { value: 0, unit: 'ml' },
					expirationDate: null
				}
			]).pipe(
				Effect.provide(
					makeRepo({
						bulkCreate: () => {
							bulkCreateCalled = true;
							return Effect.succeed([]);
						}
					})
				),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect(bulkCreateCalled).toBe(false);
	});
});

describe('domain/inventory restock integration', () => {
	const now = new Date('2026-01-15T12:00:00Z');
	const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

	it('getRestockItems filters items returned by findAllFoodItems', async () => {
		const items = [
			makeFoodItem({ id: 1, name: 'Expired Milk', expirationDate: daysFromNow(-1) }),
			makeFoodItem({ id: 2, name: 'Fresh Eggs', expirationDate: daysFromNow(10) }),
			makeFoodItem({ id: 3, name: 'Soon Cheese', expirationDate: daysFromNow(1) })
		];

		const allItems = await Effect.runPromise(
			findAllFoodItems(TEST_USER_ID).pipe(
				Effect.provide(makeRepo({ findAll: () => Effect.succeed(items) }))
			)
		);

		const restockItems = await Effect.runPromise(
			getRestockItems(allItems, DEFAULT_EXPIRATION_CONFIG, now)
		);

		expect(restockItems).toHaveLength(2);
		expect(restockItems.map((r) => r.foodItem.id)).not.toContain(2);
	});

	it('getRestockItems sorts expired before expiring-soon from findAllFoodItems result', async () => {
		const items = [
			makeFoodItem({ id: 1, name: 'Soon Item', expirationDate: daysFromNow(2) }),
			makeFoodItem({ id: 2, name: 'Expired Item', expirationDate: daysFromNow(-3) })
		];

		const allItems = await Effect.runPromise(
			findAllFoodItems(TEST_USER_ID).pipe(
				Effect.provide(makeRepo({ findAll: () => Effect.succeed(items) }))
			)
		);

		const restockItems = await Effect.runPromise(
			getRestockItems(allItems, DEFAULT_EXPIRATION_CONFIG, now)
		);

		expect(restockItems[0].expirationStatus).toBe('expired');
		expect(restockItems[1].expirationStatus).toBe('expiring-soon');
	});
});
