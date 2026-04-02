import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const actions: Actions = {
	resetPassword: async (event) => {
		const token = event.url.searchParams.get('token');
		if (!token) {
			return fail(400, {
				message: 'Reset token is missing. Please request a new password reset.',
				tokenError: true
			});
		}

		const formData = await event.request.formData();
		const password = formData.get('password')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

		if (password.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters.' });
		}

		if (password !== confirmPassword) {
			return fail(400, { message: 'Passwords do not match.' });
		}

		try {
			await auth.api.resetPassword({ body: { newPassword: password, token } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					message: error.message || 'This reset link is invalid or has expired.',
					tokenError: true
				});
			}
			return fail(500, { message: 'Unexpected error. Please try again.' });
		}

		return redirect(302, '/login');
	}
};
