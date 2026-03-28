import { Context, Effect } from 'effect';
import type { ExtractItemsInput, ExtractedFoodItem } from './types.js';
import type { ExtractionError } from './errors.js';

export interface ReceiptScanner {
	extractItems(input: ExtractItemsInput): Effect.Effect<ExtractedFoodItem[], ExtractionError>;
}

export const ReceiptScanner = Context.GenericTag<ReceiptScanner>('ReceiptScanner');
