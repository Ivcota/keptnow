import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { FoodItemRepository } from './food-item-repository.js';
import {
	createFoodItem,
	findAllFoodItems,
	updateFoodItem,
	trashFoodItem,
	restoreFoodItem,
	RESTORE_WINDOW_HOURS
} from './use-cases.js';
import { FoodItemValidationError, FoodItemNotFoundError, FoodItemRestoreExpiredError } from './errors.js';
import type { FoodItem } from './food-item.js';
import { getRestockItems } from './restock.js';
import { DEFAULT_EXPIRATION_CONFIG } from './expiration.js';

const TEST_USER_ID = 'user-1';

const now = new Date();

const makeFoodItem = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	id: 1,
	userId: TEST_USER_ID,
	name: 'Milk',
	storageLocation: 'fridge',
	trackingType: 'count',
	amount: null,
	quantity: 2,
	expirationDate: null,
	trashedAt: null,
	createdAt: now,
	updatedAt: now,
	...overrides
});

const makeRepo = (overrides: Partial<typeof FoodItemRepository.Service> = {}) =>
	Layer.succeed(FoodItemRepository, {
		create: () => Effect.succeed(makeFoodItem()),
		findAll: () => Effect.succeed([]),
		update: () => Effect.succeed(makeFoodItem()),
		trash: () => Effect.succeed(undefined as void),
		restore: () => Effect.succeed(undefined as void),
		findTrashed: () => Effect.succeed([]),
		...overrides
	});

describe('domain/inventory', () => {
	it('createFoodItem delegates to repository on valid input', async () => {
		const created = makeFoodItem({ name: 'Eggs', quantity: 12 });

		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Eggs',
				storageLocation: 'fridge',
				trackingType: 'count',
				amount: null,
				quantity: 12,
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
				trackingType: 'count',
				amount: null,
				quantity: 1,
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/empty/i);
	});

	it('createFoodItem fails when amount is out of range (> 100)', async () => {
		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Olive Oil',
				storageLocation: 'pantry',
				trackingType: 'amount',
				amount: 150,
				quantity: null,
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/0 and 100/i);
	});

	it('createFoodItem fails when amount is negative', async () => {
		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Olive Oil',
				storageLocation: 'pantry',
				trackingType: 'amount',
				amount: -5,
				quantity: null,
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/0 and 100/i);
	});

	it('createFoodItem fails when amount is missing for amount tracking type', async () => {
		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Olive Oil',
				storageLocation: 'pantry',
				trackingType: 'amount',
				amount: null,
				quantity: null,
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/amount is required/i);
	});

	it('createFoodItem fails when quantity is less than 1', async () => {
		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Eggs',
				storageLocation: 'fridge',
				trackingType: 'count',
				amount: null,
				quantity: 0,
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/at least 1/i);
	});

	it('createFoodItem fails when quantity is missing for count tracking type', async () => {
		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Eggs',
				storageLocation: 'fridge',
				trackingType: 'count',
				amount: null,
				quantity: null,
				expirationDate: null
			}).pipe(Effect.provide(makeRepo()), Effect.flip)
		);

		expect(result).toBeInstanceOf(FoodItemValidationError);
		expect((result as FoodItemValidationError).message).toMatch(/quantity is required/i);
	});

	it('createFoodItem accepts valid amount of 0', async () => {
		const created = makeFoodItem({ trackingType: 'amount', amount: 0, quantity: null });

		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Olive Oil',
				storageLocation: 'pantry',
				trackingType: 'amount',
				amount: 0,
				quantity: null,
				expirationDate: null
			}).pipe(Effect.provide(makeRepo({ create: () => Effect.succeed(created) })))
		);

		expect(result).toEqual(created);
	});

	it('createFoodItem accepts valid amount of 100', async () => {
		const created = makeFoodItem({ trackingType: 'amount', amount: 100, quantity: null });

		const result = await Effect.runPromise(
			createFoodItem(TEST_USER_ID, {
				name: 'Olive Oil',
				storageLocation: 'pantry',
				trackingType: 'amount',
				amount: 100,
				quantity: null,
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
				trackingType: 'count',
				amount: null,
				quantity: 2,
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
				trackingType: 'count',
				amount: null,
				quantity: 1,
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
				trackingType: 'count',
				amount: null,
				quantity: 1,
				expirationDate: null
			}).pipe(
				Effect.provide(makeRepo({ update: () => Effect.fail(new FoodItemNotFoundError({ id: 99 })) })),
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
			restoreFoodItem(TEST_USER_ID, 1, trashedAt, now).pipe(
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);
		expect(result).toBeInstanceOf(FoodItemRestoreExpiredError);
		expect((result as FoodItemRestoreExpiredError).id).toBe(1);
	});

	it('restoreFoodItem fails exactly at the boundary (24h elapsed)', async () => {
		const now = new Date();
		const trashedAt = new Date(now.getTime() - RESTORE_WINDOW_HOURS * 60 * 60 * 1000 - 1);

		const result = await Effect.runPromise(
			restoreFoodItem(TEST_USER_ID, 1, trashedAt, now).pipe(
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);
		expect(result).toBeInstanceOf(FoodItemRestoreExpiredError);
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
