import { Context, Effect, Layer } from 'effect';
import { RecipeScanner } from '$lib/domain/recipe/recipe-scanner.js';

type RecipeScannerService = Context.Tag.Service<RecipeScanner>;
import { generateObject, NoObjectGeneratedError } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { z } from 'zod';
import type { ExtractedRecipe } from '$lib/domain/recipe/recipe-scanner.js';
import {
	UnreadableImageError,
	NoItemsExtractedError,
	AIProviderError
} from '$lib/domain/receipt/errors.js';
import type { ExtractionError } from '$lib/domain/receipt/errors.js';
import { normalizeUnit, UnknownUnitError } from '$lib/infrastructure/unit-normalizer.js';
import type { Quantity } from '$lib/domain/shared/quantity.js';

function classifyAIError(e: unknown): ExtractionError {
	if (e instanceof NoItemsExtractedError) return e;
	if (e instanceof UnreadableImageError) return e;
	if (NoObjectGeneratedError.isInstance(e)) return new UnreadableImageError();
	const message = e instanceof Error ? e.message : String(e);
	if (message.includes('No object generated') || message.includes('NoObjectGenerated')) {
		return new UnreadableImageError();
	}
	return new AIProviderError({ cause: e });
}

export interface RawExtractedRecipeItem {
	type: 'ingredient' | 'note';
	name: string;
	canonicalName: string | null;
	quantity: string | null;
	unit: string | null;
}

export interface RawExtractedRecipe {
	name: string;
	items: RawExtractedRecipeItem[];
}

function safeNormalizeQuantity(quantityStr: string | null, unit: string | null): Quantity {
	const value = quantityStr != null ? parseFloat(quantityStr) : NaN;
	if (isNaN(value) || unit == null) {
		return { value: isNaN(value) ? 1 : value, unit: 'count' };
	}
	try {
		return normalizeUnit(value, unit);
	} catch (e) {
		if (e instanceof UnknownUnitError) {
			return { value, unit: 'count' };
		}
		throw e;
	}
}

export function mapRawRecipeToExtracted(raw: RawExtractedRecipe): ExtractedRecipe {
	const ingredients = raw.items
		.filter((item) => item.type === 'ingredient')
		.map((item) => ({
			name: item.name,
			canonicalName: item.canonicalName,
			quantity: safeNormalizeQuantity(item.quantity, item.unit)
		}));

	const notes = raw.items
		.filter((item) => item.type === 'note')
		.map((item) => ({ text: item.name }));

	return { name: raw.name, ingredients, notes };
}

const extractedRecipeItemSchema = z.object({
	type: z.enum(['ingredient', 'note']),
	name: z.string(),
	canonicalName: z.string().nullable(),
	quantity: z.string().nullable(),
	unit: z.string().nullable()
});

const extractedRecipeSchema = z.object({
	name: z.string(),
	items: z.array(extractedRecipeItemSchema)
});

const SYSTEM_PROMPT = `You are a recipe extractor. Extract all recipes from the photographed recipe book page.

A page may contain one recipe or multiple recipes. Return all recipes found.

For each recipe:
- name: The full recipe name as written on the page
- items: An array of all items from the recipe

For each item, set type to "ingredient" or "note":
- type "ingredient": A measured ingredient with name, quantity, and unit
  - name: The ingredient name as written (e.g., "all-purpose flour", "unsalted butter")
  - canonicalName: A lowercase, normalized name for matching (e.g., "flour", "butter", "chicken thighs") — omit brand names and descriptors
  - quantity: The quantity as a string (e.g., "2", "0.5", "3") or null if not specified
  - unit: The unit of measurement (e.g., "cups", "tbsp", "lbs", "oz") or null if not specified
- type "note": Free-text instructions or tips that are not measured ingredients (e.g., "Season to taste", "Serve warm")
  - name: The note text as written
  - canonicalName: null
  - quantity: null
  - unit: null

Extract only the ingredients and notes for each recipe. Do not extract full recipe instructions.`;

export const AIRecipeScanner: RecipeScannerService = {
	extractRecipes: (input) =>
		Effect.tryPromise({
			try: async () => {
				const result = await generateObject({
					model: createAnthropic({ apiKey: ANTHROPIC_API_KEY })('claude-sonnet-4-6'),
					output: 'array',
					schema: extractedRecipeSchema,
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
									text: 'Extract all recipes from this page.'
								}
							]
						}
					]
				});

				const recipes = result.object
					.filter((r) => r.name.trim())
					.map(mapRawRecipeToExtracted);

				if (recipes.length === 0) {
					throw new UnreadableImageError();
				}

				return recipes;
			},
			catch: classifyAIError
		})
};

export const AIRecipeScannerLive = Layer.succeed(RecipeScanner, AIRecipeScanner);
