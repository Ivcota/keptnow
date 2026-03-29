import { json, error } from '@sveltejs/kit';
import { Effect, Layer } from 'effect';
import type { RequestHandler } from './$types';
import { RecipeScanner } from '$lib/domain/recipe/recipe-scanner.js';
import { AIRecipeScanner } from '$lib/infrastructure/ai-recipe-scanner.js';

const scannerLayer = Layer.succeed(RecipeScanner, AIRecipeScanner);

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
			Effect.gen(function* () {
				const sc = yield* RecipeScanner;
				return yield* sc.extractRecipe({ imageBase64, mimeType });
			}).pipe(Effect.provide(scannerLayer)),
			{
				onFailure: (e) => {
					if (e._tag === 'UnreadableImageError' || e._tag === 'NoItemsExtractedError') {
						return { ok: false as const, status: 422 as const };
					}
					console.error(e.cause);
					return { ok: false as const, status: 503 as const };
				},
				onSuccess: (recipe) => ({ ok: true as const, recipe })
			}
		)
	);

	if (!outcome.ok) {
		if (outcome.status === 422) {
			error(422, "Couldn't extract a recipe from this image. Try a clearer photo.");
		}
		error(503, 'Something went wrong. Try again in a moment.');
	}

	return json(outcome.recipe);
};
