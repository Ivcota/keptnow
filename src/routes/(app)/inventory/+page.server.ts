import { fail, redirect } from '@sveltejs/kit';
import { Effect } from 'effect';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import {
	createFoodItem,
	findAllFoodItems,
	updateFoodItem,
	trashFoodItem,
	restoreFoodItem,
	findTrashedFoodItems
} from '$lib/domain/inventory/use-cases';
import type { StorageLocation, TrackingType } from '$lib/domain/inventory/food-item';
import { getRestockItems } from '$lib/domain/inventory/restock';
import { DEFAULT_EXPIRATION_CONFIG } from '$lib/domain/inventory/expiration';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/demo/better-auth/login');
	}

	const userId = locals.user.id;
	const [items, trashedItems] = await Promise.all([
		appRuntime.runPromise(findAllFoodItems(userId).pipe(Effect.orDie)),
		appRuntime.runPromise(findTrashedFoodItems(userId).pipe(Effect.orDie))
	]);
	const restockItems = await Effect.runPromise(
		getRestockItems(items, DEFAULT_EXPIRATION_CONFIG).pipe(Effect.orDie)
	);
	return { items, trashedItems, restockItems };
};

function parseItemFields(formData: FormData) {
	const name = formData.get('name')?.toString() ?? '';
	const storageLocation = (formData.get('storageLocation')?.toString() ?? 'pantry') as StorageLocation;
	const trackingType = (formData.get('trackingType')?.toString() ?? 'count') as TrackingType;
	const amountRaw = formData.get('amount')?.toString();
	const quantityRaw = formData.get('quantity')?.toString();
	const expirationDateRaw = formData.get('expirationDate')?.toString();

	const amount = trackingType === 'amount' && amountRaw ? parseFloat(amountRaw) : null;
	const quantity = trackingType === 'count' && quantityRaw ? parseInt(quantityRaw, 10) : null;
	const expirationDate = expirationDateRaw ? new Date(expirationDateRaw) : null;

	return { name, storageLocation, trackingType, amount, quantity, expirationDate };
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const fields = parseItemFields(await request.formData());

		const outcome = await appRuntime.runPromise(
			Effect.match(createFoodItem(userId, fields), {
				onFailure: (e) =>
					e._tag === 'FoodItemValidationError'
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

		if (isNaN(id)) return fail(400, { message: 'Invalid item ID' });

		const fields = parseItemFields(formData);

		const outcome = await appRuntime.runPromise(
			Effect.match(updateFoodItem(userId, { id, ...fields }), {
				onFailure: (e) => {
					if (e._tag === 'FoodItemValidationError') {
						return { ok: false as const, status: 400 as const, message: e.message };
					}
					if (e._tag === 'FoodItemNotFoundError') {
						return { ok: false as const, status: 404 as const, message: `Item ${e.id} not found` };
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

		if (isNaN(id)) return fail(400, { message: 'Invalid item ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(trashFoodItem(userId, id), {
				onFailure: (e) =>
					e._tag === 'FoodItemNotFoundError'
						? { ok: false as const, status: 404 as const, message: `Item ${e.id} not found` }
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
		const trashedAtRaw = formData.get('trashedAt')?.toString() ?? '';

		if (isNaN(id)) return fail(400, { message: 'Invalid item ID' });

		const trashedAt = new Date(trashedAtRaw);
		if (isNaN(trashedAt.getTime())) return fail(400, { message: 'Invalid trashedAt timestamp' });

		const outcome = await appRuntime.runPromise(
			Effect.match(restoreFoodItem(userId, id, trashedAt), {
				onFailure: (e) => {
					if (e._tag === 'FoodItemNotFoundError') {
						return { ok: false as const, status: 404 as const, message: `Item ${e.id} not found` };
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
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	}
};
