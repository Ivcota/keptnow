import { Effect, Layer } from 'effect';
import { ReceiptScanner } from './receipt-scanner.js';
import type { ExtractedFoodItem } from './types.js';
import type { ExtractionError } from './errors.js';

export const makeFakeReceiptScanner = (
	result: Effect.Effect<ExtractedFoodItem[], ExtractionError>
) => Layer.succeed(ReceiptScanner, { extractItems: () => result });
