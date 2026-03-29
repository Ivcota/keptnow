import { Context, Effect } from 'effect';
import type { ExtractionError } from '$lib/domain/receipt/errors.js';

export interface ExtractedIngredient {
	name: string;
	canonicalName: string | null;
	quantity: string | null;
	unit: string | null;
}

export interface ExtractedRecipe {
	name: string;
	ingredients: ExtractedIngredient[];
}

export interface ScanRecipeInput {
	imageBase64: string;
	mimeType: string;
}

export interface RecipeScanner {
	extractRecipe(input: ScanRecipeInput): Effect.Effect<ExtractedRecipe, ExtractionError>;
}

export const RecipeScanner = Context.GenericTag<RecipeScanner>('RecipeScanner');
