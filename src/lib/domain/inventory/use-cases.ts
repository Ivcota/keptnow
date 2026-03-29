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

export const RESTORE_WINDOW_HOURS = 24;

export const createFoodItems = (
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
		return yield* repo.bulkCreate(userId, inputs);
	});

export const createFoodItem = (
	userId: string,
	input: CreateFoodItemInput
): Effect.Effect<FoodItem, FoodItemValidationError | FoodItemRepositoryError, FoodItemRepository> =>
	Effect.gen(function* () {
		yield* validateFoodItemFields(input);
		const repo = yield* FoodItemRepository;
		return yield* repo.create(userId, input);
	});

export const findAllFoodItems = (
	userId: string
): Effect.Effect<FoodItem[], FoodItemRepositoryError, FoodItemRepository> =>
	Effect.gen(function* () {
		const repo = yield* FoodItemRepository;
		return yield* repo.findAll(userId);
	});

function validateFoodItemFields(input: {
	name: string;
	trackingType: string;
	amount: number | null;
	quantity: number | null;
}): Effect.Effect<void, FoodItemValidationError> {
	return Effect.gen(function* () {
		if (!input.name.trim()) {
			yield* Effect.fail(new FoodItemValidationError({ message: 'Name must not be empty' }));
		}
		if (input.trackingType === 'amount') {
			if (input.amount === null) {
				yield* Effect.fail(
					new FoodItemValidationError({
						message: 'Amount is required when tracking type is amount'
					})
				);
			} else if (input.amount < 0 || input.amount > 100) {
				yield* Effect.fail(
					new FoodItemValidationError({ message: 'Amount must be between 0 and 100' })
				);
			}
		}
		if (input.trackingType === 'count') {
			if (input.quantity === null) {
				yield* Effect.fail(
					new FoodItemValidationError({
						message: 'Quantity is required when tracking type is count'
					})
				);
			} else if (input.quantity < 1) {
				yield* Effect.fail(new FoodItemValidationError({ message: 'Quantity must be at least 1' }));
			}
		}
	});
}

export const updateFoodItem = (
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
		return yield* repo.update(userId, input);
	});

export const trashFoodItem = (
	userId: string,
	id: number
): Effect.Effect<void, FoodItemRepositoryError | FoodItemNotFoundError, FoodItemRepository> =>
	Effect.gen(function* () {
		const repo = yield* FoodItemRepository;
		yield* repo.trash(userId, id);
	});

export const restoreFoodItem = (
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
		yield* repo.restore(userId, id);
	});

export const findTrashedFoodItems = (
	userId: string
): Effect.Effect<FoodItem[], FoodItemRepositoryError, FoodItemRepository> =>
	Effect.gen(function* () {
		const repo = yield* FoodItemRepository;
		return yield* repo.findTrashed(userId);
	});

export const resolveAndPatchCanonicalName = (
	userId: string,
	id: number,
	name: string
): Effect.Effect<void, Error | FoodItemRepositoryError, CanonicalIngredientResolver | FoodItemRepository> =>
	Effect.gen(function* () {
		const resolver = yield* CanonicalIngredientResolver;
		const ingredient = yield* resolver.resolve(name);
		const repo = yield* FoodItemRepository;
		yield* repo.patchCanonicalName(userId, id, ingredient.name);
	});
