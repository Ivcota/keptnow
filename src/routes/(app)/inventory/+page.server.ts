import { fail, redirect } from '@sveltejs/kit';
import { Effect } from 'effect';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import { withRequestLogging } from '$lib/server/logging';
import {
	createFoodItem,
	createFoodItems,
	findAllFoodItems,
	updateFoodItem,
	trashFoodItem,
	restoreFoodItem,
	findTrashedFoodItems,
	resolveAndPatchCanonicalName
} from '$lib/domain/inventory/use-cases';
import type {
	StorageLocation,
	CreateFoodItemInput
} from '$lib/domain/inventory/food-item';
import type { QuantityUnit } from '$lib/domain/shared/quantity';
import { getRestockItems } from '$lib/domain/inventory/restock';
import { DEFAULT_EXPIRATION_CONFIG } from '$lib/domain/inventory/expiration';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login?redirectTo=/inventory');
	}

	const userId = locals.user.id;
	const ctx = { userId, requestId: locals.requestId, route: '/inventory' };
	const [items, trashedItems] = await Promise.all([
		appRuntime.runPromise(
			withRequestLogging(findAllFoodItems(userId), { ...ctx, useCase: 'findAllFoodItems' }).pipe(
				Effect.orDie
			)
		),
		appRuntime.runPromise(
			withRequestLogging(findTrashedFoodItems(userId), {
				...ctx,
				useCase: 'findTrashedFoodItems'
			}).pipe(Effect.orDie)
		)
	]);
	const restockItems = await Effect.runPromise(
		getRestockItems(items, DEFAULT_EXPIRATION_CONFIG).pipe(Effect.orDie)
	);
	return { items, trashedItems, restockItems };
};

function parseItemFields(formData: FormData) {
	const name = formData.get('name')?.toString() ?? '';
	const storageLocation = (formData.get('storageLocation')?.toString() ??
		'pantry') as StorageLocation;
	const quantityValueRaw = formData.get('quantityValue')?.toString();
	const quantityUnit = (formData.get('quantityUnit')?.toString() ?? 'count') as QuantityUnit;
	const expirationDateRaw = formData.get('expirationDate')?.toString();

	const quantityValue = quantityValueRaw ? parseFloat(quantityValueRaw) : 1;
	const expirationDate = expirationDateRaw ? new Date(expirationDateRaw) : null;

	return {
		name,
		canonicalName: null,
		storageLocation,
		quantity: { value: quantityValue, unit: quantityUnit },
		expirationDate
	};
}

export const actions: Actions = {
	signOut: async (event) => {
		await auth.api.signOut({
			headers: event.request.headers
		});
		return redirect(302, '/');
	},

	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const ctx = { userId, requestId: locals.requestId, route: '/inventory' };
		const fields = parseItemFields(await request.formData());

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(createFoodItem(userId, fields), { ...ctx, useCase: 'createFoodItem' }),
				{
					onFailure: (e) =>
						e._tag === 'FoodItemValidationError'
							? { ok: false as const, status: 400 as const, message: e.message }
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: (item) => ({ ok: true as const, item })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });

		// Fire-and-forget: resolve canonical name in background
		appRuntime
			.runPromise(
				resolveAndPatchCanonicalName(userId, outcome.item.id, outcome.item.name).pipe(
					Effect.catchAll(() => Effect.void)
				)
			)
			.catch(() => {});
	},

	update: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const ctx = { userId, requestId: locals.requestId, route: '/inventory' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid item ID' });

		const fields = parseItemFields(formData);

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(updateFoodItem(userId, { id, ...fields }), {
					...ctx,
					useCase: 'updateFoodItem'
				}),
				{
					onFailure: (e) => {
						if (e._tag === 'FoodItemValidationError') {
							return { ok: false as const, status: 400 as const, message: e.message };
						}
						if (e._tag === 'FoodItemNotFoundError') {
							return {
								ok: false as const,
								status: 404 as const,
								message: `Item ${e.id} not found`
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
		const ctx = { userId, requestId: locals.requestId, route: '/inventory' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid item ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(trashFoodItem(userId, id), { ...ctx, useCase: 'trashFoodItem' }),
				{
					onFailure: (e) =>
						e._tag === 'FoodItemNotFoundError'
							? { ok: false as const, status: 404 as const, message: `Item ${e.id} not found` }
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
		const ctx = { userId, requestId: locals.requestId, route: '/inventory' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);
		const trashedAtRaw = formData.get('trashedAt')?.toString() ?? '';

		if (isNaN(id)) return fail(400, { message: 'Invalid item ID' });

		const trashedAt = new Date(trashedAtRaw);
		if (isNaN(trashedAt.getTime())) return fail(400, { message: 'Invalid trashedAt timestamp' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(restoreFoodItem(userId, id, trashedAt), {
					...ctx,
					useCase: 'restoreFoodItem'
				}),
				{
					onFailure: (e) => {
						if (e._tag === 'FoodItemNotFoundError') {
							return {
								ok: false as const,
								status: 404 as const,
								message: `Item ${e.id} not found`
							};
						}
						if (e._tag === 'FoodItemRestoreExpiredError') {
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

	bulkCreate: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const ctx = { userId, requestId: locals.requestId, route: '/inventory' };
		const formData = await request.formData();
		const itemsRaw = formData.get('items')?.toString() ?? '[]';

		let rawItems: Array<{
			name: string;
			canonicalName: string | null;
			storageLocation: string;
			quantityValue: number;
			quantityUnit: string;
			expirationDate: string | null;
		}>;
		try {
			rawItems = JSON.parse(itemsRaw);
		} catch {
			return fail(400, { message: 'Invalid items data' });
		}

		if (rawItems.length === 0) {
			return fail(400, { message: 'No items selected' });
		}

		const items: CreateFoodItemInput[] = rawItems.map((item) => ({
			name: item.name,
			canonicalName: item.canonicalName ?? null,
			storageLocation: item.storageLocation as StorageLocation,
			quantity: {
				value: item.quantityValue,
				unit: item.quantityUnit as QuantityUnit
			},
			expirationDate: item.expirationDate ? new Date(item.expirationDate) : null
		}));

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(createFoodItems(userId, items), {
					...ctx,
					useCase: 'createFoodItems'
				}),
				{
					onFailure: (e) =>
						e._tag === 'FoodItemValidationError'
							? { ok: false as const, status: 400 as const, message: e.message }
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: (created) => ({ ok: true as const, count: created.length })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
		return { count: outcome.count };
	}
};
