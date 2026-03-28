import { Data } from 'effect';

export class TaskValidationError extends Data.TaggedError('TaskValidationError')<{
	message: string;
}> {}

export class TaskRepositoryError extends Data.TaggedError('TaskRepositoryError')<{
	message: string;
	cause?: unknown;
}> {}
