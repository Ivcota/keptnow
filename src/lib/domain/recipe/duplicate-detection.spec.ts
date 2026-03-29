import { describe, it, expect } from 'vitest';
import { findSimilarRecipeName } from './duplicate-detection.js';
import type { Recipe } from './recipe.js';

const now = new Date();

const makeRecipe = (name: string, id = 1): Recipe => ({
	id,
	userId: 'user-1',
	name,
	ingredients: [],
	trashedAt: null,
	createdAt: now,
	updatedAt: now
});

describe('findSimilarRecipeName', () => {
	it('returns null when no recipes exist', () => {
		expect(findSimilarRecipeName('Chicken Soup', [])).toBeNull();
	});

	it('returns null when no name matches', () => {
		const recipes = [makeRecipe('Pasta'), makeRecipe('Tacos', 2)];
		expect(findSimilarRecipeName('Chicken Soup', recipes)).toBeNull();
	});

	it('returns the existing recipe name on exact match', () => {
		const recipes = [makeRecipe('Chicken Soup')];
		expect(findSimilarRecipeName('Chicken Soup', recipes)).toBe('Chicken Soup');
	});

	it('matches case-insensitively', () => {
		const recipes = [makeRecipe('Chicken Soup')];
		expect(findSimilarRecipeName('chicken soup', recipes)).toBe('Chicken Soup');
		expect(findSimilarRecipeName('CHICKEN SOUP', recipes)).toBe('Chicken Soup');
	});

	it('matches ignoring leading and trailing whitespace', () => {
		const recipes = [makeRecipe('Chicken Soup')];
		expect(findSimilarRecipeName('  Chicken Soup  ', recipes)).toBe('Chicken Soup');
	});

	it('does not match partial names', () => {
		const recipes = [makeRecipe('Chicken Soup')];
		expect(findSimilarRecipeName('Chicken', recipes)).toBeNull();
	});

	it('returns the first match when multiple recipes share a normalised name', () => {
		const recipes = [makeRecipe('Pasta', 1), makeRecipe('pasta', 2)];
		expect(findSimilarRecipeName('PASTA', recipes)).toBe('Pasta');
	});
});
