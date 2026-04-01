import { Context, Effect } from 'effect';
import type { ExtractionError } from '$lib/domain/receipt/errors.js';
import type { Quantity } from '$lib/domain/shared/quantity.js';

export interface ExtractedIngredient {
	name: string;
	canonicalName: string | null;
	quantity: Quantity;
}

export interface ExtractedNote {
	text: string;
}

export interface ExtractedRecipe {
	name: string;
	ingredients: ExtractedIngredient[];
	notes: ExtractedNote[];
}

export interface ScanRecipeInput {
	imageBase64: string;
	mimeType: string;
}

export class RecipeScanner extends Context.Tag('RecipeScanner')<
	RecipeScanner,
	{
		readonly extractRecipes: (
			input: ScanRecipeInput
		) => Effect.Effect<ExtractedRecipe[], ExtractionError>;
	}
>() {}
