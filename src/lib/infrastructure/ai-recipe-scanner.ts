import { Effect } from 'effect';
import { generateObject, NoObjectGeneratedError } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { z } from 'zod';
import { RecipeScanner } from '$lib/domain/recipe/recipe-scanner.js';
import { UnreadableImageError, NoItemsExtractedError, AIProviderError } from '$lib/domain/receipt/errors.js';
import type { ExtractionError } from '$lib/domain/receipt/errors.js';

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

const extractedIngredientSchema = z.object({
	name: z.string(),
	canonicalName: z.string().nullable(),
	quantity: z.string().nullable(),
	unit: z.string().nullable()
});

const extractedRecipeSchema = z.object({
	name: z.string(),
	ingredients: z.array(extractedIngredientSchema)
});

const SYSTEM_PROMPT = `You are a recipe extractor. Extract all recipes from the photographed recipe book page.

A page may contain one recipe or multiple recipes. Return all recipes found.

For each recipe:
- name: The full recipe name as written on the page
- ingredients: An array of all ingredients listed

For each ingredient:
- name: The ingredient name as written (e.g., "all-purpose flour", "unsalted butter")
- canonicalName: A lowercase, normalized name for matching (e.g., "flour", "butter", "chicken thighs") — omit brand names and descriptors
- quantity: The quantity as a string (e.g., "2", "1/2", "3–4") or null if not specified
- unit: The unit of measurement (e.g., "cups", "tbsp", "lbs", "oz") or null if not specified

Extract only the ingredients list for each recipe. Do not extract recipe instructions.`;

export const AIRecipeScanner = RecipeScanner.of({
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
									mediaType: input.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
								},
								{
									type: 'text',
									text: 'Extract all recipes from this page.'
								}
							]
						}
					]
				});

				const recipes = result.object.filter((r) => r.name.trim());

				if (recipes.length === 0) {
					throw new UnreadableImageError();
				}

				return recipes;
			},
			catch: classifyAIError
		})
});
