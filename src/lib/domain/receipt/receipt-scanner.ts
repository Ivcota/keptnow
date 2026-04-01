import { Context, Effect } from 'effect';
import type { ExtractItemsInput, ExtractedFoodItem } from './types.js';
import type { ExtractionError } from './errors.js';

export class ReceiptScanner extends Context.Tag('ReceiptScanner')<
	ReceiptScanner,
	{
		readonly extractItems: (
			input: ExtractItemsInput
		) => Effect.Effect<ExtractedFoodItem[], ExtractionError>;
	}
>() {}
