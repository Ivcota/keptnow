import { ManagedRuntime, Layer, Logger } from 'effect';
import { dev } from '$app/environment';
import { DrizzleTaskRepository } from '$lib/infrastructure/drizzle-task-repository.js';
import { DrizzleFoodItemRepository } from '$lib/infrastructure/drizzle-food-item-repository.js';
import { DrizzleRecipeRepository } from '$lib/infrastructure/drizzle-recipe-repository.js';
import { DrizzleShoppingListRepository } from '$lib/infrastructure/drizzle-shopping-list-repository.js';
import { DrizzleAICanonicalIngredientResolver } from '$lib/infrastructure/drizzle-ai-canonical-ingredient-resolver.js';
import { DatabaseLive } from '$lib/infrastructure/database.js';

const AppLive = Layer.mergeAll(
	DrizzleTaskRepository,
	DrizzleFoodItemRepository,
	DrizzleRecipeRepository,
	DrizzleShoppingListRepository,
	DrizzleAICanonicalIngredientResolver
).pipe(
	Layer.provide(DatabaseLive),
	Layer.provide(dev ? Logger.pretty : Logger.json)
);

export const appRuntime = ManagedRuntime.make(AppLive);
