import { Effect } from 'effect';
import { ReceiptScanner } from './receipt-scanner.js';
import type { ExtractItemsInput, ExtractedFoodItem } from './types.js';
import type { ExtractionError } from './errors.js';

function toTitleCase(str: string): string {
	return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export const extractItemsFromReceipt = (
	input: ExtractItemsInput
): Effect.Effect<ExtractedFoodItem[], ExtractionError, ReceiptScanner> =>
	Effect.gen(function* () {
		const scanner = yield* ReceiptScanner;
		const items = yield* scanner.extractItems(input);
		return items.map((item) => ({
			...item,
			name: toTitleCase(item.name.trim())
		}));
	});
