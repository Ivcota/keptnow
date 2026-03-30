import { describe, it, expect } from 'vitest';
import { normalizeUnit, UnknownUnitError } from './unit-normalizer.js';

describe('normalizeUnit', () => {
	describe('volume units → ml', () => {
		it('passes through ml unchanged', () => {
			expect(normalizeUnit(500, 'ml')).toEqual({ value: 500, unit: 'ml' });
		});

		it('converts tsp to ml', () => {
			expect(normalizeUnit(1, 'tsp').unit).toBe('ml');
			expect(normalizeUnit(1, 'tsp').value).toBeCloseTo(4.929, 2);
		});

		it('converts teaspoon (long form)', () => {
			expect(normalizeUnit(2, 'teaspoon').value).toBeCloseTo(9.858, 2);
		});

		it('converts tbsp to ml', () => {
			expect(normalizeUnit(1, 'tbsp').value).toBeCloseTo(14.787, 2);
		});

		it('converts tablespoons to ml', () => {
			expect(normalizeUnit(3, 'tablespoons').value).toBeCloseTo(44.360, 2);
		});

		it('converts cup to ml', () => {
			expect(normalizeUnit(1, 'cup').value).toBeCloseTo(236.588, 2);
		});

		it('converts 2 cups to ml', () => {
			expect(normalizeUnit(2, 'cups').value).toBeCloseTo(473.176, 2);
		});

		it('converts L to ml', () => {
			expect(normalizeUnit(1, 'L').value).toBeCloseTo(1000, 2);
		});

		it('converts liter to ml', () => {
			expect(normalizeUnit(1.5, 'liter').value).toBeCloseTo(1500, 2);
		});

		it('converts fl oz to ml', () => {
			expect(normalizeUnit(1, 'fl oz').value).toBeCloseTo(29.574, 2);
		});

		it('converts pint to ml', () => {
			expect(normalizeUnit(1, 'pint').value).toBeCloseTo(473.176, 2);
		});

		it('converts quart to ml', () => {
			expect(normalizeUnit(1, 'quart').value).toBeCloseTo(946.353, 2);
		});

		it('converts gallon to ml', () => {
			expect(normalizeUnit(1, 'gallon').value).toBeCloseTo(3785.41, 2);
		});
	});

	describe('mass units → g', () => {
		it('passes through g unchanged', () => {
			expect(normalizeUnit(200, 'g')).toEqual({ value: 200, unit: 'g' });
		});

		it('converts grams (long form)', () => {
			expect(normalizeUnit(100, 'grams')).toEqual({ value: 100, unit: 'g' });
		});

		it('converts kg to g', () => {
			expect(normalizeUnit(1, 'kg').value).toBeCloseTo(1000, 2);
		});

		it('converts kilogram to g', () => {
			expect(normalizeUnit(2, 'kilogram').value).toBeCloseTo(2000, 2);
		});

		it('converts oz to g', () => {
			expect(normalizeUnit(1, 'oz').value).toBeCloseTo(28.35, 1);
		});

		it('converts ounces to g', () => {
			expect(normalizeUnit(4, 'ounces').value).toBeCloseTo(113.398, 2);
		});

		it('converts lb to g', () => {
			expect(normalizeUnit(1, 'lb').value).toBeCloseTo(453.592, 2);
		});

		it('converts pounds to g', () => {
			expect(normalizeUnit(2, 'pounds').value).toBeCloseTo(907.184, 2);
		});

		it('converts lbs to g', () => {
			expect(normalizeUnit(0.5, 'lbs').value).toBeCloseTo(226.796, 2);
		});
	});

	describe('count units → count', () => {
		it('passes through count unchanged', () => {
			expect(normalizeUnit(3, 'count')).toEqual({ value: 3, unit: 'count' });
		});

		it('converts each to count', () => {
			expect(normalizeUnit(5, 'each')).toEqual({ value: 5, unit: 'count' });
		});

		it('converts item to count', () => {
			expect(normalizeUnit(2, 'item')).toEqual({ value: 2, unit: 'count' });
		});

		it('converts items to count', () => {
			expect(normalizeUnit(10, 'items')).toEqual({ value: 10, unit: 'count' });
		});

		it('converts dozen to count (12)', () => {
			expect(normalizeUnit(1, 'dozen')).toEqual({ value: 12, unit: 'count' });
		});

		it('converts 2 dozen to count (24)', () => {
			expect(normalizeUnit(2, 'dozen')).toEqual({ value: 24, unit: 'count' });
		});

		it('converts piece to count', () => {
			expect(normalizeUnit(4, 'piece')).toEqual({ value: 4, unit: 'count' });
		});
	});

	describe('case insensitivity', () => {
		it('handles uppercase unit', () => {
			expect(normalizeUnit(1, 'ML')).toEqual({ value: 1, unit: 'ml' });
		});

		it('handles mixed-case unit', () => {
			expect(normalizeUnit(1, 'Tbsp').value).toBeCloseTo(14.787, 2);
		});

		it('handles uppercase Cup', () => {
			expect(normalizeUnit(1, 'Cup').value).toBeCloseTo(236.588, 2);
		});
	});

	describe('unknown units produce an explicit error', () => {
		it('throws UnknownUnitError for unrecognized unit', () => {
			expect(() => normalizeUnit(1, 'handful')).toThrow(UnknownUnitError);
			expect(() => normalizeUnit(1, 'handful')).toThrow('Unknown unit: "handful"');
		});

		it('throws UnknownUnitError for empty string', () => {
			expect(() => normalizeUnit(1, '')).toThrow(UnknownUnitError);
		});

		it('throws UnknownUnitError for undefined unit', () => {
			expect(() => normalizeUnit(1, undefined as unknown as string)).toThrow(UnknownUnitError);
		});

		it('throws UnknownUnitError for null unit', () => {
			expect(() => normalizeUnit(1, null as unknown as string)).toThrow(UnknownUnitError);
		});

		it('throws UnknownUnitError for partial match', () => {
			expect(() => normalizeUnit(1, 'c')).toThrow(UnknownUnitError);
		});

		it('throws UnknownUnitError for misspelled unit', () => {
			expect(() => normalizeUnit(1, 'grm')).toThrow(UnknownUnitError);
		});
	});
});
