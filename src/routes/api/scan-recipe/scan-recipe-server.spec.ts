import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import { AIProviderError, UnreadableImageError, NoItemsExtractedError } from '$lib/domain/receipt/errors.js';

const { mockExtractRecipes } = vi.hoisted(() => ({ mockExtractRecipes: vi.fn() }));

vi.mock('$lib/infrastructure/ai-recipe-scanner.js', () => ({
	AIRecipeScanner: { extractRecipes: (...args: unknown[]) => mockExtractRecipes(...args) }
}));

import { POST } from './+server.js';

const makeRequest = () => {
	const formData = new FormData();
	formData.append('image', new File([new Uint8Array([1, 2, 3])], 'recipe.jpg', { type: 'image/jpeg' }));
	return new Request('http://localhost/api/scan-recipe', { method: 'POST', body: formData });
};

const fakeUser = { id: 'user-1', name: 'Test', email: 'test@example.com' };

const fakeRecipes = [
	{ name: 'Chicken Soup', ingredients: [{ name: 'Chicken', canonicalName: 'chicken', quantity: '1', unit: 'lb' }] },
	{ name: 'Beef Stew', ingredients: [{ name: 'Beef', canonicalName: 'beef', quantity: '2', unit: 'lbs' }] }
];

describe('POST /api/scan-recipe', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it('returns extracted recipes array on success', async () => {
		mockExtractRecipes.mockReturnValue(Effect.succeed(fakeRecipes));

		const response = await POST({ request: makeRequest(), locals: { user: fakeUser } } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual(fakeRecipes);
	});

	it('returns array with single recipe when page has one recipe', async () => {
		const singleRecipe = [fakeRecipes[0]];
		mockExtractRecipes.mockReturnValue(Effect.succeed(singleRecipe));

		const response = await POST({ request: makeRequest(), locals: { user: fakeUser } } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toHaveLength(1);
		expect(body[0]).toEqual(fakeRecipes[0]);
	});

	it('logs AIProviderError cause before returning 503', async () => {
		const originalCause = new Error('API key invalid');
		mockExtractRecipes.mockReturnValue(Effect.fail(new AIProviderError({ cause: originalCause })));

		await expect(POST({ request: makeRequest(), locals: { user: fakeUser } } as never)).rejects.toMatchObject({ status: 503 });

		expect(consoleSpy).toHaveBeenCalledWith(originalCause);
	});

	it('does not log console.error for UnreadableImageError', async () => {
		mockExtractRecipes.mockReturnValue(Effect.fail(new UnreadableImageError()));

		await expect(POST({ request: makeRequest(), locals: { user: fakeUser } } as never)).rejects.toMatchObject({ status: 422 });

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it('does not log console.error for NoItemsExtractedError', async () => {
		mockExtractRecipes.mockReturnValue(Effect.fail(new NoItemsExtractedError()));

		await expect(POST({ request: makeRequest(), locals: { user: fakeUser } } as never)).rejects.toMatchObject({ status: 422 });

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it('returns 401 when user is not authenticated', async () => {
		mockExtractRecipes.mockReturnValue(Effect.succeed(fakeRecipes));

		await expect(POST({ request: makeRequest(), locals: { user: undefined } } as never)).rejects.toMatchObject({ status: 401 });

		expect(consoleSpy).not.toHaveBeenCalled();
	});
});
