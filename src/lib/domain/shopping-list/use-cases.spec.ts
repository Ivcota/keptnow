import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { ShoppingListRepository } from './shopping-list-repository.js';
import { FoodItemRepository } from '$lib/domain/inventory/food-item-repository.js';
import { RecipeRepository } from '$lib/domain/recipe/recipe-repository.js';
import { ShoppingListRepositoryError } from './errors.js';
import { generateShoppingList, completeShoppingTrip } from './use-cases.js';
import type { ShoppingListItem, RecipeShoppingItemInput } from './shopping-list-item.js';
import type { FoodItem, CreateFoodItemInput } from '$lib/domain/inventory/food-item.js';
import type { Recipe } from '$lib/domain/recipe/recipe.js';

const now = new Date('2026-01-10T12:00:00Z');
const expiredDate = new Date('2026-01-05T12:00:00Z'); // 5 days ago
const freshDate = new Date('2026-06-01T12:00:00Z'); // far future

function makeFoodItem(overrides: Partial<FoodItem> = {}): FoodItem {
	return {
		id: 1,
		userId: 'user-a',
		name: 'Milk',
		canonicalName: 'milk',
		storageLocation: 'fridge',
		quantity: { value: 2, unit: 'count' },
		canonicalIngredientId: null,
		expirationDate: expiredDate,
		trashedAt: null,
		createdAt: now,
		updatedAt: now,
		...overrides
	};
}

function makeShoppingListItem(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
	return {
		id: 1,
		userId: 'user-a',
		canonicalKey: 'milk',
		displayName: 'Milk',
		checked: false,
		sourceType: 'restock',
		sourceRestockItemId: 1,
		sourceRecipeNames: null,
		carriedStorageLocation: 'fridge',
		quantity: { value: 1, unit: 'count' as const },
		createdAt: now,
		...overrides
	};
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
	return {
		id: 1,
		userId: 'user-a',
		name: 'Pasta',
		ingredients: [],
		notes: [],
		pinnedAt: now,
		trashedAt: null,
		createdAt: now,
		updatedAt: now,
		...overrides
	};
}

const noop = () => Effect.die('not implemented');

function makeShoppingListRepo(
	overrides: Partial<ShoppingListRepository>
): Layer.Layer<ShoppingListRepository> {
	return Layer.succeed(ShoppingListRepository, {
		findAll: noop,
		addMissingRestock: noop,
		mergeRecipeIngredients: noop,
		removeUncheckedStale: () => Effect.void,
		setChecked: noop,
		clearAll: noop,
		...overrides
	} as ShoppingListRepository);
}

function makeRecipeRepo(overrides: Partial<RecipeRepository>): Layer.Layer<RecipeRepository> {
	return Layer.succeed(RecipeRepository, {
		findAll: noop,
		findTrashed: noop,
		create: noop,
		update: noop,
		trash: noop,
		restore: noop,
		pin: noop,
		unpin: noop,
		...overrides
	} as RecipeRepository);
}

function makeFoodItemRepo(overrides: Partial<FoodItemRepository>): Layer.Layer<FoodItemRepository> {
	return Layer.succeed(FoodItemRepository, {
		findAll: noop,
		findTrashed: noop,
		create: noop,
		bulkCreate: noop,
		update: noop,
		trash: noop,
		restore: noop,
		patchCanonicalName: noop,
		...overrides
	} as FoodItemRepository);
}

const baseFoodItem: FoodItem = {
	id: 10,
	userId: 'user-a',
	name: 'Milk',
	canonicalName: 'milk',
	storageLocation: 'fridge',
	quantity: { value: 2, unit: 'count' },
	canonicalIngredientId: null,
	expirationDate: new Date('2026-04-01'),
	trashedAt: null,
	createdAt: now,
	updatedAt: now
};

const baseRestockShoppingItem: ShoppingListItem = {
	id: 1,
	userId: 'user-a',
	canonicalKey: 'milk',
	displayName: 'Milk',
	checked: true,
	sourceType: 'restock',
	sourceRestockItemId: 10,
	sourceRecipeNames: null,
	carriedStorageLocation: 'fridge',
	quantity: { value: 1, unit: 'count' as const },
	createdAt: now
};

