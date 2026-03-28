import { Data } from 'effect';

export class UnreadableImageError extends Data.TaggedError('UnreadableImageError')<{}> {}

export class NoItemsExtractedError extends Data.TaggedError('NoItemsExtractedError')<{}> {}

export class AIProviderError extends Data.TaggedError('AIProviderError')<{
	cause?: unknown;
}> {}

export type ExtractionError = UnreadableImageError | NoItemsExtractedError | AIProviderError;
