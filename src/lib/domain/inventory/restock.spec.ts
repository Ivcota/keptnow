import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import { getRestockItems } from './restock.js';
import { RestockConfigError } from './errors.js';
import { DEFAULT_EXPIRATION_CONFIG } from './expiration.js';
import type { FoodItem } from './food-item.js';

const now = new Date('2026-01-15T12:00:00Z');

const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

const makeItem = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	id: 1,
	userId: 'user-1',
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

describe('getRestockItems', () => {
	it('returns empty list when no items', async () => {
		const result = await Effect.runPromise(getRestockItems([], DEFAULT_EXPIRATION_CONFIG, now));
		expect(result).toEqual([]);
	});

	it('excludes items with no expiration date', async () => {
		const items = [makeItem({ expirationDate: null })];
		const result = await Effect.runPromise(getRestockItems(items, DEFAULT_EXPIRATION_CONFIG, now));
		expect(result).toHaveLength(0);
	});

	it('excludes fresh items', async () => {
		const items = [makeItem({ expirationDate: daysFromNow(10) })];
		const result = await Effect.runPromise(getRestockItems(items, DEFAULT_EXPIRATION_CONFIG, now));
		expect(result).toHaveLength(0);
	});

	it('includes expired items', async () => {
		const items = [makeItem({ expirationDate: daysFromNow(-1) })];
		const result = await Effect.runPromise(getRestockItems(items, DEFAULT_EXPIRATION_CONFIG, now));
		expect(result).toHaveLength(1);
		expect(result[0].expirationStatus).toBe('expired');
	});

	it('includes expiring-soon items', async () => {
		const items = [makeItem({ expirationDate: daysFromNow(1) })];
		const result = await Effect.runPromise(getRestockItems(items, DEFAULT_EXPIRATION_CONFIG, now));
		expect(result).toHaveLength(1);
		expect(result[0].expirationStatus).toBe('expiring-soon');
	});

	it('constructs correct Walmart URL from item name', async () => {
		const items = [makeItem({ name: 'Almond Milk', expirationDate: daysFromNow(-1) })];
		const result = await Effect.runPromise(getRestockItems(items, DEFAULT_EXPIRATION_CONFIG, now));
		expect(result[0].walmartUrl).toBe('https://www.walmart.com/search?q=Almond%20Milk');
	});

	it('encodes special characters in Walmart URL', async () => {
		const items = [makeItem({ name: 'Café & Cream', expirationDate: daysFromNow(-1) })];
		const result = await Effect.runPromise(getRestockItems(items, DEFAULT_EXPIRATION_CONFIG, now));
		expect(result[0].walmartUrl).toBe(
			`https://www.walmart.com/search?q=${encodeURIComponent('Café & Cream')}`
		);
	});

	it('sorts expired before expiring-soon', async () => {
		const items = [
			makeItem({ id: 1, name: 'Cheese', expirationDate: daysFromNow(1) }),
			makeItem({ id: 2, name: 'Milk', expirationDate: daysFromNow(-2) })
		];
		const result = await Effect.runPromise(getRestockItems(items, DEFAULT_EXPIRATION_CONFIG, now));
		expect(result[0].expirationStatus).toBe('expired');
		expect(result[1].expirationStatus).toBe('expiring-soon');
	});

	it('raises RestockConfigError for negative threshold', async () => {
		const result = await Effect.runPromise(
			getRestockItems([], { expiringThresholdDays: -1 }, now).pipe(Effect.flip)
		);
		expect(result).toBeInstanceOf(RestockConfigError);
		expect((result as RestockConfigError).message).toMatch(/non-negative/i);
	});

	it('includes foodItem reference in each RestockItem', async () => {
		const item = makeItem({ id: 42, expirationDate: daysFromNow(-1) });
		const result = await Effect.runPromise(getRestockItems([item], DEFAULT_EXPIRATION_CONFIG, now));
		expect(result[0].foodItem).toEqual(item);
	});
});
