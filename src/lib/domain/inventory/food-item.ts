import type { Quantity } from '$lib/domain/shared/quantity.js';

export type StorageLocation = 'pantry' | 'fridge' | 'freezer';
// TrackingType is kept for shopping list backward compatibility (to be removed in issue #73)
export type TrackingType = 'amount' | 'count';

export interface FoodItem {
	id: number;
	userId: string;
	name: string;
	canonicalName: string | null;
	storageLocation: StorageLocation;
	quantity: Quantity;
	canonicalIngredientId: number | null;
	expirationDate: Date | null;
	trashedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateFoodItemInput {
	name: string;
	canonicalName?: string | null;
	storageLocation: StorageLocation;
	quantity: Quantity;
	expirationDate: Date | null;
}

export interface UpdateFoodItemInput {
	id: number;
	name: string;
	canonicalName?: string | null;
	storageLocation: StorageLocation;
	quantity: Quantity;
	expirationDate: Date | null;
}
