import { Effect } from 'effect';
import { FoodItemRepository } from './food-item-repository.js';
import { CanonicalIngredientResolver } from '$lib/domain/shared/canonical-ingredient-resolver.js';
import {
	FoodItemValidationError,
	FoodItemRepositoryError,
	FoodItemNotFoundError,
	FoodItemRestoreExpiredError
} from './errors.js';
import type { FoodItem, CreateFoodItemInput, UpdateFoodItemInput } from './food-item.js';
import type { Quantity } from '$lib/domain/shared/quantity.js';

export const RESTORE_WINDOW_HOURS = 24;

export const createFoodItems = (
	householdId: string | null,
	userId: string,
	inputs: CreateFoodItemInput[]
): Effect.Effect<
	FoodItem[],
	FoodItemValidationError | FoodItemRepositoryError,
	FoodItemRepository
> =>
	Effect.gen(function* () {
		for (const input of inputs) {
			yield* validateFoodItemFields(input);
		}
		const repo = yield* FoodItemRepository;
		return yield* repo.bulkCreate(householdId, userId, inputs);
	});

export const createFoodItem = (
	householdId: string | null,
	userId: string,
	input: CreateFoodItemInput
): Effect.Effect<FoodItem, FoodItemValidationError | FoodItemRepositoryError, FoodItemRepository> =>
	Effect.gen(function* () {
		yield* validateFoodItemFields(input);
		const repo = yield* FoodItemRepository;
		return yield* repo.create(householdId, userId, input);
	});

export const findAllFoodItems = (
	householdId: string | null,
	userId: string
): Effect.Effect<FoodItem[], FoodItemRepositoryError, FoodItemRepository> =>
	Effect.gen(function* () {
		const repo = yield* FoodItemRepository;
		return yield* repo.findAll(householdId, userId);
	});

function validateFoodItemFields(input: {
	name: string;
	quantity: Quantity;
}): Effect.Effect<void, FoodItemValidationError> {
	return Effect.gen(function* () {
		if (!input.name.trim()) {
			yield* Effect.fail(new FoodItemValidationError({ message: 'Name must not be empty' }));
		}
		if (input.quantity.value <= 0) {
			yield* Effect.fail(
				new FoodItemValidationError({ message: 'Quantity value must be greater than 0' })
			);
		}
	});
}

export const updateFoodItem = (
	householdId: string | null,
	userId: string,
	input: UpdateFoodItemInput
): Effect.Effect<
	FoodItem,
	FoodItemValidationError | FoodItemRepositoryError | FoodItemNotFoundError,
	FoodItemRepository
> =>
	Effect.gen(function* () {
		yield* validateFoodItemFields(input);
		const repo = yield* FoodItemRepository;
		return yield* repo.update(householdId, userId, input);
	});

export const trashFoodItem = (
	householdId: string | null,
	userId: string,
	id: number
): Effect.Effect<void, FoodItemRepositoryError | FoodItemNotFoundError, FoodItemRepository> =>
	Effect.gen(function* () {
		const repo = yield* FoodItemRepository;
		yield* repo.trash(householdId, userId, id);
	});

export const restoreFoodItem = (
	householdId: string | null,
	userId: string,
	id: number,
	trashedAt: Date,
	now: Date = new Date()
): Effect.Effect<
	void,
	FoodItemRepositoryError | FoodItemNotFoundError | FoodItemRestoreExpiredError,
	FoodItemRepository
> =>
	Effect.gen(function* () {
		const msElapsed = now.getTime() - trashedAt.getTime();
		const hoursElapsed = msElapsed / (1000 * 60 * 60);
		if (hoursElapsed > RESTORE_WINDOW_HOURS) {
			yield* Effect.fail(new FoodItemRestoreExpiredError({ id }));
		}
		const repo = yield* FoodItemRepository;
		yield* repo.restore(householdId, userId, id);
	});

export const findTrashedFoodItems = (
	householdId: string | null,
	userId: string
): Effect.Effect<FoodItem[], FoodItemRepositoryError, FoodItemRepository> =>
	Effect.gen(function* () {
		const repo = yield* FoodItemRepository;
		return yield* repo.findTrashed(householdId, userId);
	});

export const trashAllFoodItems = (
	householdId: string | null,
	userId: string
): Effect.Effect<void, FoodItemRepositoryError, FoodItemRepository> =>
	Effect.gen(function* () {
		const repo = yield* FoodItemRepository;
		yield* repo.trashAll(householdId, userId);
	});

export const resolveAndPatchCanonicalName = (
	householdId: string | null,
	userId: string,
	id: number,
	name: string
): Effect.Effect<void, Error | FoodItemRepositoryError, CanonicalIngredientResolver | FoodItemRepository> =>
	Effect.gen(function* () {
		const resolver = yield* CanonicalIngredientResolver;
		const ingredient = yield* resolver.resolve(name);
		const repo = yield* FoodItemRepository;
		yield* repo.patchCanonicalName(householdId, userId, id, ingredient.name);
	});
