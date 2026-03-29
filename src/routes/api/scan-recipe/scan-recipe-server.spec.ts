import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import { AIProviderError, UnreadableImageError, NoItemsExtractedError } from '$lib/domain/receipt/errors.js';

const { mockExtractRecipe } = vi.hoisted(() => ({ mockExtractRecipe: vi.fn() }));

vi.mock('$lib/infrastructure/ai-recipe-scanner.js', () => ({
	AIRecipeScanner: { extractRecipe: (...args: unknown[]) => mockExtractRecipe(...args) }
}));

import { POST } from './+server.js';

const makeRequest = () => {
	const formData = new FormData();
	formData.append('image', new File([new Uint8Array([1, 2, 3])], 'recipe.jpg', { type: 'image/jpeg' }));
	return new Request('http://localhost/api/scan-recipe', { method: 'POST', body: formData });
};

const fakeUser = { id: 'user-1', name: 'Test', email: 'test@example.com' };

const fakeRecipe = {
	name: 'Chicken Soup',
	ingredients: [{ name: 'Chicken', canonicalName: 'chicken', quantity: '1', unit: 'lb' }]
};

describe('POST /api/scan-recipe', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it('returns extracted recipe on success', async () => {
		mockExtractRecipe.mockReturnValue(Effect.succeed(fakeRecipe));

		const response = await POST({ request: makeRequest(), locals: { user: fakeUser } } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual(fakeRecipe);
	});

	it('logs AIProviderError cause before returning 503', async () => {
		const originalCause = new Error('API key invalid');
		mockExtractRecipe.mockReturnValue(Effect.fail(new AIProviderError({ cause: originalCause })));

		await expect(POST({ request: makeRequest(), locals: { user: fakeUser } } as never)).rejects.toMatchObject({ status: 503 });

		expect(consoleSpy).toHaveBeenCalledWith(originalCause);
	});

	it('does not log console.error for UnreadableImageError', async () => {
		mockExtractRecipe.mockReturnValue(Effect.fail(new UnreadableImageError()));

		await expect(POST({ request: makeRequest(), locals: { user: fakeUser } } as never)).rejects.toMatchObject({ status: 422 });

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it('does not log console.error for NoItemsExtractedError', async () => {
		mockExtractRecipe.mockReturnValue(Effect.fail(new NoItemsExtractedError()));

		await expect(POST({ request: makeRequest(), locals: { user: fakeUser } } as never)).rejects.toMatchObject({ status: 422 });

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it('returns 401 when user is not authenticated', async () => {
		mockExtractRecipe.mockReturnValue(Effect.succeed(fakeRecipe));

		await expect(POST({ request: makeRequest(), locals: { user: undefined } } as never)).rejects.toMatchObject({ status: 401 });

		expect(consoleSpy).not.toHaveBeenCalled();
	});
});
