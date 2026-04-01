import { Context, Effect } from 'effect';
import type { FoodItem, CreateFoodItemInput, UpdateFoodItemInput } from './food-item.js';
import type { FoodItemRepositoryError, FoodItemNotFoundError } from './errors.js';

export class FoodItemRepository extends Context.Tag('FoodItemRepository')<
	FoodItemRepository,
	{
		readonly create: (
			userId: string,
			input: CreateFoodItemInput
		) => Effect.Effect<FoodItem, FoodItemRepositoryError>;
		readonly bulkCreate: (
			userId: string,
			items: CreateFoodItemInput[]
		) => Effect.Effect<FoodItem[], FoodItemRepositoryError>;
		readonly findAll: (userId: string) => Effect.Effect<FoodItem[], FoodItemRepositoryError>;
		readonly update: (
			userId: string,
			input: UpdateFoodItemInput
		) => Effect.Effect<FoodItem, FoodItemRepositoryError | FoodItemNotFoundError>;
		readonly trash: (
			userId: string,
			id: number
		) => Effect.Effect<void, FoodItemRepositoryError | FoodItemNotFoundError>;
		readonly restore: (
			userId: string,
			id: number
		) => Effect.Effect<void, FoodItemRepositoryError | FoodItemNotFoundError>;
		readonly findTrashed: (
			userId: string
		) => Effect.Effect<FoodItem[], FoodItemRepositoryError>;
		readonly patchCanonicalName: (
			userId: string,
			id: number,
			canonicalName: string
		) => Effect.Effect<void, FoodItemRepositoryError>;
		readonly trashAll: (userId: string) => Effect.Effect<void, FoodItemRepositoryError>;
	}
>() {}
