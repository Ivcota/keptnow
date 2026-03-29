import type { Recipe } from './recipe.js';

/**
 * Returns the name of an existing recipe whose normalised name matches the
 * given name, or null if no such recipe exists.
 *
 * Normalisation: trim + lowercase.
 */
export function findSimilarRecipeName(name: string, existingRecipes: Recipe[]): string | null {
	const normalized = name.trim().toLowerCase();
	const match = existingRecipes.find((r) => r.name.trim().toLowerCase() === normalized);
	return match?.name ?? null;
}
