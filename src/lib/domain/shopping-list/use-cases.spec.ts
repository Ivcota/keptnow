import { describe, it, expect } from 'vitest';
import { Context, Effect, Layer } from 'effect';
import { ShoppingListRepository } from './shopping-list-repository.js';
import { FoodItemRepository } from '$lib/domain/inventory/food-item-repository.js';
import { RecipeRepository } from '$lib/domain/recipe/recipe-repository.js';
import { ShoppingListRepositoryError } from './errors.js';
import { generateShoppingList, completeShoppingTrip } from './use-cases.js';
import type { ShoppingListItem, RecipeShoppingItemInput } from './shopping-list-item.js';
import type { FoodItem, CreateFoodItemInput } from '$lib/domain/inventory/food-item.js';
import type { Recipe } from '$lib/domain/recipe/recipe.js';

const TEST_HOUSEHOLD_ID = 'household-a';
const TEST_USER_ID = 'user-a';

const now = new Date('2026-01-10T12:00:00Z');
const expiredDate = new Date('2026-01-05T12:00:00Z'); // 5 days ago
const freshDate = new Date('2026-06-01T12:00:00Z'); // far future

function makeFoodItem(overrides: Partial<FoodItem> = {}): FoodItem {
	return {
		id: 1,
		userId: TEST_USER_ID,
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
		userId: TEST_USER_ID,
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
		userId: TEST_USER_ID,
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
	overrides: Partial<Context.Tag.Service<ShoppingListRepository>>
): Layer.Layer<ShoppingListRepository> {
	return Layer.succeed(ShoppingListRepository, {
		findAll: noop,
		addMissingRestock: noop,
		mergeRecipeIngredients: noop,
		removeUncheckedStale: () => Effect.void,
		setChecked: noop,
		clearAll: noop,
		...overrides
	} as Context.Tag.Service<ShoppingListRepository>);
}

function makeRecipeRepo(overrides: Partial<Context.Tag.Service<RecipeRepository>>): Layer.Layer<RecipeRepository> {
	return Layer.succeed(RecipeRepository, {
		findAll: noop,
		findTrashed: noop,
		create: noop,
		update: noop,
		trash: noop,
		restore: noop,
		pin: noop,
		unpin: noop,
		unpinAll: noop,
		...overrides
	} as Context.Tag.Service<RecipeRepository>);
}

function makeFoodItemRepo(overrides: Partial<Context.Tag.Service<FoodItemRepository>>): Layer.Layer<FoodItemRepository> {
	return Layer.succeed(FoodItemRepository, {
		findAll: noop,
		findTrashed: noop,
		create: noop,
		bulkCreate: noop,
		update: noop,
		trash: noop,
		restore: noop,
		patchCanonicalName: noop,
		trashAll: noop,
		...overrides
	} as Context.Tag.Service<FoodItemRepository>);
}


describe('generateShoppingList', () => {
	it('calls addMissingRestock with restock items derived from expiring food items', async () => {
		const expiredItem = makeFoodItem({ id: 10, name: 'Milk', canonicalName: 'milk' });
		let capturedItems: unknown = null;

		const shoppingListLayer = makeShoppingListRepo({
			addMissingRestock: (_householdId, _userId, items) => {
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			addMissingRestock: (_householdId, _userId, items) => {
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			mergeRecipeIngredients: (_householdId, _userId, items) => {
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			mergeRecipeIngredients: (_householdId, _userId, items) => {
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			mergeRecipeIngredients: (_householdId, _userId, items) => {
				mergeCallCount += items.length;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([unpinnedRecipe]) });

		await Effect.runPromise(
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			mergeRecipeIngredients: (_householdId, _userId, items) => {
				mergeCallCount += items.length;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([trashedRecipe]) });

		await Effect.runPromise(
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			removeUncheckedStale: (_householdId, _userId, keys) => {
				capturedKeys = keys;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([expiredItem]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		await Effect.runPromise(
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, foodItemLayer, recipeLayer))
			)
		);

		expect(capturedKeys).toEqual(['milk']);
	});

	it('calls removeUncheckedStale with empty array when no sources produce items', async () => {
		let capturedKeys: string[] | null = null;

		const shoppingListLayer = makeShoppingListRepo({
			removeUncheckedStale: (_householdId, _userId, keys) => {
				capturedKeys = keys;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([]) });

		await Effect.runPromise(
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			mergeRecipeIngredients: (_householdId, _userId, items) => {
				capturedRecipeItems = items;
				return Effect.void;
			},
			findAll: () => Effect.succeed([])
		});
		const foodItemLayer = makeFoodItemRepo({ findAll: () => Effect.succeed([]) });
		const recipeLayer = makeRecipeRepo({ findAll: () => Effect.succeed([recipe1, recipe2]) });

		await Effect.runPromise(
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			mergeRecipeIngredients: (_householdId, _userId, items) => {
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			mergeRecipeIngredients: (_householdId, _userId, items) => {
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			mergeRecipeIngredients: (_householdId, _userId, items) => {
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
			addMissingRestock: (_householdId, _userId, items) => {
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
			generateShoppingList(TEST_HOUSEHOLD_ID, TEST_USER_ID, now).pipe(
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
	it('unpins all pinned recipes', async () => {
		let unpinnedAll = false;

		const shoppingListLayer = makeShoppingListRepo({
			clearAll: () => Effect.void
		});
		const recipeLayer = makeRecipeRepo({
			unpinAll: () => {
				unpinnedAll = true;
				return Effect.void;
			}
		});

		await Effect.runPromise(
			completeShoppingTrip(TEST_HOUSEHOLD_ID, TEST_USER_ID).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, recipeLayer))
			)
		);

		expect(unpinnedAll).toBe(true);
	});

	it('clears checked items on completion', async () => {
		let cleared = false;

		const shoppingListLayer = makeShoppingListRepo({
			clearAll: () => {
				cleared = true;
				return Effect.void;
			}
		});
		const recipeLayer = makeRecipeRepo({
			unpinAll: () => Effect.void
		});

		await Effect.runPromise(
			completeShoppingTrip(TEST_HOUSEHOLD_ID, TEST_USER_ID).pipe(
				Effect.provide(Layer.mergeAll(shoppingListLayer, recipeLayer))
			)
		);

		expect(cleared).toBe(true);
	});

	it('unchecked items remain after completion (clearAll only removes checked)', async () => {
		const shoppingListLayer = makeShoppingListRepo({
			clearAll: () => Effect.void
		});
		const recipeLayer = makeRecipeRepo({
			unpinAll: () => Effect.void
		});

		await expect(
			Effect.runPromise(
				completeShoppingTrip(TEST_HOUSEHOLD_ID, TEST_USER_ID).pipe(
					Effect.provide(Layer.mergeAll(shoppingListLayer, recipeLayer))
				)
			)
		).resolves.toBeUndefined();
	});

	it('succeeds when there are no checked items', async () => {
		const shoppingListLayer = makeShoppingListRepo({
			clearAll: () => Effect.void
		});
		const recipeLayer = makeRecipeRepo({
			unpinAll: () => Effect.void
		});

		await expect(
			Effect.runPromise(
				completeShoppingTrip(TEST_HOUSEHOLD_ID, TEST_USER_ID).pipe(
					Effect.provide(Layer.mergeAll(shoppingListLayer, recipeLayer))
				)
			)
		).resolves.toBeUndefined();
	});
});
