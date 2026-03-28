import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/runtime', () => ({
	appRuntime: {
		runPromise: vi.fn().mockResolvedValue({ ok: true })
	}
}));

import { actions } from './+page.server.js';

describe('/demo/tasks server actions', () => {
	it('exports a create action instead of a default action', () => {
		expect(typeof (actions as Record<string, unknown>).create).toBe('function');
		expect('default' in actions).toBe(false);
	});

	it('create action returns undefined (success) with valid form data', async () => {
		const formData = new FormData();
		formData.append('title', 'Buy groceries');
		formData.append('priority', '2');

		const request = new Request('http://localhost', { method: 'POST', body: formData });

		const result = await (actions as Record<string, (ctx: { request: Request }) => unknown>).create({ request });

		expect(result).toBeUndefined();
	});
});
