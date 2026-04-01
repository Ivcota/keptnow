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

export class ShoppingListRepository extends Context.Tag('ShoppingListRepository')<
	ShoppingListRepository,
	{
		readonly findAll: (
			userId: string
		) => Effect.Effect<ShoppingListItem[], ShoppingListRepositoryError>;
		readonly addMissingRestock: (
			userId: string,
			items: RestockShoppingItemInput[]
		) => Effect.Effect<void, ShoppingListRepositoryError>;
		readonly mergeRecipeIngredients: (
			userId: string,
			items: RecipeShoppingItemInput[]
		) => Effect.Effect<void, ShoppingListRepositoryError>;
		readonly removeUncheckedStale: (
			userId: string,
			activeCanonicalKeys: string[]
		) => Effect.Effect<void, ShoppingListRepositoryError>;
		readonly setChecked: (
			userId: string,
			id: number,
			checked: boolean
		) => Effect.Effect<void, ShoppingListItemNotFoundError | ShoppingListRepositoryError>;
		readonly clearAll: (userId: string) => Effect.Effect<void, ShoppingListRepositoryError>;
	}
>() {}
