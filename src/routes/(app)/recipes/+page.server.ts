import { fail } from '@sveltejs/kit';
import { Effect } from 'effect';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import {
	findAllRecipes,
	findTrashedRecipes,
	createRecipe,
	updateRecipe,
	trashRecipe,
	restoreRecipe,
	pinRecipe,
	unpinRecipe
} from '$lib/domain/recipe/use-cases';
import { findAllFoodItems } from '$lib/domain/inventory/use-cases';
import type { CreateRecipeIngredientInput } from '$lib/domain/recipe/recipe';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const [recipes, trashedRecipes, foodItems] = await Promise.all([
		appRuntime.runPromise(findAllRecipes(userId).pipe(Effect.orDie)),
		appRuntime.runPromise(findTrashedRecipes(userId).pipe(Effect.orDie)),
		appRuntime.runPromise(findAllFoodItems(userId).pipe(Effect.orDie))
	]);
	return { recipes, trashedRecipes, foodItems };
};

function parseIngredients(formData: FormData): CreateRecipeIngredientInput[] | null {
	const raw = formData.get('ingredients')?.toString() ?? '[]';
	try {
		return JSON.parse(raw) as CreateRecipeIngredientInput[];
	} catch {
		return null;
	}
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const formData = await request.formData();
		const name = formData.get('name')?.toString() ?? '';
		const ingredients = parseIngredients(formData);

		if (!ingredients) return fail(400, { message: 'Invalid ingredients data' });

		const outcome = await appRuntime.runPromise(
			Effect.match(createRecipe(userId, { name, ingredients }), {
				onFailure: (e) =>
					e._tag === 'RecipeValidationError'
						? { ok: false as const, status: 400 as const, message: e.message }
						: { ok: false as const, status: 500 as const, message: 'Database error' },
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	update: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const name = formData.get('name')?.toString() ?? '';
		const ingredients = parseIngredients(formData);

		if (!ingredients) return fail(400, { message: 'Invalid ingredients data' });

		const outcome = await appRuntime.runPromise(
			Effect.match(updateRecipe(userId, { id, name, ingredients }), {
				onFailure: (e) => {
					if (e._tag === 'RecipeValidationError') {
						return { ok: false as const, status: 400 as const, message: e.message };
					}
					if (e._tag === 'RecipeNotFoundError') {
						return {
							ok: false as const,
							status: 404 as const,
							message: `Recipe ${e.id} not found`
						};
					}
					return { ok: false as const, status: 500 as const, message: 'Database error' };
				},
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	trash: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(trashRecipe(userId, id), {
				onFailure: (e) =>
					e._tag === 'RecipeNotFoundError'
						? { ok: false as const, status: 404 as const, message: `Recipe ${e.id} not found` }
						: { ok: false as const, status: 500 as const, message: 'Database error' },
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	restore: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(restoreRecipe(userId, id), {
				onFailure: (e) => {
					if (e._tag === 'RecipeNotFoundError') {
						return {
							ok: false as const,
							status: 404 as const,
							message: `Recipe ${e.id} not found`
						};
					}
					if (e._tag === 'RecipeRestoreExpiredError') {
						return {
							ok: false as const,
							status: 422 as const,
							message: 'Restore window has expired (24 hours)'
						};
					}
					return { ok: false as const, status: 500 as const, message: 'Database error' };
				},
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	pin: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(pinRecipe(userId, id), {
				onFailure: (e) =>
					e._tag === 'RecipeNotFoundError'
						? { ok: false as const, status: 404 as const, message: `Recipe ${e.id} not found` }
						: { ok: false as const, status: 500 as const, message: 'Database error' },
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	unpin: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(unpinRecipe(userId, id), {
				onFailure: (e) =>
					e._tag === 'RecipeNotFoundError'
						? { ok: false as const, status: 404 as const, message: `Recipe ${e.id} not found` }
						: { ok: false as const, status: 500 as const, message: 'Database error' },
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	}
};
