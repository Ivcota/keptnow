import { fail, redirect } from '@sveltejs/kit';
import { Effect } from 'effect';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import {
	generateShoppingList,
	setShoppingListItemChecked,
	completeShoppingTrip
} from '$lib/domain/shopping-list/use-cases';
import type { CreateFoodItemInput } from '$lib/domain/inventory/food-item';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const items = await appRuntime.runPromise(
		generateShoppingList(userId).pipe(Effect.orDie)
	);
	return { items };
};

export const actions: Actions = {
	toggle: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);
		const checked = formData.get('checked') === 'true';

		if (isNaN(id)) return fail(400, { message: 'Invalid item ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(setShoppingListItemChecked(userId, id, checked), {
				onFailure: (e) =>
					e._tag === 'ShoppingListItemNotFoundError'
						? { ok: false as const, status: 404 as const, message: `Item ${e.id} not found` }
						: { ok: false as const, status: 500 as const, message: 'Database error' },
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	completeShopping: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const formData = await request.formData();
		const recipeItemsRaw = formData.get('recipeItemsJson')?.toString() ?? '[]';

		let recipeItems: CreateFoodItemInput[];
		try {
			recipeItems = JSON.parse(recipeItemsRaw);
			if (!Array.isArray(recipeItems)) throw new Error('Not an array');
		} catch {
			return fail(400, { message: 'Invalid recipe items JSON' });
		}

		// Parse expirationDate strings back to Date objects
		recipeItems = recipeItems.map((item) => ({
			...item,
			expirationDate: item.expirationDate ? new Date(item.expirationDate as unknown as string) : null
		}));

		const outcome = await appRuntime.runPromise(
			Effect.match(completeShoppingTrip(userId, recipeItems), {
				onFailure: () => ({ ok: false as const }),
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(500, { message: 'Failed to complete shopping trip' });

		redirect(303, '/shop');
	}
};
