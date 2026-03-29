export type UnitCategory = 'volume' | 'mass' | 'count';

export interface CanonicalIngredient {
	id: number;
	name: string;
	unitCategory: UnitCategory;
}
