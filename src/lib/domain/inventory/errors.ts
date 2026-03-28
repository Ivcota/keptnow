import { Data } from 'effect';

export class FoodItemValidationError extends Data.TaggedError('FoodItemValidationError')<{
	message: string;
}> {}

export class FoodItemRepositoryError extends Data.TaggedError('FoodItemRepositoryError')<{
	message: string;
	cause?: unknown;
}> {}

export class FoodItemNotFoundError extends Data.TaggedError('FoodItemNotFoundError')<{
	id: number;
}> {}

export class FoodItemRestoreExpiredError extends Data.TaggedError('FoodItemRestoreExpiredError')<{
	id: number;
}> {}

export class RestockConfigError extends Data.TaggedError('RestockConfigError')<{
	message: string;
}> {}
