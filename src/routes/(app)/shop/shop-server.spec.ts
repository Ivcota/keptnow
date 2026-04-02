import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCompleteShoppingTrip } = vi.hoisted(() => ({
	mockCompleteShoppingTrip: vi.fn()
}));

vi.mock('$lib/server/runtime', () => ({
	appRuntime: {
		runPromise: vi.fn((effect: unknown) => effect)
	}
}));

vi.mock('$lib/server/logging', () => ({
	withRequestLogging: (_effect: unknown, _ctx: unknown) => _effect
}));

vi.mock('$lib/domain/shopping-list/use-cases', () => ({
	generateShoppingList: vi.fn(),
	setShoppingListItemChecked: vi.fn(),
	completeShoppingTrip: mockCompleteShoppingTrip
}));

vi.mock('effect', async (importOriginal) => {
	const actual = await importOriginal<typeof import('effect')>();
	return {
		...actual,
		Effect: {
			...actual.Effect,
			match: vi.fn((_effect: unknown, { onSuccess }: { onFailure: unknown; onSuccess: () => unknown }) =>
				onSuccess()
			)
		}
	};
});

import { actions } from './+page.server.js';

type CompleteShopping = (ctx: { locals: { user: { id: string } | null; requestId: string } }) => unknown;

describe('/shop completeShopping action', () => {
	beforeEach(() => {
		mockCompleteShoppingTrip.mockReset();
	});

	it('redirects to /shop?completed=true on success', async () => {
		mockCompleteShoppingTrip.mockReturnValueOnce(undefined);

		await expect(
			(actions as Record<string, CompleteShopping>).completeShopping({
				locals: { user: { id: 'user-1' }, requestId: 'req-1' }
			})
		).rejects.toMatchObject({ status: 303, location: '/shop?completed=true' });
	});

	it('returns 401 when user is not authenticated', async () => {
		const result = await (actions as Record<string, CompleteShopping>).completeShopping({
			locals: { user: null, requestId: 'req-1' }
		});
		expect(result).toMatchObject({ status: 401 });
	});
});
