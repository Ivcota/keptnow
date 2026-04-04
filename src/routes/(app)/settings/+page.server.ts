import { fail, redirect } from '@sveltejs/kit';
import { Effect } from 'effect';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { appRuntime } from '$lib/server/runtime';
import {
	generateInviteCode,
	getMembers,
	removeMember,
	transferOwnership,
	renameHousehold,
	leaveHousehold
} from '$lib/domain/household/use-cases.js';
import { HouseholdRepository } from '$lib/domain/household/household-repository.js';
import {
	NotHouseholdOwnerError,
	OwnerCannotLeaveError,
	CannotRemoveSelfError
} from '$lib/domain/household/errors.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Await household (gates the section), stream members list
	let household = null;
	if (locals.householdId) {
		household = await appRuntime
			.runPromise(
				Effect.gen(function* () {
					const repo = yield* HouseholdRepository;
					return yield* repo.findByUserId(locals.user!.id);
				})
			)
			.catch(() => null);
	}

	return {
		user: locals.user!,
		household,
		members: locals.householdId
			? appRuntime
					.runPromise(Effect.either(getMembers(locals.householdId)))
					.then((r) => (r._tag === 'Right' ? r.right : []))
					.catch(() => [] as { id: string; name: string; role: 'owner' | 'member' }[])
			: Promise.resolve([] as { id: string; name: string; role: 'owner' | 'member' }[]),
		inviteGenerated: url.searchParams.get('inviteGenerated') ?? null
	};
};

export const actions: Actions = {
	updateProfile: async (event) => {
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';

		if (!name) {
			return fail(400, { field: 'profile', message: 'Name is required' });
		}

		try {
			await auth.api.updateUser({
				body: { name },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { field: 'profile', message: error.message || 'Failed to update profile' });
			}
			console.error(`[${event.locals.requestId}] updateProfile unexpected error:`, error);
			return fail(500, { field: 'profile', message: 'Unexpected error' });
		}

		return { field: 'profile', success: true };
	},

	changePassword: async (event) => {
		const formData = await event.request.formData();
		const currentPassword = formData.get('currentPassword')?.toString() ?? '';
		const newPassword = formData.get('newPassword')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { field: 'password', message: 'All password fields are required' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { field: 'password', message: 'New passwords do not match' });
		}

		if (newPassword.length < 8) {
			return fail(400, { field: 'password', message: 'New password must be at least 8 characters' });
		}

		try {
			await auth.api.changePassword({
				body: { currentPassword, newPassword },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, {
					field: 'password',
					message: error.message || 'Failed to change password'
				});
			}
			console.error(`[${event.locals.requestId}] changePassword unexpected error:`, error);
			return fail(500, { field: 'password', message: 'Unexpected error' });
		}

		return { field: 'password', success: true };
	},

	generateInvite: async (event) => {
		if (!event.locals.user || !event.locals.householdId) {
			return fail(403, { field: 'invite', message: 'Not authorized' });
		}
		const result = await appRuntime.runPromise(
			Effect.either(generateInviteCode(event.locals.householdId, event.locals.user.id))
		);
		if (result._tag === 'Left') {
			const error = result.left;
			if (error instanceof NotHouseholdOwnerError) {
				return fail(403, { field: 'invite', message: 'Only household owners can generate invite links' });
			}
			return fail(500, { field: 'invite', message: 'Failed to generate invite link' });
		}
		return { field: 'invite', success: true, household: result.right };
	},

	renameHousehold: async (event) => {
		if (!event.locals.user || !event.locals.householdId) {
			return fail(403, { field: 'rename', message: 'Not authorized' });
		}
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		if (!name) {
			return fail(400, { field: 'rename', message: 'Household name is required' });
		}
		const result = await appRuntime.runPromise(
			Effect.either(renameHousehold(event.locals.householdId, event.locals.user.id, name))
		);
		if (result._tag === 'Left') {
			const error = result.left;
			if (error instanceof NotHouseholdOwnerError) {
				return fail(403, { field: 'rename', message: 'Only household owners can rename the household' });
			}
			return fail(500, { field: 'rename', message: 'Failed to rename household' });
		}
		return { field: 'rename', success: true, household: result.right };
	},

	removeMember: async (event) => {
		if (!event.locals.user || !event.locals.householdId) {
			return fail(403, { field: 'removeMember', message: 'Not authorized' });
		}
		const formData = await event.request.formData();
		const memberUserId = formData.get('memberId')?.toString() ?? '';
		if (!memberUserId) {
			return fail(400, { field: 'removeMember', message: 'Member ID is required' });
		}
		const result = await appRuntime.runPromise(
			Effect.either(
				removeMember(event.locals.householdId, event.locals.user.id, memberUserId)
			)
		);
		if (result._tag === 'Left') {
			const error = result.left;
			if (error instanceof NotHouseholdOwnerError) {
				return fail(403, { field: 'removeMember', message: 'Only owners can remove members' });
			}
			if (error instanceof CannotRemoveSelfError) {
				return fail(400, {
					field: 'removeMember',
					message: 'You cannot remove yourself. Use "Leave household" instead.'
				});
			}
			return fail(500, { field: 'removeMember', message: 'Failed to remove member' });
		}
		return { field: 'removeMember', success: true };
	},

	transferOwnership: async (event) => {
		if (!event.locals.user || !event.locals.householdId) {
			return fail(403, { field: 'transfer', message: 'Not authorized' });
		}
		const formData = await event.request.formData();
		const toUserId = formData.get('toUserId')?.toString() ?? '';
		if (!toUserId) {
			return fail(400, { field: 'transfer', message: 'Target user ID is required' });
		}
		const result = await appRuntime.runPromise(
			Effect.either(
				transferOwnership(event.locals.householdId, event.locals.user.id, toUserId)
			)
		);
		if (result._tag === 'Left') {
			const error = result.left;
			if (error instanceof NotHouseholdOwnerError) {
				return fail(403, { field: 'transfer', message: 'Only owners can transfer ownership' });
			}
			return fail(500, { field: 'transfer', message: 'Failed to transfer ownership' });
		}
		return { field: 'transfer', success: true };
	},

	leaveHousehold: async (event) => {
		if (!event.locals.user || !event.locals.householdId) {
			return fail(403, { field: 'leave', message: 'Not authorized' });
		}
		const result = await appRuntime.runPromise(
			Effect.either(leaveHousehold(event.locals.user.id, event.locals.householdId))
		);
		if (result._tag === 'Left') {
			const error = result.left;
			if (error instanceof OwnerCannotLeaveError) {
				return fail(400, {
					field: 'leave',
					message: 'Transfer ownership before leaving the household.'
				});
			}
			return fail(500, { field: 'leave', message: 'Failed to leave household' });
		}
		return redirect(302, '/settings');
	},

	signOut: async (event) => {
		await auth.api.signOut({
			headers: event.request.headers
		});
		return redirect(302, '/');
	}
};
