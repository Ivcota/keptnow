import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import {
	AIProviderError,
	UnreadableImageError,
	NoItemsExtractedError
} from '$lib/domain/receipt/errors.js';

const { mockExtractItems } = vi.hoisted(() => ({ mockExtractItems: vi.fn() }));

vi.mock('$lib/infrastructure/ai-receipt-scanner.js', async () => {
	const { Layer } = await import('effect');
	const { ReceiptScanner } = await import('$lib/domain/receipt/receipt-scanner.js');
	const scanner = { extractItems: (...args: unknown[]) => mockExtractItems(...args) };
	return {
		AIReceiptScanner: scanner,
		AIReceiptScannerLive: Layer.succeed(ReceiptScanner, scanner)
	};
});

import { POST } from './+server.js';

const makeRequest = () => {
	const formData = new FormData();
	formData.append(
		'image',
		new File([new Uint8Array([1, 2, 3])], 'receipt.jpg', { type: 'image/jpeg' })
	);
	return new Request('http://localhost/api/scan-receipt', { method: 'POST', body: formData });
};

const fakeUser = { id: 'user-1', name: 'Test', email: 'test@example.com' };

describe('POST /api/scan-receipt', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	it('logs AIProviderError cause before returning 503', async () => {
		const originalCause = new Error('API key invalid');
		mockExtractItems.mockReturnValue(Effect.fail(new AIProviderError({ cause: originalCause })));

		await expect(
			POST({ request: makeRequest(), locals: { user: fakeUser } } as never)
		).rejects.toMatchObject({ status: 503 });

		expect(consoleSpy).toHaveBeenCalledWith(originalCause);
	});

	it('does not log console.error for UnreadableImageError', async () => {
		mockExtractItems.mockReturnValue(Effect.fail(new UnreadableImageError()));

		await expect(
			POST({ request: makeRequest(), locals: { user: fakeUser } } as never)
		).rejects.toMatchObject({ status: 422 });

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it('does not log console.error for NoItemsExtractedError', async () => {
		mockExtractItems.mockReturnValue(Effect.fail(new NoItemsExtractedError()));

		await expect(
			POST({ request: makeRequest(), locals: { user: fakeUser } } as never)
		).rejects.toMatchObject({ status: 422 });

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it('returns 401 when user is not authenticated', async () => {
		mockExtractItems.mockReturnValue(Effect.succeed([]));

		await expect(
			POST({ request: makeRequest(), locals: { user: undefined } } as never)
		).rejects.toMatchObject({ status: 401 });

		expect(consoleSpy).not.toHaveBeenCalled();
	});
});
