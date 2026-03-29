import { Context, Effect } from 'effect';
import type {
	ShoppingListItem,
	RestockShoppingItemInput,
	RecipeShoppingItemInput
} from './shopping-list-item.js';
import type {
	ShoppingListRepositoryError,
	ShoppingListItemNotFoundError
} from './errors.js';

export interface ShoppingListRepository {
	findAll(userId: string): Effect.Effect<ShoppingListItem[], ShoppingListRepositoryError>;
	addMissingRestock(
		userId: string,
		items: RestockShoppingItemInput[]
	): Effect.Effect<void, ShoppingListRepositoryError>;
	mergeRecipeIngredients(
		userId: string,
		items: RecipeShoppingItemInput[]
	): Effect.Effect<void, ShoppingListRepositoryError>;
	setChecked(
		userId: string,
		id: number,
		checked: boolean
	): Effect.Effect<void, ShoppingListItemNotFoundError | ShoppingListRepositoryError>;
	clearAll(userId: string): Effect.Effect<void, ShoppingListRepositoryError>;
}

export const ShoppingListRepository =
	Context.GenericTag<ShoppingListRepository>('ShoppingListRepository');
