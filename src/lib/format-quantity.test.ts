import { describe, it, expect } from 'vitest';
import { formatQuantity } from './format-quantity.js';

describe('formatQuantity', () => {
	describe('count unit', () => {
		it('formats whole count as integer', () => {
			expect(formatQuantity({ value: 3, unit: 'count' })).toBe('3');
		});

		it('formats fractional count to 2 decimal places', () => {
			expect(formatQuantity({ value: 1.5, unit: 'count' })).toBe('1.5');
		});

		it('removes trailing zeros', () => {
			expect(formatQuantity({ value: 2.0, unit: 'count' })).toBe('2');
		});
	});

	describe('ml unit — reverse-converts to cooking units', () => {
		it('converts 1 cup (236.588 ml)', () => {
			expect(formatQuantity({ value: 236.588, unit: 'ml' })).toBe('1 cup');
		});

		it('converts 2 cups — prefers pint (same value, pint wins by order)', () => {
			// 473.176 ml = 1 pint = 2 cups; pint comes first in preference order
			expect(formatQuantity({ value: 473.176, unit: 'ml' })).toBe('1 pt');
		});

		it('converts 1 tbsp (14.7868 ml)', () => {
			expect(formatQuantity({ value: 14.7868, unit: 'ml' })).toBe('1 tbsp');
		});

		it('converts 3 tbsp', () => {
			expect(formatQuantity({ value: 14.7868 * 3, unit: 'ml' })).toBe('3 tbsp');
		});

		it('converts 1 tsp (4.92892 ml)', () => {
			expect(formatQuantity({ value: 4.92892, unit: 'ml' })).toBe('1 tsp');
		});

		it('converts 2 tsp', () => {
			expect(formatQuantity({ value: 4.92892 * 2, unit: 'ml' })).toBe('2 tsp');
		});

		it('falls back to ml for non-clean values', () => {
			expect(formatQuantity({ value: 100, unit: 'ml' })).toBe('100 ml');
		});

		it('falls back to ml for small non-tsp values', () => {
			expect(formatQuantity({ value: 1, unit: 'ml' })).toBe('1 ml');
		});
	});

	describe('g unit — reverse-converts to cooking units', () => {
		it('converts 1 lb (453.592 g)', () => {
			expect(formatQuantity({ value: 453.592, unit: 'g' })).toBe('1 lb');
		});

		it('converts 2 lb', () => {
			expect(formatQuantity({ value: 453.592 * 2, unit: 'g' })).toBe('2 lb');
		});

		it('converts 1 oz (28.3495 g)', () => {
			expect(formatQuantity({ value: 28.3495, unit: 'g' })).toBe('1 oz');
		});

		it('converts 4 oz', () => {
			expect(formatQuantity({ value: 28.3495 * 4, unit: 'g' })).toBe('4 oz');
		});

		it('falls back to g for non-clean values', () => {
			expect(formatQuantity({ value: 150, unit: 'g' })).toBe('150 g');
		});

		it('falls back to g for small values', () => {
			expect(formatQuantity({ value: 5, unit: 'g' })).toBe('5 g');
		});
	});
});
