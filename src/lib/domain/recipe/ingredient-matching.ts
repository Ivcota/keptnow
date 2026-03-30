import type { Ingredient } from './recipe.js';
import type { FoodItem } from '$lib/domain/inventory/food-item.js';
import { isEnough, sum, type Quantity } from '$lib/domain/shared/quantity.js';

export interface IngredientMatch {
	ingredient: Ingredient;
	matched: boolean;
	inventoryQuantity: Quantity | null;
	unitMismatch: boolean;
}

export type ReadinessStatus = 'ready' | 'almost-ready' | 'need-to-shop';

export interface RecipeReadiness {
	matched: number;
	total: number;
	status: ReadinessStatus;
}

function findMatchingFoodItems(ingredient: Ingredient, foodItems: FoodItem[]): FoodItem[] {
	return foodItems.filter((fi) => {
		if (ingredient.canonicalIngredientId !== null && fi.canonicalIngredientId !== null) {
			return ingredient.canonicalIngredientId === fi.canonicalIngredientId;
		}
		const ingredientKey = (ingredient.canonicalName ?? ingredient.name).toLowerCase().trim();
		const fiKey = (fi.canonicalName ?? fi.name).toLowerCase().trim();
		return fiKey === ingredientKey;
	});
}

function matchIngredientToFoodItems(
	ingredient: Ingredient,
	foodItems: FoodItem[]
): Omit<IngredientMatch, 'ingredient'> {
	const matching = findMatchingFoodItems(ingredient, foodItems);
	if (matching.length === 0) {
		return { matched: false, inventoryQuantity: null, unitMismatch: false };
	}

	// Check for unit mismatch
	const sameUnit = matching.filter((fi) => fi.quantity.unit === ingredient.quantity.unit);
	if (sameUnit.length === 0) {
		return { matched: false, inventoryQuantity: null, unitMismatch: true };
	}

	const inventoryQuantity = sum(sameUnit.map((fi) => fi.quantity));
	return {
		matched: isEnough(inventoryQuantity, ingredient.quantity),
		inventoryQuantity,
		unitMismatch: false
	};
}

export function matchIngredients(
	ingredients: Ingredient[],
	foodItems: FoodItem[]
): IngredientMatch[] {
	return ingredients.map((ingredient) => ({
		ingredient,
		...matchIngredientToFoodItems(ingredient, foodItems)
	}));
}

export function calculateReadiness(
	ingredients: Ingredient[],
	foodItems: FoodItem[]
): RecipeReadiness {
	const total = ingredients.length;
	if (total === 0) return { matched: 0, total: 0, status: 'ready' };

	const matches = matchIngredients(ingredients, foodItems);
	const matched = matches.filter((m) => m.matched).length;

	let status: ReadinessStatus;
	if (matched === total) {
		status = 'ready';
	} else if (matched / total >= 0.5) {
		status = 'almost-ready';
	} else {
		status = 'need-to-shop';
	}

	return { matched, total, status };
}
