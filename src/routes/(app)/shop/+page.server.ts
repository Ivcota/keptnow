import { fail, redirect } from '@sveltejs/kit';
import { Effect } from 'effect';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import { withRequestLogging } from '$lib/server/logging';
import {
	generateShoppingList,
	setShoppingListItemChecked,
	completeShoppingTrip
} from '$lib/domain/shopping-list/use-cases';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const householdId = locals.householdId ?? null;
	const ctx = { userId, requestId: locals.requestId, route: '/shop' };
	const items = await appRuntime.runPromise(
		withRequestLogging(generateShoppingList(householdId, userId), {
			...ctx,
			useCase: 'generateShoppingList'
		}).pipe(Effect.orDie)
	);
	return { items };
};

export const actions: Actions = {
	toggle: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const householdId = locals.householdId ?? null;
		const ctx = { userId, requestId: locals.requestId, route: '/shop' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);
		const checked = formData.get('checked') === 'true';

		if (isNaN(id)) return fail(400, { message: 'Invalid item ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(setShoppingListItemChecked(householdId, userId, id, checked), {
					...ctx,
					useCase: 'setShoppingListItemChecked'
				}),
				{
					onFailure: (e) =>
						e._tag === 'ShoppingListItemNotFoundError'
							? { ok: false as const, status: 404 as const, message: `Item ${e.id} not found` }
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: () => ({ ok: true as const })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	completeShopping: async ({ locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const householdId = locals.householdId ?? null;
		const ctx = { userId, requestId: locals.requestId, route: '/shop' };

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(completeShoppingTrip(householdId, userId), {
					...ctx,
					useCase: 'completeShoppingTrip'
				}),
				{
					onFailure: () => ({ ok: false as const }),
					onSuccess: () => ({ ok: true as const })
				}
			)
		);

		if (!outcome.ok) return fail(500, { message: 'Failed to complete shopping trip' });

		redirect(303, '/shop?completed=true');
	}
};
