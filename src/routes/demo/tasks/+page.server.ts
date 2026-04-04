import { fail, redirect } from '@sveltejs/kit';
import { Effect } from 'effect';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import { withRequestLogging } from '$lib/server/logging';
import {
	createTask,
	findAllTasks,
	toggleTaskCompletion,
	removeTask
} from '$lib/domain/tasks/use-cases';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/demo/better-auth/login');
	}

	const userId = locals.user.id;
	const householdId = locals.householdId ?? null;
	const ctx = { userId, requestId: locals.requestId, route: '/demo/tasks' };
	const tasks = await appRuntime.runPromise(
		withRequestLogging(findAllTasks(householdId, userId), { ...ctx, useCase: 'findAllTasks' }).pipe(
			Effect.orDie
		)
	);
	return { tasks };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const householdId = locals.householdId ?? null;
		const ctx = { userId, requestId: locals.requestId, route: '/demo/tasks' };
		const formData = await request.formData();
		const title = formData.get('title')?.toString() ?? '';
		const priority = parseInt(formData.get('priority')?.toString() ?? '1', 10);

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(createTask(householdId, userId, { title, priority }), {
					...ctx,
					useCase: 'createTask'
				}),
				{
					onFailure: (e) =>
						e._tag === 'TaskValidationError'
							? { ok: false as const, status: 400 as const, message: e.message }
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: () => ({ ok: true as const })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	complete: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const householdId = locals.householdId ?? null;
		const ctx = { userId, requestId: locals.requestId, route: '/demo/tasks' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid task ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(toggleTaskCompletion(householdId, userId, { id }), {
					...ctx,
					useCase: 'toggleTaskCompletion'
				}),
				{
					onFailure: (e) =>
						e._tag === 'TaskNotFoundError'
							? { ok: false as const, status: 404 as const, message: `Task ${e.id} not found` }
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: () => ({ ok: true as const })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	remove: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const householdId = locals.householdId ?? null;
		const ctx = { userId, requestId: locals.requestId, route: '/demo/tasks' };
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid task ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(
				withRequestLogging(removeTask(householdId, userId, { id }), { ...ctx, useCase: 'removeTask' }),
				{
					onFailure: (e) =>
						e._tag === 'TaskNotFoundError'
							? { ok: false as const, status: 404 as const, message: `Task ${e.id} not found` }
							: { ok: false as const, status: 500 as const, message: 'Database error' },
					onSuccess: () => ({ ok: true as const })
				}
			)
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	}
};
