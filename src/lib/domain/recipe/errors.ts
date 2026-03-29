import { Data } from 'effect';

export class RecipeValidationError extends Data.TaggedError('RecipeValidationError')<{
	message: string;
}> {}

export class RecipeRepositoryError extends Data.TaggedError('RecipeRepositoryError')<{
	message: string;
	cause?: unknown;
}> {}
