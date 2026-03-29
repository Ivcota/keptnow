import { Effect } from 'effect';
import { ShoppingListRepository } from './shopping-list-repository.js';
import type {
	ShoppingListItem,
	RestockShoppingItemInput,
	RecipeShoppingItemInput
} from './shopping-list-item.js';
import type { ShoppingListRepositoryError, ShoppingListItemNotFoundError } from './errors.js';
import { FoodItemRepository } from '$lib/domain/inventory/food-item-repository.js';
import { FoodItemNotFoundError } from '$lib/domain/inventory/errors.js';
import type { FoodItemRepositoryError } from '$lib/domain/inventory/errors.js';
import type { CreateFoodItemInput } from '$lib/domain/inventory/food-item.js';
import { getRestockItems } from '$lib/domain/inventory/restock.js';
import { DEFAULT_EXPIRATION_CONFIG } from '$lib/domain/inventory/expiration.js';
import { RecipeRepository } from '$lib/domain/recipe/recipe-repository.js';
import type { RecipeRepositoryError } from '$lib/domain/recipe/errors.js';
import { matchIngredients } from '$lib/domain/recipe/ingredient-matching.js';

export const generateShoppingList = (
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
		const foodItems = yield* foodItemRepo.findAll(userId);
		const restockItems = yield* getRestockItems(foodItems, DEFAULT_EXPIRATION_CONFIG, now).pipe(
			Effect.orDie
		);
		const restockInputs: RestockShoppingItemInput[] = restockItems.map((ri) => ({
			canonicalKey: (ri.foodItem.canonicalName ?? ri.foodItem.name).toLowerCase().trim(),
			displayName: ri.foodItem.name,
			sourceRestockItemId: ri.foodItem.id,
			carriedStorageLocation: ri.foodItem.storageLocation,
			carriedTrackingType: ri.foodItem.trackingType
		}));

		// 2. Compute recipe inputs from pinned, non-trashed recipes
		const allRecipes = yield* recipeRepo.findAll(userId);
		const pinnedRecipes = allRecipes.filter((r) => r.pinnedAt !== null && r.trashedAt === null);
		const recipeItemMap = new Map<
			string,
			{ displayName: string; sourceRecipeNames: string[] }
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
					} else {
						recipeItemMap.set(key, {
							displayName: ingredient.name,
							sourceRecipeNames: [recipe.name]
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
		yield* shoppingListRepo.removeUncheckedStale(userId, activeCanonicalKeys);

		// 4. Insert/upsert active items
		if (restockInputs.length > 0) {
			yield* shoppingListRepo.addMissingRestock(userId, restockInputs);
		}
		if (recipeItemMap.size > 0) {
			const recipeInputs: RecipeShoppingItemInput[] = Array.from(recipeItemMap.entries()).map(
				([key, value]) => ({
					canonicalKey: key,
					displayName: value.displayName,
					sourceRecipeNames: value.sourceRecipeNames,
					carriedStorageLocation: 'pantry',
					carriedTrackingType: 'count'
				})
			);
			yield* shoppingListRepo.mergeRecipeIngredients(userId, recipeInputs);
		}

		return yield* shoppingListRepo.findAll(userId);
	});

export const completeShoppingTrip = (
	userId: string,
	recipeItemInputs: CreateFoodItemInput[]
): Effect.Effect<
	void,
	FoodItemRepositoryError | ShoppingListRepositoryError,
	FoodItemRepository | ShoppingListRepository
> =>
	Effect.gen(function* () {
		const shoppingListRepo = yield* ShoppingListRepository;
		const foodItemRepo = yield* FoodItemRepository;

		const allItems = yield* shoppingListRepo.findAll(userId);
		const checkedRestockItems = allItems.filter(
			(i) => i.checked && i.sourceType === 'restock' && i.sourceRestockItemId !== null
		);

		const allFoodItems = yield* foodItemRepo.findAll(userId);
		const foodItemById = new Map(allFoodItems.map((fi) => [fi.id, fi]));

		const restockReplacements: CreateFoodItemInput[] = [];
		for (const item of checkedRestockItems) {
			const originalId = item.sourceRestockItemId!;
			const original = foodItemById.get(originalId);
			if (original && original.trashedAt === null) {
				yield* foodItemRepo.trash(userId, originalId).pipe(
					Effect.catchTag('FoodItemNotFoundError', () => Effect.void)
				);
			}
			restockReplacements.push({
				name: item.displayName,
				canonicalName: original?.canonicalName ?? null,
				storageLocation: item.carriedStorageLocation,
				trackingType: item.carriedTrackingType,
				amount: item.carriedTrackingType === 'amount' ? 100 : null,
				quantity: item.carriedTrackingType === 'count' ? 1 : null,
				expirationDate: null
			});
		}

		const allInputs = [...restockReplacements, ...recipeItemInputs];
		if (allInputs.length > 0) {
			yield* foodItemRepo.bulkCreate(userId, allInputs);
		}

		yield* shoppingListRepo.clearAll(userId);
	});

export const setShoppingListItemChecked = (
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
		yield* repo.setChecked(userId, id, checked);
	});
