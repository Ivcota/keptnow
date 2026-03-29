import { describe, it, expect } from 'vitest';
import { matchIngredients, calculateReadiness } from './ingredient-matching.js';
import type { RecipeIngredient } from './recipe.js';
import type { FoodItem } from '$lib/domain/inventory/food-item.js';

const now = new Date();

function makeIngredient(overrides: Partial<RecipeIngredient> & { name: string }): RecipeIngredient {
	return { id: 1, recipeId: 1, canonicalName: null, quantity: null, unit: null, ...overrides };
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
	it('matches by canonicalName when both are set', () => {
		const ingredients = [makeIngredient({ name: 'all-purpose flour', canonicalName: 'flour' })];
		const foodItems = [makeFoodItem({ name: 'Bread Flour', canonicalName: 'flour' })];
		const result = matchIngredients(ingredients, foodItems);
		expect(result).toEqual([{ ingredient: ingredients[0], matched: true }]);
	});

	it('falls back to lowercased display name when canonicalName is null', () => {
		const ingredients = [makeIngredient({ name: 'Butter', canonicalName: null })];
		const foodItems = [makeFoodItem({ name: 'butter', canonicalName: null })];
		const result = matchIngredients(ingredients, foodItems);
		expect(result[0].matched).toBe(true);
	});

	it('matching is case-insensitive', () => {
		const ingredients = [makeIngredient({ name: 'MILK', canonicalName: null })];
		const foodItems = [makeFoodItem({ name: 'Milk', canonicalName: null })];
		expect(matchIngredients(ingredients, foodItems)[0].matched).toBe(true);
	});

	it('does not match when no food item has the ingredient', () => {
		const ingredients = [makeIngredient({ name: 'truffle oil', canonicalName: 'truffle oil' })];
		const foodItems = [makeFoodItem({ name: 'olive oil', canonicalName: 'olive oil' })];
		expect(matchIngredients(ingredients, foodItems)[0].matched).toBe(false);
	});

	it('matches ingredient canonicalName against food item display name fallback', () => {
		const ingredients = [makeIngredient({ name: 'chicken thighs', canonicalName: 'chicken' })];
		const foodItems = [makeFoodItem({ name: 'chicken', canonicalName: null })];
		expect(matchIngredients(ingredients, foodItems)[0].matched).toBe(true);
	});

	it('matches food item canonicalName against ingredient display name fallback', () => {
		const ingredients = [makeIngredient({ name: 'chicken', canonicalName: null })];
		const foodItems = [makeFoodItem({ name: 'Whole Chicken', canonicalName: 'chicken' })];
		expect(matchIngredients(ingredients, foodItems)[0].matched).toBe(true);
	});

	it('returns empty array for empty ingredients', () => {
		const foodItems = [makeFoodItem({ name: 'flour' })];
		expect(matchIngredients([], foodItems)).toEqual([]);
	});

	it('handles multiple ingredients with partial matches', () => {
		const ingredients = [
			makeIngredient({ name: 'flour', canonicalName: 'flour' }),
			makeIngredient({ name: 'egg', canonicalName: 'egg' }),
			makeIngredient({ name: 'truffle', canonicalName: 'truffle' })
		];
		const foodItems = [
			makeFoodItem({ name: 'flour', canonicalName: 'flour' }),
			makeFoodItem({ name: 'eggs', canonicalName: 'egg' })
		];
		const result = matchIngredients(ingredients, foodItems);
		expect(result[0].matched).toBe(true);
		expect(result[1].matched).toBe(true);
		expect(result[2].matched).toBe(false);
	});
});

describe('calculateReadiness', () => {
	it('returns ready when all ingredients are matched', () => {
		const ingredients = [makeIngredient({ name: 'flour', canonicalName: 'flour' })];
		const foodItems = [makeFoodItem({ name: 'flour', canonicalName: 'flour' })];
		const result = calculateReadiness(ingredients, foodItems);
		expect(result).toEqual({ matched: 1, total: 1, status: 'ready' });
	});

	it('returns ready when there are no ingredients', () => {
		const result = calculateReadiness([], []);
		expect(result).toEqual({ matched: 0, total: 0, status: 'ready' });
	});

	it('returns almost-ready when >= 50% matched', () => {
		const ingredients = [
			makeIngredient({ name: 'a', canonicalName: 'a' }),
			makeIngredient({ name: 'b', canonicalName: 'b' })
		];
		const foodItems = [makeFoodItem({ name: 'a', canonicalName: 'a' })];
		const result = calculateReadiness(ingredients, foodItems);
		expect(result).toEqual({ matched: 1, total: 2, status: 'almost-ready' });
	});

	it('returns need-to-shop when < 50% matched', () => {
		const ingredients = [
			makeIngredient({ name: 'a', canonicalName: 'a' }),
			makeIngredient({ name: 'b', canonicalName: 'b' }),
			makeIngredient({ name: 'c', canonicalName: 'c' })
		];
		const foodItems = [makeFoodItem({ name: 'a', canonicalName: 'a' })];
		const result = calculateReadiness(ingredients, foodItems);
		expect(result).toEqual({ matched: 1, total: 3, status: 'need-to-shop' });
	});

	it('returns need-to-shop when nothing matched', () => {
		const ingredients = [makeIngredient({ name: 'saffron', canonicalName: 'saffron' })];
		const result = calculateReadiness(ingredients, []);
		expect(result).toEqual({ matched: 0, total: 1, status: 'need-to-shop' });
	});
});
