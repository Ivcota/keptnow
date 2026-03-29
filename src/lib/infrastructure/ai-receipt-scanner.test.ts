import { describe, it, expect } from 'vitest';
import { mapRawItemToExtracted } from './ai-receipt-scanner.js';

describe('mapRawItemToExtracted', () => {
	const baseItem = {
		name: 'Whole Milk',
		storageLocation: 'fridge' as const,
		trackingType: 'count' as const,
		quantity: 1,
		amount: null,
		daysToExpiration: null as number | null
	};

	it('computes expiration date from daysToExpiration', () => {
		expect.assertions(1);
		const now = new Date('2026-03-28T00:00:00.000Z');
		const item = { ...baseItem, daysToExpiration: 12 };

		const result = mapRawItemToExtracted(item, now);

		expect(result.expirationDate).toEqual(new Date('2026-04-09T00:00:00.000Z'));
	});

	it('returns null expiration when daysToExpiration is null', () => {
		expect.assertions(1);
		const now = new Date('2026-03-28T00:00:00.000Z');
		const item = { ...baseItem, daysToExpiration: null };

		const result = mapRawItemToExtracted(item, now);

		expect(result.expirationDate).toBeNull();
	});

	it('clamps daysToExpiration below 1 to 1 day', () => {
		expect.assertions(1);
		const now = new Date('2026-03-28T00:00:00.000Z');
		const item = { ...baseItem, daysToExpiration: -5 };

		const result = mapRawItemToExtracted(item, now);

		expect(result.expirationDate).toEqual(new Date('2026-03-29T00:00:00.000Z'));
	});

	it('clamps daysToExpiration above 730 to 730 days', () => {
		expect.assertions(1);
		const now = new Date('2026-03-28T00:00:00.000Z');
		const item = { ...baseItem, daysToExpiration: 9999 };

		const result = mapRawItemToExtracted(item, now);

		const expected = new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000);
		expect(result.expirationDate).toEqual(expected);
	});

	it('passes through other fields unchanged', () => {
		expect.assertions(5);
		const now = new Date('2026-03-28T00:00:00.000Z');
		const item = { ...baseItem, name: 'Chicken Breast', storageLocation: 'freezer' as const, trackingType: 'amount' as const, quantity: 2, amount: 100, daysToExpiration: 90 };

		const result = mapRawItemToExtracted(item, now);

		expect(result.name).toBe('Chicken Breast');
		expect(result.storageLocation).toBe('freezer');
		expect(result.trackingType).toBe('amount');
		expect(result.quantity).toBe(2);
		expect(result.amount).toBe(100);
	});
});
