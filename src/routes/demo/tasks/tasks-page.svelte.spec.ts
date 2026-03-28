import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TasksPage from './+page.svelte';

describe('/demo/tasks page', () => {
	it('renders form with title and priority inputs and submit button', async () => {
		render(TasksPage, { data: { tasks: [] }, form: null });

		await expect.element(page.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
		await expect.element(page.getByRole('spinbutton', { name: /priority/i })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /add task/i })).toBeInTheDocument();
	});

	it('renders tasks passed in data prop', async () => {
		const tasks = [
			{ id: 1, title: 'Buy milk', priority: 2 },
			{ id: 2, title: 'Walk dog', priority: 1 }
		];

		render(TasksPage, { data: { tasks }, form: null });

		await expect.element(page.getByText('Buy milk')).toBeInTheDocument();
		await expect.element(page.getByText('Walk dog')).toBeInTheDocument();
	});
});
