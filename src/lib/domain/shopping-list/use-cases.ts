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

		const foodItems = yield* foodItemRepo.findAll(userId);
		const restockItems = yield* getRestockItems(foodItems, DEFAULT_EXPIRATION_CONFIG, now).pipe(
			Effect.orDie
		);

		if (restockItems.length > 0) {
			const inputs: RestockShoppingItemInput[] = restockItems.map((ri) => ({
				canonicalKey: (ri.foodItem.canonicalName ?? ri.foodItem.name).toLowerCase().trim(),
				displayName: ri.foodItem.name,
				sourceRestockItemId: ri.foodItem.id,
				carriedStorageLocation: ri.foodItem.storageLocation,
				carriedTrackingType: ri.foodItem.trackingType
			}));
			yield* shoppingListRepo.addMissingRestock(userId, inputs);
		}

		const allRecipes = yield* recipeRepo.findAll(userId);
		const pinnedRecipes = allRecipes.filter((r) => r.pinnedAt !== null && r.trashedAt === null);

		if (pinnedRecipes.length > 0) {
			const activeFoodItems = foodItems.filter((fi) => fi.trashedAt === null);
			const recipeItemMap = new Map<
				string,
				{ displayName: string; sourceRecipeNames: string[] }
			>();

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
		}

		return yield* shoppingListRepo.findAll(userId);
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
