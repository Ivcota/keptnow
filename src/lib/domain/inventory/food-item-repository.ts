import { Context, Effect } from 'effect';
import type { FoodItem, CreateFoodItemInput, UpdateFoodItemInput } from './food-item.js';
import type { FoodItemRepositoryError, FoodItemNotFoundError } from './errors.js';

export class FoodItemRepository extends Context.Tag('FoodItemRepository')<
	FoodItemRepository,
	{
		readonly create: (
			householdId: string | null,
			userId: string,
			input: CreateFoodItemInput
		) => Effect.Effect<FoodItem, FoodItemRepositoryError>;
		readonly bulkCreate: (
			householdId: string | null,
			userId: string,
			items: CreateFoodItemInput[]
		) => Effect.Effect<FoodItem[], FoodItemRepositoryError>;
		readonly findAll: (
			householdId: string | null,
			userId: string
		) => Effect.Effect<FoodItem[], FoodItemRepositoryError>;
		readonly update: (
			householdId: string | null,
			userId: string,
			input: UpdateFoodItemInput
		) => Effect.Effect<FoodItem, FoodItemRepositoryError | FoodItemNotFoundError>;
		readonly trash: (
			householdId: string | null,
			userId: string,
			id: number
		) => Effect.Effect<void, FoodItemRepositoryError | FoodItemNotFoundError>;
		readonly restore: (
			householdId: string | null,
			userId: string,
			id: number
		) => Effect.Effect<void, FoodItemRepositoryError | FoodItemNotFoundError>;
		readonly findTrashed: (
			householdId: string | null,
			userId: string
		) => Effect.Effect<FoodItem[], FoodItemRepositoryError>;
		readonly patchCanonicalName: (
			householdId: string | null,
			userId: string,
			id: number,
			canonicalName: string
		) => Effect.Effect<void, FoodItemRepositoryError>;
		readonly trashAll: (
			householdId: string | null,
			userId: string
		) => Effect.Effect<void, FoodItemRepositoryError>;
	}
>() {}
