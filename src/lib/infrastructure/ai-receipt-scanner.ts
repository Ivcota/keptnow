import { Effect } from 'effect';
import { generateObject, NoObjectGeneratedError } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { z } from 'zod';
import { ReceiptScanner } from '$lib/domain/receipt/receipt-scanner.js';
import { UnreadableImageError, NoItemsExtractedError, AIProviderError } from '$lib/domain/receipt/errors.js';
import type { ExtractionError } from '$lib/domain/receipt/errors.js';
import type { ExtractedFoodItem } from '$lib/domain/receipt/types.js';

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
	storageLocation: z.enum(['pantry', 'fridge', 'freezer']),
	trackingType: z.enum(['amount', 'count']),
	quantity: z.number().nullable(),
	amount: z.number().nullable(),
	expirationDate: z.string().nullable()
});

const SYSTEM_PROMPT = `You are a food item extractor. Extract all food items from the receipt image.

For each item:
- name: Expand abbreviations to full product names (e.g. "WHL MLK" → "Whole Milk", "CHKN BRST" → "Chicken Breast")
- storageLocation: infer from category:
  - dairy, meat, produce, deli → "fridge"
  - frozen items → "freezer"
  - everything else (canned, dry goods, snacks, beverages, condiments) → "pantry"
- trackingType: "count" for discrete items (bottles, boxes, bags, cans), "amount" for items measured by fill level (0–100%)
- quantity: use the quantity shown on the receipt; default to 1 if not shown
- amount: null (only set if trackingType is "amount", in which case set to 100)
- expirationDate: estimate from today based on category:
  - dairy: 12 days
  - produce: 6 days
  - meat/poultry/seafood: 4 days
  - frozen: 90 days
  - canned or dry goods: 730 days
  - other: null

Return only items that are clearly food products.`;

export const AIReceiptScanner = ReceiptScanner.of({
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
									mediaType: input.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
								},
								{
									type: 'text',
									text: 'Extract all food items from this receipt.'
								}
							]
						}
					]
				});

				const items: ExtractedFoodItem[] = result.object.map((item) => ({
					...item,
					expirationDate: item.expirationDate ? new Date(item.expirationDate) : null
				}));

				if (items.length === 0) {
					throw new NoItemsExtractedError();
				}

				return items;
			},
			catch: classifyAIError
		})
});
