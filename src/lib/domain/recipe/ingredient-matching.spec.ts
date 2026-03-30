import { describe, it, expect } from 'vitest';
import { matchIngredients, calculateReadiness } from './ingredient-matching.js';
import type { Ingredient } from './recipe.js';
import type { FoodItem } from '$lib/domain/inventory/food-item.js';

const now = new Date();

function makeIngredient(overrides: Partial<Ingredient> & { name: string }): Ingredient {
	return {
		id: 1,
		recipeId: 1,
		canonicalName: null,
		canonicalIngredientId: null,
		quantity: { value: 1, unit: 'count' },
		...overrides
	};
}

function makeFoodItem(overrides: Partial<FoodItem> & { name: string }): FoodItem {
	return {
		id: 1,
		userId: 'u1',
		storageLocation: 'pantry',
		quantity: { value: 1, unit: 'count' },
		canonicalIngredientId: null,
		expirationDate: null,
		trashedAt: null,
		canonicalName: null,
		createdAt: now,
		updatedAt: now,
		...overrides
	};
}

describe('matchIngredients', () => {
	it('matches by canonicalIngredientId when both are set', () => {
		const ingredients = [makeIngredient({ name: 'all-purpose flour', canonicalIngredientId: 5 })];
		const foodItems = [makeFoodItem({ name: 'Bread Flour', canonicalIngredientId: 5 })];
		const result = matchIngredients(ingredients, foodItems);
		expect(result[0].matched).toBe(true);
	});

	it('does not match when both have canonical IDs but they differ', () => {
		const ingredients = [makeIngredient({ name: 'flour', canonicalIngredientId: 5 })];
		const foodItems = [makeFoodItem({ name: 'flour', canonicalIngredientId: 6 })];
		const result = matchIngredients(ingredients, foodItems);
		expect(result[0].matched).toBe(false);
	});

	it('falls back to name comparison when canonicalIngredientId is null on ingredient', () => {
		const ingredients = [makeIngredient({ name: 'Butter', canonicalIngredientId: null })];
		const foodItems = [makeFoodItem({ name: 'butter', canonicalIngredientId: null })];
		const result = matchIngredients(ingredients, foodItems);
		expect(result[0].matched).toBe(true);
	});

	it('name matching is case-insensitive', () => {
		const ingredients = [makeIngredient({ name: 'MILK', canonicalIngredientId: null })];
		const foodItems = [makeFoodItem({ name: 'Milk', canonicalIngredientId: null })];
		expect(matchIngredients(ingredients, foodItems)[0].matched).toBe(true);
	});

	it('does not match when no food item has the ingredient', () => {
		const ingredients = [makeIngredient({ name: 'truffle oil', canonicalIngredientId: null })];
		const foodItems = [makeFoodItem({ name: 'olive oil', canonicalIngredientId: null })];
		expect(matchIngredients(ingredients, foodItems)[0].matched).toBe(false);
	});

	it('falls back to food item canonicalName for name comparison', () => {
		const ingredients = [makeIngredient({ name: 'chicken', canonicalIngredientId: null })];
		const foodItems = [
			makeFoodItem({ name: 'Whole Chicken', canonicalName: 'chicken', canonicalIngredientId: null })
		];
		expect(matchIngredients(ingredients, foodItems)[0].matched).toBe(true);
	});

	it('returns empty array for empty ingredients', () => {
		const foodItems = [makeFoodItem({ name: 'flour' })];
		expect(matchIngredients([], foodItems)).toEqual([]);
	});

	it('handles multiple ingredients with partial matches', () => {
		const ingredients = [
			makeIngredient({ name: 'flour', canonicalIngredientId: 1 }),
			makeIngredient({ name: 'egg', canonicalIngredientId: 2 }),
			makeIngredient({ name: 'truffle', canonicalIngredientId: 3 })
		];
		const foodItems = [
			makeFoodItem({ name: 'flour', canonicalIngredientId: 1 }),
			makeFoodItem({ name: 'eggs', canonicalIngredientId: 2 })
		];
		const result = matchIngredients(ingredients, foodItems);
		expect(result[0].matched).toBe(true);
		expect(result[1].matched).toBe(true);
		expect(result[2].matched).toBe(false);
	});
});

