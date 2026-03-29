import type { StorageLocation, TrackingType } from '$lib/domain/inventory/food-item.js';

export type ShoppingListSourceType = 'restock' | 'recipe';

export interface ShoppingListItem {
	id: number;
	userId: string;
	canonicalKey: string;
	displayName: string;
	checked: boolean;
	sourceType: ShoppingListSourceType;
	sourceRestockItemId: number | null;
	sourceRecipeNames: string[] | null;
	carriedStorageLocation: StorageLocation;
	carriedTrackingType: TrackingType;
	createdAt: Date;
}

export interface RestockShoppingItemInput {
	canonicalKey: string;
	displayName: string;
	sourceRestockItemId: number;
	carriedStorageLocation: StorageLocation;
	carriedTrackingType: TrackingType;
}

export interface RecipeShoppingItemInput {
	canonicalKey: string;
	displayName: string;
	sourceRecipeNames: string[];
	carriedStorageLocation: StorageLocation;
	carriedTrackingType: TrackingType;
}
