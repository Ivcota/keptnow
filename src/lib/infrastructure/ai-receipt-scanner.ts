import { Context, Effect, Layer } from 'effect';
import { ReceiptScanner } from '$lib/domain/receipt/receipt-scanner.js';

type ReceiptScannerService = Context.Tag.Service<ReceiptScanner>;
import { generateObject, NoObjectGeneratedError } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { z } from 'zod';
import {
	UnreadableImageError,
	NoItemsExtractedError,
	AIProviderError
} from '$lib/domain/receipt/errors.js';
import type { ExtractionError } from '$lib/domain/receipt/errors.js';
import type { ExtractedFoodItem } from '$lib/domain/receipt/types.js';
import { normalizeUnit, UnknownUnitError } from '$lib/infrastructure/unit-normalizer.js';
import type { Quantity } from '$lib/domain/shared/quantity.js';

export interface RawExtractedItem {
	name: string;
	canonicalName: string | null;
	storageLocation: 'pantry' | 'fridge' | 'freezer';
	quantityValue: number;
	quantityUnit: string;
	daysToExpiration: number | null;
}

function safeNormalizeUnit(value: number, unit: string): Quantity {
	try {
		return normalizeUnit(value, unit);
	} catch (e) {
		if (e instanceof UnknownUnitError) {
			return { value, unit: 'count' };
		}
		throw e;
	}
}

export function mapRawItemToExtracted(
	item: RawExtractedItem,
	now: Date = new Date()
): ExtractedFoodItem {
	let expirationDate: Date | null = null;
	if (item.daysToExpiration != null) {
		const clamped = Math.max(1, Math.min(item.daysToExpiration, 730));
		expirationDate = new Date(now.getTime() + clamped * 24 * 60 * 60 * 1000);
	}
	return {
		name: item.name,
		canonicalName: item.canonicalName,
		storageLocation: item.storageLocation,
		quantity: safeNormalizeUnit(item.quantityValue, item.quantityUnit),
		expirationDate
	};
}

export function classifyAIError(e: unknown): ExtractionError {
	if (e instanceof NoItemsExtractedError) return e;
	if (e instanceof UnreadableImageError) return e;
	if (NoObjectGeneratedError.isInstance(e)) return new UnreadableImageError();
	const message = e instanceof Error ? e.message : String(e);
	if (message.includes('No object generated') || message.includes('NoObjectGenerated')) {
		return new UnreadableImageError();
	}
	return new AIProviderError({ cause: e });
}

const extractedFoodItemSchema = z.object({
	name: z.string(),
	canonicalName: z.string().nullable(),
	storageLocation: z.enum(['pantry', 'fridge', 'freezer']),
	quantityValue: z.number(),
	quantityUnit: z.string(),
	daysToExpiration: z.number().nullable()
});

const SYSTEM_PROMPT = `You are a food item extractor. Extract all food items from the receipt image.

For each item:
- name: Expand abbreviations to full product names (e.g. "WHL MLK" → "Whole Milk", "CHKN BRST" → "Chicken Breast")
- canonicalName: A normalized ingredient name for recipe matching (lowercase, generic, no brand or descriptor). Examples: "Whole Milk" → "milk", "Chicken Breast" → "chicken", "Unsalted Butter" → "butter", "All-Purpose Flour" → "flour". Null if not a basic ingredient.
- storageLocation: infer from category:
  - dairy, meat, produce, deli → "fridge"
  - frozen items → "freezer"
  - everything else (canned, dry goods, snacks, beverages, condiments) → "pantry"
- quantityValue: the numeric quantity from the receipt; default to 1 if not shown
- quantityUnit: the unit of measurement. Use standard units: "each" for discrete items (bottles, boxes, bags, cans), "lb", "oz", "g", "kg" for weight, "gal", "qt", "pt", "cup", "fl oz", "l", "ml" for volume. Default to "each" if unclear.
- daysToExpiration: estimate how many days until the item expires, using your judgment per item. Examples for guidance:
  - dairy: ~12 days
  - produce: ~6 days
  - meat/poultry/seafood: ~4 days
  - frozen: ~90 days
  - canned or dry goods: ~730 days
  - other: null

Return only items that are clearly food products.`;

export const AIReceiptScanner: ReceiptScannerService = {
	extractItems: (input) =>
		Effect.tryPromise({
			try: async () => {
				const result = await generateObject({
					model: createAnthropic({ apiKey: ANTHROPIC_API_KEY })('claude-sonnet-4-6'),
					output: 'array',
					schema: extractedFoodItemSchema,
					system: SYSTEM_PROMPT,
					messages: [
						{
							role: 'user',
							content: [
								{
									type: 'image',
									image: input.imageBase64,
									mediaType: input.mimeType as
										| 'image/jpeg'
										| 'image/png'
										| 'image/gif'
										| 'image/webp'
								},
								{
									type: 'text',
									text: 'Extract all food items from this receipt.'
								}
							]
						}
					]
				});

				const items: ExtractedFoodItem[] = result.object.map((item) => mapRawItemToExtracted(item));

				if (items.length === 0) {
					throw new NoItemsExtractedError();
				}

				return items;
			},
			catch: classifyAIError
		})
};

export const AIReceiptScannerLive = Layer.succeed(ReceiptScanner, AIReceiptScanner);
