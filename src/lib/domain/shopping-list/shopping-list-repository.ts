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
			householdId: string | null,
			userId: string
		) => Effect.Effect<ShoppingListItem[], ShoppingListRepositoryError>;
		readonly addMissingRestock: (
			householdId: string | null,
			userId: string,
			items: RestockShoppingItemInput[]
		) => Effect.Effect<void, ShoppingListRepositoryError>;
		readonly mergeRecipeIngredients: (
			householdId: string | null,
			userId: string,
			items: RecipeShoppingItemInput[]
		) => Effect.Effect<void, ShoppingListRepositoryError>;
		readonly removeUncheckedStale: (
			householdId: string | null,
			userId: string,
			activeCanonicalKeys: string[]
		) => Effect.Effect<void, ShoppingListRepositoryError>;
		readonly setChecked: (
			householdId: string | null,
			userId: string,
			id: number,
			checked: boolean
		) => Effect.Effect<void, ShoppingListItemNotFoundError | ShoppingListRepositoryError>;
		readonly clearAll: (
			householdId: string | null,
			userId: string
		) => Effect.Effect<void, ShoppingListRepositoryError>;
	}
>() {}
