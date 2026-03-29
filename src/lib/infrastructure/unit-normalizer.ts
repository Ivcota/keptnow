import type { Quantity } from '$lib/domain/shared/quantity.js';

const VOLUME_TO_ML: Record<string, number> = {
	ml: 1,
	milliliter: 1,
	milliliters: 1,
	millilitre: 1,
	millilitres: 1,
	l: 1000,
	liter: 1000,
	liters: 1000,
	litre: 1000,
	litres: 1000,
	tsp: 4.92892,
	teaspoon: 4.92892,
	teaspoons: 4.92892,
	tbsp: 14.7868,
	tablespoon: 14.7868,
	tablespoons: 14.7868,
	'fl oz': 29.5735,
	'fluid oz': 29.5735,
	'fluid ounce': 29.5735,
	'fluid ounces': 29.5735,
	floz: 29.5735,
	cup: 236.588,
	cups: 236.588,
	pt: 473.176,
	pint: 473.176,
	pints: 473.176,
	qt: 946.353,
	quart: 946.353,
	quarts: 946.353,
	gal: 3785.41,
	gallon: 3785.41,
	gallons: 3785.41
};

const MASS_TO_G: Record<string, number> = {
	g: 1,
	gram: 1,
	grams: 1,
	gramme: 1,
	grammes: 1,
	kg: 1000,
	kilogram: 1000,
	kilograms: 1000,
	kilogramme: 1000,
	kilogrammes: 1000,
	oz: 28.3495,
	ounce: 28.3495,
	ounces: 28.3495,
	lb: 453.592,
	lbs: 453.592,
	pound: 453.592,
	pounds: 453.592
};

const COUNT_TO_COUNT: Record<string, number> = {
	count: 1,
	each: 1,
	item: 1,
	items: 1,
	piece: 1,
	pieces: 1,
	unit: 1,
	units: 1,
	dozen: 12,
	dozens: 12
};

export class UnknownUnitError extends Error {
	constructor(unit: string) {
		super(`Unknown unit: "${unit}"`);
		this.name = 'UnknownUnitError';
	}
}

export function normalizeUnit(value: number, unit: string): Quantity {
	const normalized = unit.trim().toLowerCase();

	const volumeFactor = VOLUME_TO_ML[normalized];
	if (volumeFactor !== undefined) {
		return { value: value * volumeFactor, unit: 'ml' };
	}

	const massFactor = MASS_TO_G[normalized];
	if (massFactor !== undefined) {
		return { value: value * massFactor, unit: 'g' };
	}

	const countFactor = COUNT_TO_COUNT[normalized];
	if (countFactor !== undefined) {
		return { value: value * countFactor, unit: 'count' };
	}

	throw new UnknownUnitError(unit);
}
