import { Data } from 'effect';

export class RecipeValidationError extends Data.TaggedError('RecipeValidationError')<{
	message: string;
}> {}

export class RecipeRepositoryError extends Data.TaggedError('RecipeRepositoryError')<{
	message: string;
	cause?: unknown;
}> {}

export class RecipeNotFoundError extends Data.TaggedError('RecipeNotFoundError')<{
	id: number;
}> {}

export class RecipeRestoreExpiredError extends Data.TaggedError('RecipeRestoreExpiredError')<{
	id: number;
}> {}
