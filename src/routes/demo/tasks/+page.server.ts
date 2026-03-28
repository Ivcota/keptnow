import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import { createTask, findAllTasks } from '$lib/domain/tasks/use-cases';

export const load: PageServerLoad = async () => {
	const tasks = await appRuntime.runPromise(findAllTasks());
	return { tasks };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const title = formData.get('title')?.toString() ?? '';
		const priority = parseInt(formData.get('priority')?.toString() ?? '1', 10);

		try {
			await appRuntime.runPromise(createTask({ title, priority }));
		} catch {
			return fail(500, { message: 'Failed to create task' });
		}
	}
};
