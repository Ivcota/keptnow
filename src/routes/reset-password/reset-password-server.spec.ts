import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockResetPassword } = vi.hoisted(() => ({ mockResetPassword: vi.fn() }));

vi.mock('$lib/server/auth', () => ({
	auth: {
		api: {
			resetPassword: mockResetPassword
		}
	}
}));

import { actions } from './+page.server.js';

type ResetAction = (ctx: {
	request: Request;
	url: URL;
}) => unknown;

function makeRequest(password: string, confirmPassword: string) {
	const formData = new FormData();
	formData.append('password', password);
	formData.append('confirmPassword', confirmPassword);
	return new Request('http://localhost/reset-password', { method: 'POST', body: formData });
}

function makeUrl(token: string) {
	return new URL(`http://localhost/reset-password?token=${token}`);
}

describe('/reset-password server actions', () => {
	beforeEach(() => {
		mockResetPassword.mockReset();
	});

	it('returns validation error when passwords do not match', async () => {
		const result = await (actions as Record<string, ResetAction>).resetPassword({
			request: makeRequest('password123', 'different456'),
			url: makeUrl('valid-token')
		});
		expect(result).toMatchObject({ status: 400, data: { message: expect.any(String) } });
		expect(mockResetPassword).not.toHaveBeenCalled();
	});

	it('returns validation error when password is shorter than 8 characters', async () => {
		const result = await (actions as Record<string, ResetAction>).resetPassword({
			request: makeRequest('short', 'short'),
			url: makeUrl('valid-token')
		});
		expect(result).toMatchObject({ status: 400, data: { message: expect.any(String) } });
		expect(mockResetPassword).not.toHaveBeenCalled();
	});

	it('calls auth.api.resetPassword with token and new password on valid input', async () => {
		mockResetPassword.mockResolvedValueOnce(undefined);
		await expect(
			(actions as Record<string, ResetAction>).resetPassword({
				request: makeRequest('newpassword123', 'newpassword123'),
				url: makeUrl('abc-token')
			})
		).rejects.toMatchObject({ status: 302, location: '/login' });
		expect(mockResetPassword).toHaveBeenCalledWith({
			body: { newPassword: 'newpassword123', token: 'abc-token' }
		});
	});

	it('returns error when token is missing', async () => {
		const result = await (actions as Record<string, ResetAction>).resetPassword({
			request: makeRequest('newpassword123', 'newpassword123'),
			url: new URL('http://localhost/reset-password')
		});
		expect(result).toMatchObject({ status: 400, data: { message: expect.any(String), tokenError: true } });
	});

	it('returns tokenError flag when auth.api.resetPassword throws APIError (invalid/expired token)', async () => {
		const { APIError } = await import('better-auth/api');
		mockResetPassword.mockRejectedValueOnce(new APIError('BAD_REQUEST', { message: 'Invalid token' }));

		const result = await (actions as Record<string, ResetAction>).resetPassword({
			request: makeRequest('newpassword123', 'newpassword123'),
			url: makeUrl('bad-token')
		});
		expect(result).toMatchObject({ status: 400, data: { message: expect.any(String), tokenError: true } });
	});

	it('does not return tokenError for validation errors (mismatched passwords)', async () => {
		const result = await (actions as Record<string, ResetAction>).resetPassword({
			request: makeRequest('password123', 'different456'),
			url: makeUrl('valid-token')
		});
		expect(result).toMatchObject({ status: 400, data: { message: expect.any(String) } });
		expect((result as { data: { tokenError?: boolean } }).data.tokenError).toBeFalsy();
	});
});
