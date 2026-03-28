import { fail } from '@sveltejs/kit';
import { Effect } from 'effect';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import { createTask, findAllTasks, toggleTaskCompletion } from '$lib/domain/tasks/use-cases';

export const load: PageServerLoad = async () => {
	const tasks = await appRuntime.runPromise(
		findAllTasks().pipe(Effect.orDie)
	);
	return { tasks };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const title = formData.get('title')?.toString() ?? '';
		const priority = parseInt(formData.get('priority')?.toString() ?? '1', 10);

		const outcome = await appRuntime.runPromise(
			Effect.match(createTask({ title, priority }), {
				onFailure: (e) =>
					e._tag === 'TaskValidationError'
						? ({ ok: false as const, status: 400 as const, message: e.message })
						: ({ ok: false as const, status: 500 as const, message: 'Database error' }),
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	},

	complete: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() ?? '', 10);

		if (isNaN(id)) return fail(400, { message: 'Invalid task ID' });

		const outcome = await appRuntime.runPromise(
			Effect.match(toggleTaskCompletion({ id }), {
				onFailure: (e) =>
					e._tag === 'TaskNotFoundError'
						? ({ ok: false as const, status: 404 as const, message: `Task ${e.id} not found` })
						: ({ ok: false as const, status: 500 as const, message: 'Database error' }),
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	}
};
