import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/runtime', () => ({
	appRuntime: {
		runPromise: vi.fn().mockResolvedValue({ ok: true })
	}
}));

import { actions, load } from './+page.server.js';

describe('/demo/tasks server actions', () => {
	it('exports a create action instead of a default action', () => {
		expect(typeof (actions as Record<string, unknown>).create).toBe('function');
		expect('default' in actions).toBe(false);
	});

	it('create action returns undefined (success) with valid form data and authenticated user', async () => {
		const formData = new FormData();
		formData.append('title', 'Buy groceries');
		formData.append('priority', '2');

		const request = new Request('http://localhost', { method: 'POST', body: formData });
		const locals = { user: { id: 'user-1', name: 'Test User', email: 'test@example.com' } };

		const result = await (
			actions as Record<string, (ctx: { request: Request; locals: typeof locals }) => unknown>
		).create({ request, locals });

		expect(result).toBeUndefined();
	});

	it('create action returns 401 when user is not authenticated', async () => {
		const formData = new FormData();
		formData.append('title', 'Buy groceries');
		formData.append('priority', '2');

		const request = new Request('http://localhost', { method: 'POST', body: formData });
		const locals = { user: undefined };

		const result = await (
			actions as Record<string, (ctx: { request: Request; locals: typeof locals }) => unknown>
		).create({ request, locals });

		expect(result).toMatchObject({ status: 401 });
	});

	it('load redirects unauthenticated users to login', async () => {
		const locals = { user: undefined };

		await expect(
			(load as (ctx: { locals: typeof locals }) => unknown)({ locals })
		).rejects.toMatchObject({ status: 302, location: '/demo/better-auth/login' });
	});
});
