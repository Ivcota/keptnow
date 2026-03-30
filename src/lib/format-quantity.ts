import type { Quantity } from '$lib/domain/shared/quantity.js';

const VOLUME_STEPS: Array<{ unit: string; factor: number; minVal: number }> = [
	{ unit: 'gal', factor: 3785.41, minVal: 3785.41 * 0.9 },
	{ unit: 'qt', factor: 946.353, minVal: 946.353 * 0.9 },
	{ unit: 'pt', factor: 473.176, minVal: 473.176 * 0.9 },
	{ unit: 'cup', factor: 236.588, minVal: 236.588 * 0.2 },
	{ unit: 'tbsp', factor: 14.7868, minVal: 14.7868 * 0.4 },
	{ unit: 'tsp', factor: 4.92892, minVal: 4.92892 * 0.9 }
];

const MASS_STEPS: Array<{ unit: string; factor: number; minVal: number }> = [
	{ unit: 'lb', factor: 453.592, minVal: 453.592 * 0.4 },
	{ unit: 'oz', factor: 28.3495, minVal: 28.3495 * 0.9 }
];

function fmtNum(n: number): string {
	return parseFloat(n.toFixed(2)).toString();
}

function tryConvert(
	value: number,
	steps: Array<{ unit: string; factor: number; minVal: number }>
): string | null {
	for (const { unit, factor, minVal } of steps) {
		if (value < minVal) continue;
		const raw = value / factor;
		const rounded = Math.round(raw * 8) / 8;
		if (rounded === 0) continue;
		const relError = Math.abs(raw - rounded) / raw;
		if (relError < 0.001) {
			return `${fmtNum(rounded)} ${unit}`;
		}
	}
	return null;
}

export function formatQuantity(q: Quantity): string {
	const v = q.value;

	if (q.unit === 'count') {
		return fmtNum(v);
	}

	if (q.unit === 'ml') {
		return tryConvert(v, VOLUME_STEPS) ?? `${fmtNum(v)} ml`;
	}

	if (q.unit === 'g') {
		return tryConvert(v, MASS_STEPS) ?? `${fmtNum(v)} g`;
	}

	return `${fmtNum(v)} ${q.unit}`;
}