describe('calculateReadiness', () => {
	it('returns ready when all ingredients are matched', () => {
		const ingredients = [makeIngredient({ name: 'flour', canonicalIngredientId: 1 })];
		const foodItems = [makeFoodItem({ name: 'flour', canonicalIngredientId: 1 })];
		const result = calculateReadiness(ingredients, foodItems);
		expect(result).toEqual({ matched: 1, total: 1, status: 'ready' });
	});

	it('returns ready when there are no ingredients', () => {
		const result = calculateReadiness([], []);
		expect(result).toEqual({ matched: 0, total: 0, status: 'ready' });
	});

	it('returns almost-ready when >= 50% matched', () => {
		const ingredients = [
			makeIngredient({ name: 'a', canonicalIngredientId: 1 }),
			makeIngredient({ name: 'b', canonicalIngredientId: 2 })
		];
		const foodItems = [makeFoodItem({ name: 'a', canonicalIngredientId: 1 })];
		const result = calculateReadiness(ingredients, foodItems);
		expect(result).toEqual({ matched: 1, total: 2, status: 'almost-ready' });
	});

	it('returns need-to-shop when < 50% matched', () => {
		const ingredients = [
			makeIngredient({ name: 'a', canonicalIngredientId: 1 }),
			makeIngredient({ name: 'b', canonicalIngredientId: 2 }),
			makeIngredient({ name: 'c', canonicalIngredientId: 3 })
		];
		const foodItems = [makeFoodItem({ name: 'a', canonicalIngredientId: 1 })];
		const result = calculateReadiness(ingredients, foodItems);
		expect(result).toEqual({ matched: 1, total: 3, status: 'need-to-shop' });
	});

	it('returns need-to-shop when nothing matched', () => {
		const ingredients = [makeIngredient({ name: 'saffron', canonicalIngredientId: null })];
		const result = calculateReadiness(ingredients, []);
		expect(result).toEqual({ matched: 0, total: 1, status: 'need-to-shop' });
	});

	it('counts ingredient as matched when inventory quantity is sufficient', () => {
		const ingredients = [
			makeIngredient({ name: 'flour', quantity: { value: 500, unit: 'g' } })
		];
		const foodItems = [
			makeFoodItem({ name: 'flour', quantity: { value: 600, unit: 'g' } })
		];
		const result = calculateReadiness(ingredients, foodItems);
		expect(result).toEqual({ matched: 1, total: 1, status: 'ready' });
	});

	it('flags unitMismatch when recipe and inventory units differ', () => {
		const ingredients = [
			makeIngredient({ name: 'flour', quantity: { value: 500, unit: 'g' } })
		];
		const foodItems = [
			makeFoodItem({ name: 'flour', quantity: { value: 2, unit: 'count' } })
		];
		const result = matchIngredients(ingredients, foodItems);
		expect(result[0].unitMismatch).toBe(true);
		expect(result[0].matched).toBe(false);
	});

	it('does not match when units are incompatible between recipe and inventory', () => {
		const ingredients = [
			makeIngredient({ name: 'flour', quantity: { value: 500, unit: 'g' } })
		];
		const foodItems = [
			makeFoodItem({ name: 'flour', quantity: { value: 2, unit: 'count' } })
		];
		const result = calculateReadiness(ingredients, foodItems);
		expect(result).toEqual({ matched: 0, total: 1, status: 'need-to-shop' });
	});

	it('does not count ingredient as matched when inventory quantity is insufficient', () => {
		const ingredients = [
			makeIngredient({ name: 'flour', quantity: { value: 500, unit: 'g' } })
		];
		const foodItems = [
			makeFoodItem({ name: 'flour', quantity: { value: 100, unit: 'g' } })
		];
		const result = calculateReadiness(ingredients, foodItems);
		expect(result).toEqual({ matched: 0, total: 1, status: 'need-to-shop' });
	});
});
