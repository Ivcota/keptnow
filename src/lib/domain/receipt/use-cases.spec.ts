import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import { extractItemsFromReceipt } from './use-cases.js';
import { makeFakeReceiptScanner } from './fake-receipt-scanner.js';
import {
	UnreadableImageError,
	NoItemsExtractedError,
	AIProviderError
} from './errors.js';
import type { ExtractedFoodItem } from './types.js';

const TEST_INPUT = { imageBase64: 'abc123', mimeType: 'image/jpeg' };

const makeItem = (overrides: Partial<ExtractedFoodItem> = {}): ExtractedFoodItem => ({
	name: 'Milk',
	storageLocation: 'fridge',
	trackingType: 'count',
	quantity: 1,
	amount: null,
	expirationDate: null,
	...overrides
});

describe('extractItemsFromReceipt', () => {
	it('returns items with names normalized (trimmed and title-cased)', async () => {
		const items = [
			makeItem({ name: '  whole milk  ' }),
			makeItem({ name: 'CHICKEN BREAST' })
		];

		const result = await Effect.runPromise(
			extractItemsFromReceipt(TEST_INPUT).pipe(
				Effect.provide(makeFakeReceiptScanner(Effect.succeed(items)))
			)
		);

		expect(result[0].name).toBe('Whole Milk');
		expect(result[1].name).toBe('Chicken Breast');
	});

	it('returns empty array when scanner returns no items', async () => {
		const result = await Effect.runPromise(
			extractItemsFromReceipt(TEST_INPUT).pipe(
				Effect.provide(makeFakeReceiptScanner(Effect.succeed([])))
			)
		);

		expect(result).toEqual([]);
	});

	it('propagates UnreadableImageError from scanner', async () => {
		const result = await Effect.runPromise(
			extractItemsFromReceipt(TEST_INPUT).pipe(
				Effect.provide(makeFakeReceiptScanner(Effect.fail(new UnreadableImageError()))),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(UnreadableImageError);
	});

	it('propagates NoItemsExtractedError from scanner', async () => {
		const result = await Effect.runPromise(
			extractItemsFromReceipt(TEST_INPUT).pipe(
				Effect.provide(makeFakeReceiptScanner(Effect.fail(new NoItemsExtractedError()))),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(NoItemsExtractedError);
	});

	it('propagates AIProviderError from scanner', async () => {
		const result = await Effect.runPromise(
			extractItemsFromReceipt(TEST_INPUT).pipe(
				Effect.provide(makeFakeReceiptScanner(Effect.fail(new AIProviderError({ cause: 'timeout' })))),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(AIProviderError);
		expect((result as AIProviderError).cause).toBe('timeout');
	});

	it('preserves non-name fields after normalization', async () => {
		const expDate = new Date('2026-04-01');
		const items = [makeItem({ name: 'greek yogurt', storageLocation: 'fridge', trackingType: 'count', quantity: 2, expirationDate: expDate })];

		const result = await Effect.runPromise(
			extractItemsFromReceipt(TEST_INPUT).pipe(
				Effect.provide(makeFakeReceiptScanner(Effect.succeed(items)))
			)
		);

		expect(result[0]).toEqual({
			name: 'Greek Yogurt',
			storageLocation: 'fridge',
			trackingType: 'count',
			quantity: 2,
			amount: null,
			expirationDate: expDate
		});
	});
});