const baseRecipeShoppingItem: ShoppingListItem = {
	id: 2,
	userId: 'user-a',
	canonicalKey: 'flour',
	displayName: 'Flour',
	checked: true,
	sourceType: 'recipe',
	sourceRestockItemId: null,
	sourceRecipeNames: ['Bread'],
	carriedStorageLocation: 'pantry',
	quantity: { value: 1, unit: 'count' as const },
	createdAt: now
};

describe('generateShoppingList', () => {
	it('calls addMissingRestock with restock items derived from expiring food items', async () => {
		const expiredItem = makeFoodItem({ id: 10, name: 'Milk', canonicalName: 'milk' });
		let capturedItems: unknown = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: (_, items) => {
				capturedItems = items;
				return Effect.void;
			},
			mergeRecipeIngredients: () => Effect.void,
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([expiredItem])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedItems).toEqual([
			{
				canonicalKey: 'milk',
				displayName: 'Milk',
				sourceRestockItemId: 10,
				carriedStorageLocation: 'fridge',
				quantity: { value: 2, unit: 'count' }
			}
		]);
	});

	it('uses raw name as canonicalKey when canonicalName is null', async () => {
		const item = makeFoodItem({ id: 5, name: 'Organic Baby Spinach', canonicalName: null });
		let capturedItems: unknown = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: (_, items) => {
				capturedItems = items;
				return Effect.void;
			},
			mergeRecipeIngredients: () => Effect.void,
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([item])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect((capturedItems as { canonicalKey: string }[])[0].canonicalKey).toBe(
			'organic baby spinach'
		);
	});

	it('does not call addMissingRestock for fresh (non-expiring) items', async () => {
		const freshItem = makeFoodItem({ expirationDate: freshDate });
		let addCalled = false;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => {
				addCalled = true;
				return Effect.void;
			},
			mergeRecipeIngredients: () => Effect.void,
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([freshItem])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(addCalled).toBe(false);
	});

	it('does not call addMissingRestock for items with no expiration date', async () => {
		const noExpiry = makeFoodItem({ expirationDate: null });
		let addCalled = false;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => {
				addCalled = true;
				return Effect.void;
			},
			mergeRecipeIngredients: () => Effect.void,
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([noExpiry])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(addCalled).toBe(false);
	});

	it('returns the full shopping list from the repository', async () => {
		const item = makeShoppingListItem();

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: () => Effect.void,
			findAll: () => Effect.succeed([item])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		const result = await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(result).toEqual([item]);
	});

	it('propagates ShoppingListRepositoryError from addMissingRestock', async () => {
		const expiredItem = makeFoodItem();

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () =>
				Effect.fail(new ShoppingListRepositoryError({ message: 'DB error' })),
			mergeRecipeIngredients: () => Effect.void
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([expiredItem])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		const error = await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.flip,
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(error).toBeInstanceOf(ShoppingListRepositoryError);
	});

	it('adds missing ingredients from pinned recipes to the shopping list', async () => {
		const recipe = makeRecipe({
			id: 1,
			name: 'Pasta',
			ingredients: [{ id: 1, recipeId: 1, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 1, unit: 'count' as const } }]
		});
		let capturedRecipeItems: RecipeShoppingItemInput[] | null = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: (_, items) => {
				capturedRecipeItems = items;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([]) // Flour not in inventory
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([recipe]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedRecipeItems).toHaveLength(1);
		expect(capturedRecipeItems![0].canonicalKey).toBe('flour');
		expect(capturedRecipeItems![0].displayName).toBe('Flour');
		expect(capturedRecipeItems![0].sourceRecipeNames).toEqual(['Pasta']);
	});

	it('excludes ingredients that are already in inventory', async () => {
		const recipe = makeRecipe({
			ingredients: [
				{ id: 1, recipeId: 1, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 1, unit: 'count' as const } },
				{ id: 2, recipeId: 1, name: 'Sugar', canonicalName: null, canonicalIngredientId: null, quantity: { value: 1, unit: 'count' as const } }
			]
		});
		const flourInInventory = makeFoodItem({ id: 2, name: 'Flour', canonicalName: 'flour', expirationDate: freshDate });
		let capturedRecipeItems: RecipeShoppingItemInput[] | null = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: (_, items) => {
				capturedRecipeItems = items;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([flourInInventory])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([recipe]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedRecipeItems).toHaveLength(1);
		expect(capturedRecipeItems![0].canonicalKey).toBe('sugar');
	});

	it('does not add ingredients from unpinned recipes', async () => {
		const unpinnedRecipe = makeRecipe({
			pinnedAt: null,
			ingredients: [{ id: 1, recipeId: 1, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 1, unit: 'count' as const } }]
		});
		let mergeCallCount = 0;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: (_, items) => {
				mergeCallCount += items.length;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([unpinnedRecipe]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(mergeCallCount).toBe(0);
	});

	it('does not add ingredients from trashed recipes', async () => {
		const trashedRecipe = makeRecipe({
			pinnedAt: now,
			trashedAt: now,
			ingredients: [{ id: 1, recipeId: 1, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 1, unit: 'count' as const } }]
		});
		let mergeCallCount = 0;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: (_, items) => {
				mergeCallCount += items.length;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([trashedRecipe]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(mergeCallCount).toBe(0);
	});

	it('calls removeUncheckedStale with the active canonical keys', async () => {
		const expiredItem = makeFoodItem({ id: 10, name: 'Milk', canonicalName: 'milk' });
		let capturedKeys: string[] | null = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: () => Effect.void,
			removeUncheckedStale: (_, keys) => {
				capturedKeys = keys;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([expiredItem]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedKeys).toEqual(['milk']);
	});

	it('calls removeUncheckedStale with empty array when no sources produce items', async () => {
		let capturedKeys: string[] | null = null;

		const shoppingListLayer = makeShoppingListRepo({
			removeUncheckedStale: (_, keys) => {
				capturedKeys = keys;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedKeys).toEqual([]);
	});

	it('deduplicates ingredients across multiple recipes into one item with merged source names', async () => {
		const recipe1 = makeRecipe({
			id: 1,
			name: 'Pasta',
			ingredients: [{ id: 1, recipeId: 1, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 1, unit: 'count' as const } }]
		});
		const recipe2 = makeRecipe({
			id: 2,
			name: 'Pancakes',
			ingredients: [{ id: 2, recipeId: 2, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 1, unit: 'count' as const } }]
		});
		let capturedRecipeItems: RecipeShoppingItemInput[] | null = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: (_, items) => {
				capturedRecipeItems = items;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([recipe1, recipe2]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedRecipeItems).toHaveLength(1);
		expect(capturedRecipeItems![0].canonicalKey).toBe('flour');
		expect(capturedRecipeItems![0].sourceRecipeNames).toEqual(['Pasta', 'Pancakes']);
	});

	it('calculates deficit quantity when inventory has some but not enough', async () => {
		const recipe = makeRecipe({
			ingredients: [
				{ id: 1, recipeId: 1, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 500, unit: 'g' as const } }
			]
		});
		const flourInInventory = makeFoodItem({
			id: 2,
			name: 'Flour',
			canonicalName: 'flour',
			quantity: { value: 200, unit: 'g' },
			expirationDate: freshDate
		});
		let capturedRecipeItems: RecipeShoppingItemInput[] | null = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: (_, items) => {
				capturedRecipeItems = items;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([flourInInventory])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([recipe]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedRecipeItems).toHaveLength(1);
		expect(capturedRecipeItems![0].quantity).toEqual({ value: 300, unit: 'g' });
	});

	it('sums quantities across multiple recipes and calculates deficit against inventory', async () => {
		const recipe1 = makeRecipe({
			id: 1,
			name: 'Pasta',
			ingredients: [
				{ id: 1, recipeId: 1, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 200, unit: 'g' as const } }
			]
		});
		const recipe2 = makeRecipe({
			id: 2,
			name: 'Pancakes',
			ingredients: [
				{ id: 2, recipeId: 2, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 300, unit: 'g' as const } }
			]
		});
		const flourInInventory = makeFoodItem({
			id: 2,
			name: 'Flour',
			canonicalName: 'flour',
			quantity: { value: 100, unit: 'g' },
			expirationDate: freshDate
		});
		let capturedRecipeItems: RecipeShoppingItemInput[] | null = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: (_, items) => {
				capturedRecipeItems = items;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([flourInInventory])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([recipe1, recipe2]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedRecipeItems).toHaveLength(1);
		expect(capturedRecipeItems![0].quantity).toEqual({ value: 400, unit: 'g' });
		expect(capturedRecipeItems![0].sourceRecipeNames).toEqual(['Pasta', 'Pancakes']);
	});

	it('uses full recipe quantity when unit mismatch with inventory', async () => {
		const recipe = makeRecipe({
			ingredients: [
				{ id: 1, recipeId: 1, name: 'Flour', canonicalName: null, canonicalIngredientId: null, quantity: { value: 500, unit: 'g' as const } }
			]
		});
		const flourInInventory = makeFoodItem({
			id: 2,
			name: 'Flour',
			canonicalName: 'flour',
			quantity: { value: 2, unit: 'count' },
			expirationDate: freshDate
		});
		let capturedRecipeItems: RecipeShoppingItemInput[] | null = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: (_, items) => {
				capturedRecipeItems = items;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([flourInInventory])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([recipe]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedRecipeItems).toHaveLength(1);
		expect(capturedRecipeItems![0].quantity).toEqual({ value: 500, unit: 'g' });
	});

	it('carries food item quantity on restock shopping items', async () => {
		const expiredItem = makeFoodItem({
			id: 10,
			name: 'Milk',
			canonicalName: 'milk',
			quantity: { value: 500, unit: 'ml' }
		});
		let capturedItems: unknown = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: (_, items) => {
				capturedItems = items;
				return Effect.void;
			},
			mergeRecipeIngredients: () => Effect.void,
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([expiredItem])
		});
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect((capturedItems as { quantity: unknown }[])[0].quantity).toEqual({
			value: 500,
			unit: 'ml'
		});
	});
});

describe('completeShoppingTrip', () => {
	it('trashes the original food item for checked restock items', async () => {
		const trashedIds: number[] = [];

		const shoppingListLayer = makeShoppingListRepo({
			findAll: () => Effect.succeed([baseRestockShoppingItem]),
			clearAll: () => Effect.void
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([baseFoodItem]),
			trash: (_, id) => {
				trashedIds.push(id);
				return Effect.void;
			},
			bulkCreate: () => Effect.succeed([])
		});

		await Effect.runPromise(
			completeShoppingTrip('user-a', []).pipe(
				Effect.provide(Layer.merge(shoppingListLayer, foodItemLayer))
			)
		);

		expect(trashedIds).toEqual([10]);
	});

	it('creates a replacement food item using the shopping item quantity', async () => {
		const restockItem: ShoppingListItem = {
			...baseRestockShoppingItem,
			quantity: { value: 500, unit: 'ml' as const }
		};
		const createdInputs: CreateFoodItemInput[] = [];

		const shoppingListLayer = makeShoppingListRepo({
			findAll: () => Effect.succeed([restockItem]),
			clearAll: () => Effect.void
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([baseFoodItem]),
			trash: () => Effect.void,
			bulkCreate: (_, inputs) => {
				createdInputs.push(...inputs);
				return Effect.succeed([]);
			}
		});

		await Effect.runPromise(
			completeShoppingTrip('user-a', []).pipe(
				Effect.provide(Layer.merge(shoppingListLayer, foodItemLayer))
			)
		);

		expect(createdInputs).toHaveLength(1);
		expect(createdInputs[0]).toMatchObject({
			name: 'Milk',
			canonicalName: 'milk',
			storageLocation: 'fridge',
			quantity: { value: 500, unit: 'ml' },
			expirationDate: null
		});
	});

	it('bulk-creates recipe items passed as input', async () => {
		const createdInputs: CreateFoodItemInput[] = [];
		const recipeInput: CreateFoodItemInput = {
			name: 'Flour',
			canonicalName: null,
			storageLocation: 'pantry',
			quantity: { value: 1, unit: 'count' },
			expirationDate: null
		};

		const shoppingListLayer = makeShoppingListRepo({
			findAll: () => Effect.succeed([baseRecipeShoppingItem]),
			clearAll: () => Effect.void
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([]),
			bulkCreate: (_, inputs) => {
				createdInputs.push(...inputs);
				return Effect.succeed([]);
			}
		});

		await Effect.runPromise(
			completeShoppingTrip('user-a', [recipeInput]).pipe(
				Effect.provide(Layer.merge(shoppingListLayer, foodItemLayer))
			)
		);

		// canonicalName is enriched from the shopping list item's canonicalKey
		expect(createdInputs).toContainEqual({ ...recipeInput, canonicalName: 'flour' });
	});

	it('enriches recipe item canonicalName from shopping list canonicalKey when canonicalName is null', async () => {
		const createdInputs: CreateFoodItemInput[] = [];
		const recipeItemWithNullCanonical: CreateFoodItemInput = {
			name: 'Chicken Breasts',
			canonicalName: null,
			storageLocation: 'fridge',
			quantity: { value: 1, unit: 'count' },
			expirationDate: null
		};
		const recipeShoppingItem: ShoppingListItem = {
			...baseRecipeShoppingItem,
			canonicalKey: 'chicken',
			displayName: 'Chicken Breasts',
			sourceRecipeNames: ['Roast Chicken']
		};

		const shoppingListLayer = makeShoppingListRepo({
			findAll: () => Effect.succeed([recipeShoppingItem]),
			clearAll: () => Effect.void
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([]),
			bulkCreate: (_, inputs) => {
				createdInputs.push(...inputs);
				return Effect.succeed([]);
			}
		});

		await Effect.runPromise(
			completeShoppingTrip('user-a', [recipeItemWithNullCanonical]).pipe(
				Effect.provide(Layer.merge(shoppingListLayer, foodItemLayer))
			)
		);

		expect(createdInputs).toHaveLength(1);
		expect(createdInputs[0].canonicalName).toBe('chicken');
	});

	it('does not overwrite a canonicalName that is already set on the input', async () => {
		const createdInputs: CreateFoodItemInput[] = [];
		const recipeItemWithCanonical: CreateFoodItemInput = {
			name: 'Chicken Breasts',
			canonicalName: 'chicken-breast',
			storageLocation: 'fridge',
			quantity: { value: 1, unit: 'count' },
			expirationDate: null
		};
		const recipeShoppingItem: ShoppingListItem = {
			...baseRecipeShoppingItem,
			canonicalKey: 'chicken',
			displayName: 'Chicken Breasts'
		};

		const shoppingListLayer = makeShoppingListRepo({
			findAll: () => Effect.succeed([recipeShoppingItem]),
			clearAll: () => Effect.void
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([]),
			bulkCreate: (_, inputs) => {
				createdInputs.push(...inputs);
				return Effect.succeed([]);
			}
		});

		await Effect.runPromise(
			completeShoppingTrip('user-a', [recipeItemWithCanonical]).pipe(
				Effect.provide(Layer.merge(shoppingListLayer, foodItemLayer))
			)
		);

		expect(createdInputs[0].canonicalName).toBe('chicken-breast');
	});

	it('clears all shopping list items after processing', async () => {
		let cleared = false;

		const shoppingListLayer = makeShoppingListRepo({
			findAll: () => Effect.succeed([baseRestockShoppingItem]),
			clearAll: () => {
				cleared = true;
				return Effect.void;
			}
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([baseFoodItem]),
			trash: () => Effect.void,
			bulkCreate: () => Effect.succeed([])
		});

		await Effect.runPromise(
			completeShoppingTrip('user-a', []).pipe(
				Effect.provide(Layer.merge(shoppingListLayer, foodItemLayer))
			)
		);

		expect(cleared).toBe(true);
	});

	it('skips unchecked items — does not trash or replace them', async () => {
		const trashedIds: number[] = [];
		const createdInputs: CreateFoodItemInput[] = [];
		const uncheckedItem: ShoppingListItem = { ...baseRestockShoppingItem, checked: false };

		const shoppingListLayer = makeShoppingListRepo({
			findAll: () => Effect.succeed([uncheckedItem]),
			clearAll: () => Effect.void
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([baseFoodItem]),
			trash: (_, id) => {
				trashedIds.push(id);
				return Effect.void;
			},
			bulkCreate: (_, inputs) => {
				createdInputs.push(...inputs);
				return Effect.succeed([]);
			}
		});

		await Effect.runPromise(
			completeShoppingTrip('user-a', []).pipe(
				Effect.provide(Layer.merge(shoppingListLayer, foodItemLayer))
			)
		);

		expect(trashedIds).toHaveLength(0);
		expect(createdInputs).toHaveLength(0);
	});

	it('does not trash an already-trashed food item', async () => {
		const trashedIds: number[] = [];
		const alreadyTrashed: FoodItem = { ...baseFoodItem, trashedAt: new Date() };

		const shoppingListLayer = makeShoppingListRepo({
			findAll: () => Effect.succeed([baseRestockShoppingItem]),
			clearAll: () => Effect.void
		});
		const foodItemLayer = makeFoodItemRepo({
			findAll: () => Effect.succeed([alreadyTrashed]),
			trash: (_, id) => {
				trashedIds.push(id);
				return Effect.void;
			},
			bulkCreate: () => Effect.succeed([])
		});

		await Effect.runPromise(
			completeShoppingTrip('user-a', []).pipe(
				Effect.provide(Layer.merge(shoppingListLayer, foodItemLayer))
			)
		);

		expect(trashedIds).toHaveLength(0);
	});
});

describe('generateShoppingList after completeShoppingTrip (integration)', () => {
	it('does not re-add recipe ingredients that were just purchased', async () => {
		// Simulates scenario: ingredient 'Chicken Breasts' is purchased and added to inventory
		// After purchasing, the food item should be found by matchIngredients using name
		const recipe = makeRecipe({
			id: 1,
			name: 'Roast Chicken',
			ingredients: [
				{ id: 1, recipeId: 1, name: 'Chicken Breasts', canonicalName: null, canonicalIngredientId: null, quantity: { value: 500, unit: 'g' as const } }
			]
		});

		// Shopping list item that was generated (canonical key is 'chicken breasts', display name is 'Chicken Breasts')
		const shoppingItem: ShoppingListItem = {
			id: 5,
			userId: 'user-a',
			canonicalKey: 'chicken breasts',
			displayName: 'Chicken Breasts',
			checked: true,
			sourceType: 'recipe',
			sourceRestockItemId: null,
			sourceRecipeNames: ['Roast Chicken'],
			carriedStorageLocation: 'fridge',
			quantity: { value: 1, unit: 'count' as const },
			createdAt: now
		};

		// Client sends this input with canonicalName: null (the bug)
		const recipeInput: CreateFoodItemInput = {
			name: 'Chicken Breasts',
			canonicalName: null,
			storageLocation: 'fridge',
			quantity: { value: 500, unit: 'g' },
			expirationDate: null
		};

		const createdFoodItems: FoodItem[] = [];

		// Step 1: completeShoppingTrip — should enrich canonicalName to 'chicken'
		const shoppingListRepo1 = makeShoppingListRepo({
			findAll: () => Effect.succeed([shoppingItem]),
			clearAll: () => Effect.void
		});
		const foodItemRepo1 = makeFoodItemRepo({
			findAll: () => Effect.succeed([]),
			bulkCreate: (_, inputs) => {
				const created: FoodItem[] = inputs.map((input, i) => ({
					id: 100 + i,
					userId: 'user-a',
					name: input.name,
					canonicalName: input.canonicalName ?? null,
					storageLocation: input.storageLocation,
					quantity: input.quantity,
					canonicalIngredientId: null,
					expirationDate: input.expirationDate,
					trashedAt: null,
					createdAt: now,
					updatedAt: now
				}));
				createdFoodItems.push(...created);
				return Effect.succeed(created);
			}
		});

		await Effect.runPromise(
			completeShoppingTrip('user-a', [recipeInput]).pipe(
				Effect.provide(Layer.merge(shoppingListRepo1, foodItemRepo1))
			)
		);

		// The created food item must have canonicalName set from the shopping list item's canonicalKey
		expect(createdFoodItems[0].canonicalName).toBe('chicken breasts');

		// Step 2: generateShoppingList — with the created food item in inventory,
		// 'Chicken Breasts' (canonical key 'chicken') should NOT reappear
		let capturedRecipeItems: RecipeShoppingItemInput[] | null = null;

		const shoppingListRepo2 = makeShoppingListRepo({
			addMissingRestock: () => Effect.void,
			mergeRecipeIngredients: (_, items) => {
				capturedRecipeItems = items;
				return Effect.void;
			},
			removeUncheckedStale: () => Effect.void,
			findAll: () => Effect.succeed([])
		});
		const foodItemRepo2 = makeFoodItemRepo({
			// Return the just-created food item (with canonicalName: 'chicken')
			findAll: () => Effect.succeed(createdFoodItems as unknown as FoodItem[])
		});
		const recipeRepo2 = makeRecipeRepo({ findAll: () => Effect.succeed([recipe]) });

		await Effect.runPromise(
			generateShoppingList('user-a', now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListRepo2, foodItemRepo2, recipeRepo2))
			)
		);

		// No recipe items should be added — the ingredient is now in inventory
		expect(capturedRecipeItems).toBeNull();
	});
});
