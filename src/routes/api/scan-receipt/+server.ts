import { json, error } from '@sveltejs/kit';
import { Effect, Layer } from 'effect';
import type { RequestHandler } from './$types';
import { extractItemsFromReceipt } from '$lib/domain/receipt/use-cases.js';
import { AIReceiptScanner } from '$lib/infrastructure/ai-receipt-scanner.js';
import { ReceiptScanner } from '$lib/domain/receipt/receipt-scanner.js';

const scannerLayer = Layer.succeed(ReceiptScanner, AIReceiptScanner);

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const formData = await request.formData();
	const imageFile = formData.get('image');

	if (!(imageFile instanceof File)) {
		error(400, 'Missing image file');
	}

	const arrayBuffer = await imageFile.arrayBuffer();
	const imageBase64 = Buffer.from(arrayBuffer).toString('base64');
	const mimeType = imageFile.type || 'image/jpeg';

	const outcome = await Effect.runPromise(
		Effect.match(
			extractItemsFromReceipt({ imageBase64, mimeType }).pipe(Effect.provide(scannerLayer)),
			{
				onFailure: (e) => {
					if (e._tag === 'UnreadableImageError' || e._tag === 'NoItemsExtractedError') {
						return { ok: false as const, status: 422 as const };
					}
					return { ok: false as const, status: 503 as const };
				},
				onSuccess: (items) => ({ ok: true as const, items })
			}
		)
	);

	if (!outcome.ok) {
		if (outcome.status === 422) {
			error(422, "Couldn't extract any items from this image. Try a clearer photo.");
		}
		error(503, 'Something went wrong. Try again in a moment.');
	}

	return json(outcome.items);
};
