import { fail } from '@sveltejs/kit';
import { Effect } from 'effect';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import { withRequestLogging } from '$lib/server/logging';
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
import type { CreateIngredientInput, CreateNoteInput } from '$lib/domain/recipe/recipe';
import { normalizeUnit, UnknownUnitError } from '$lib/infrastructure/unit-normalizer';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const ctx = { userId, requestId: locals.requestId, route: '/recipes' };
	const [recipes, trashedRecipes, foodItems] = await Promise.all([
		appRuntime.runPromise(
			withRequestLogging(findAllRecipes(userId), { ...ctx, useCase: 'findAllRecipes' }).pipe(
				Effect.orDie
			)
		),
		appRuntime.runPromise(
			withRequestLogging(findTrashedRecipes(userId), {
				...ctx,
				useCase: 'findTrashedRecipes'
			}).pipe(Effect.orDie)
		),
		appRuntime.runPromise(
			withRequestLogging(findAllFoodItems(userId), {
				...ctx,
				useCase: 'findAllFoodItems'
			}).pipe(Effect.orDie)
		)
	]);
	return { recipes, trashedRecipes, foodItems };
};

function parseIngredients(formData: FormData): CreateIngredientInput[] | null {
	const raw = formData.get('ingredients')?.toString() ?? '[]';
	try {
		const items = JSON.parse(raw) as Array<{
			name: string;
			canonicalIngredientId?: number | null;
			quantity: { value: number; unit: string };
		}>;
		return items.map((item) => ({
			name: item.name,
			canonicalIngredientId: item.canonicalIngredientId,
			quantity: normalizeUnit(item.quantity.value, item.quantity.unit)
		}));
	} catch (e) {
		if (e instanceof UnknownUnitError) return null;
		return null;
	}
}

function parseNotes(formData: FormData): CreateNoteInput[] | null {
	const raw = formData.get('notes')?.toString() ?? '[]';
	try {
		return JSON.parse(raw) as CreateNoteInput[];
	} catch {
		return null;
	}
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const ctx = { userId, requestId: locals.requestId, route: '/recipes' };
		const formData = await request.formData();
		const name = formData.get('name')?.toString() ?? '';
		const ingredients = parseIngredients(formData);
		const notes = parseNotes(formData);

		if (!ingredients) return fail(400, { message: 'Invalid ingredients data' });
		if (!notes) return fail(400, { message: 'Invalid notes data' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(createRecipe(userId, { name, ingredients, notes }), {
					...ctx,
					useCase: 'createRecipe'
				}),
				{
					onFailure: (e) =>
						e._tag === 'RecipeValidationError'
							? { ok: false as const, status: 400 as const, message: e.message }
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: () => ({ ok: true as const })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	update: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const ctx = { userId, requestId: locals.requestId, route: '/recipes' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const name = formData.get('name')?.toString() ?? '';
		const ingredients = parseIngredients(formData);
		const notes = parseNotes(formData);

		if (!ingredients) return fail(400, { message: 'Invalid ingredients data' });
		if (!notes) return fail(400, { message: 'Invalid notes data' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(updateRecipe(userId, { id, name, ingredients, notes }), {
					...ctx,
					useCase: 'updateRecipe'
				}),
				{
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
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	trash: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const ctx = { userId, requestId: locals.requestId, route: '/recipes' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(trashRecipe(userId, id), { ...ctx, useCase: 'trashRecipe' }),
				{
					onFailure: (e) =>
						e._tag === 'RecipeNotFoundError'
							? {
									ok: false as const,
									status: 404 as const,
									message: `Recipe ${e.id} not found`
								}
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: () => ({ ok: true as const })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	restore: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const ctx = { userId, requestId: locals.requestId, route: '/recipes' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(restoreRecipe(userId, id), { ...ctx, useCase: 'restoreRecipe' }),
				{
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
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	pin: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const ctx = { userId, requestId: locals.requestId, route: '/recipes' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(pinRecipe(userId, id), { ...ctx, useCase: 'pinRecipe' }),
				{
					onFailure: (e) =>
						e._tag === 'RecipeNotFoundError'
							? {
									ok: false as const,
									status: 404 as const,
									message: `Recipe ${e.id} not found`
								}
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: () => ({ ok: true as const })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	unpin: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const ctx = { userId, requestId: locals.requestId, route: '/recipes' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid recipe ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(unpinRecipe(userId, id), { ...ctx, useCase: 'unpinRecipe' }),
				{
					onFailure: (e) =>
						e._tag === 'RecipeNotFoundError'
							? {
									ok: false as const,
									status: 404 as const,
									message: `Recipe ${e.id} not found`
								}
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: () => ({ ok: true as const })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	}
};
