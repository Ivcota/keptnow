import { Effect } from 'effect';
import { ShoppingListRepository } from './shopping-list-repository.js';
import type {
	ShoppingListItem,
	RestockShoppingItemInput,
	RecipeShoppingItemInput
} from './shopping-list-item.js';
import type { ShoppingListRepositoryError, ShoppingListItemNotFoundError } from './errors.js';
import { FoodItemRepository } from '$lib/domain/inventory/food-item-repository.js';
import type { FoodItemRepositoryError } from '$lib/domain/inventory/errors.js';
import { getRestockItems } from '$lib/domain/inventory/restock.js';
import { DEFAULT_EXPIRATION_CONFIG } from '$lib/domain/inventory/expiration.js';
import { RecipeRepository } from '$lib/domain/recipe/recipe-repository.js';
import type { RecipeNotFoundError, RecipeRepositoryError } from '$lib/domain/recipe/errors.js';
import { matchIngredients } from '$lib/domain/recipe/ingredient-matching.js';
import { subtract, sum, type Quantity } from '$lib/domain/shared/quantity.js';

export const generateShoppingList = (
	householdId: string | null,
	userId: string,
	now: Date = new Date()
): Effect.Effect<
	ShoppingListItem[],
	FoodItemRepositoryError | ShoppingListRepositoryError | RecipeRepositoryError,
	FoodItemRepository | ShoppingListRepository | RecipeRepository
> =>
	Effect.gen(function* () {
		const foodItemRepo = yield* FoodItemRepository;
		const shoppingListRepo = yield* ShoppingListRepository;
		const recipeRepo = yield* RecipeRepository;

		// 1. Compute restock inputs from expiring food items
		const foodItems = yield* foodItemRepo.findAll(householdId, userId);
		const restockItems = yield* getRestockItems(foodItems, DEFAULT_EXPIRATION_CONFIG, now).pipe(
			Effect.orDie
		);
		const restockInputs: RestockShoppingItemInput[] = restockItems.map((ri) => ({
			canonicalKey: (ri.foodItem.canonicalName ?? ri.foodItem.name).toLowerCase().trim(),
			displayName: ri.foodItem.name,
			sourceRestockItemId: ri.foodItem.id,
			carriedStorageLocation: ri.foodItem.storageLocation,
			quantity: ri.foodItem.quantity
		}));

		// 2. Compute recipe inputs from pinned, non-trashed recipes
		const allRecipes = yield* recipeRepo.findAll(householdId, userId);
		const pinnedRecipes = allRecipes.filter((r) => r.pinnedAt !== null && r.trashedAt === null);
		const recipeItemMap = new Map<
			string,
			{ displayName: string; sourceRecipeNames: string[]; quantities: Quantity[] }
		>();

		if (pinnedRecipes.length > 0) {
			const activeFoodItems = foodItems.filter((fi) => fi.trashedAt === null);
			for (const recipe of pinnedRecipes) {
				const matches = matchIngredients(recipe.ingredients, activeFoodItems);
				for (const { ingredient, matched } of matches) {
					if (matched) continue;
					const key = (ingredient.canonicalName ?? ingredient.name).toLowerCase().trim();
					const existing = recipeItemMap.get(key);
					if (existing) {
						existing.sourceRecipeNames.push(recipe.name);
						existing.quantities.push(ingredient.quantity);
					} else {
						recipeItemMap.set(key, {
							displayName: ingredient.canonicalName ?? ingredient.name,
							sourceRecipeNames: [recipe.name],
							quantities: [ingredient.quantity]
						});
					}
				}
			}
		}

		// 3. Sync: remove unchecked items whose source no longer applies
		const activeCanonicalKeys = [
			...restockInputs.map((i) => i.canonicalKey),
			...recipeItemMap.keys()
		];
		yield* shoppingListRepo.removeUncheckedStale(householdId, userId, activeCanonicalKeys);

		// 4. Insert/upsert active items
		if (restockInputs.length > 0) {
			yield* shoppingListRepo.addMissingRestock(householdId, userId, restockInputs);
		}
		if (recipeItemMap.size > 0) {
			// Build a lookup of inventory quantities by canonical key for deficit calculation
			const activeFoodItems = foodItems.filter((fi) => fi.trashedAt === null);
			const inventoryByKey = new Map<string, Quantity[]>();
			for (const fi of activeFoodItems) {
				const key = (fi.canonicalName ?? fi.name).toLowerCase().trim();
				const existing = inventoryByKey.get(key);
				if (existing) {
					existing.push(fi.quantity);
				} else {
					inventoryByKey.set(key, [fi.quantity]);
				}
			}

			const recipeInputs: RecipeShoppingItemInput[] = Array.from(recipeItemMap.entries()).map(
				([key, value]) => {
					// Sum all recipe quantities for this ingredient
					const totalNeeded = value.quantities.length === 1
						? value.quantities[0]
						: sum(value.quantities);

					// Calculate deficit against inventory
					const inventoryItems = inventoryByKey.get(key);
					let quantity: Quantity;
					if (inventoryItems) {
						const sameUnit = inventoryItems.filter((q) => q.unit === totalNeeded.unit);
						if (sameUnit.length > 0) {
							const inventoryTotal = sum(sameUnit);
							const result = subtract(inventoryTotal, totalNeeded);
							quantity = result.status === 'deficit' ? result.quantity : totalNeeded;
						} else {
							// Unit mismatch — use full recipe quantity
							quantity = totalNeeded;
						}
					} else {
						// Not in inventory at all — use full recipe quantity
						quantity = totalNeeded;
					}

					return {
						canonicalKey: key,
						displayName: value.displayName,
						sourceRecipeNames: value.sourceRecipeNames,
						carriedStorageLocation: 'pantry' as const,
						quantity
					};
				}
			);
			yield* shoppingListRepo.mergeRecipeIngredients(householdId, userId, recipeInputs);
		}

		return yield* shoppingListRepo.findAll(householdId, userId);
	});

export const completeShoppingTrip = (
	householdId: string | null,
	userId: string
): Effect.Effect<void, ShoppingListRepositoryError | RecipeRepositoryError, ShoppingListRepository | RecipeRepository> =>
	Effect.gen(function* () {
		const shoppingListRepo = yield* ShoppingListRepository;
		const recipeRepo = yield* RecipeRepository;
		yield* shoppingListRepo.clearAll(householdId, userId);
		yield* recipeRepo.unpinAll(householdId, userId);
	});

export const setShoppingListItemChecked = (
	householdId: string | null,
	userId: string,
	id: number,
	checked: boolean
): Effect.Effect<
	void,
	ShoppingListItemNotFoundError | ShoppingListRepositoryError,
	ShoppingListRepository
> =>
	Effect.gen(function* () {
		const repo = yield* ShoppingListRepository;
		yield* repo.setChecked(householdId, userId, id, checked);
	});
