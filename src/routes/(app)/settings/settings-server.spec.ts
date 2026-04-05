import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { HouseholdRepository } from '$lib/domain/household/household-repository.js';

const mockFindByUserId = vi.fn();
const mockGetMembersUseCase = vi.fn();

const repoLayer = Layer.succeed(HouseholdRepository, {
	createSoloHousehold: () => Effect.succeed(null as never),
	findByUserId: (...args: unknown[]) => mockFindByUserId(...args),
	findByInviteCode: () => Effect.succeed(null),
	generateInviteCode: () => Effect.succeed(null as never),
	getMemberCount: () => Effect.succeed(0),
	joinHousehold: () => Effect.succeed(null as never),
	getUserRole: () => Effect.succeed(null),
	getMembers: () => Effect.succeed([]),
	removeMember: () => Effect.succeed(undefined),
	transferOwnership: () => Effect.succeed(undefined),
	renameHousehold: () => Effect.succeed(null as never),
	leaveHousehold: () => Effect.succeed(undefined)
});

vi.mock('$lib/server/runtime', () => ({
	appRuntime: {
		runPromise: (effect: Effect.Effect<unknown, unknown>) =>
			Effect.runPromise(effect.pipe(Effect.provide(repoLayer)))
	}
}));

vi.mock('$lib/domain/household/use-cases.js', () => ({
	generateInviteCode: vi.fn(),
	getMembers: (...args: unknown[]) => mockGetMembersUseCase(...args),
	removeMember: vi.fn(),
	transferOwnership: vi.fn(),
	renameHousehold: vi.fn(),
	leaveHousehold: vi.fn()
}));

vi.mock('$lib/domain/household/errors.js', () => ({
	NotHouseholdOwnerError: class NotHouseholdOwnerError extends Error {},
	OwnerCannotLeaveError: class OwnerCannotLeaveError extends Error {},
	CannotRemoveSelfError: class CannotRemoveSelfError extends Error {}
}));

vi.mock('$lib/server/auth', () => ({
	auth: {}
}));

import { load } from './+page.server.js';

const makeLocals = (overrides: Record<string, unknown> = {}) => ({
	user: { id: 'user-1', name: 'Alice' },
	householdId: undefined as string | undefined,
	...overrides
});

const makeUrl = (search = '') => new URL(`http://localhost/settings${search}`);

describe('settings load', () => {
	beforeEach(() => {
		mockFindByUserId.mockReset();
		mockGetMembersUseCase.mockReset();
	});

	it('returns household when user has one, even without locals.householdId', async () => {
		const household = { id: 'hh-1', name: "Alice's Household" };
		mockFindByUserId.mockReturnValue(Effect.succeed(household));

		const result = await load({
			locals: makeLocals(),
			url: makeUrl()
		} as never);

		expect(result.household).toEqual(household);
	});

	it('streams members using the fetched household ID', async () => {
		const household = { id: 'hh-42', name: "Alice's Household" };
		const members = [
			{ id: 'user-1', name: 'Alice', role: 'owner' as const },
			{ id: 'user-2', name: 'Bob', role: 'member' as const }
		];
		mockFindByUserId.mockReturnValue(Effect.succeed(household));
		mockGetMembersUseCase.mockReturnValue(Effect.succeed(members));

		const result = await load({
			locals: makeLocals(),
			url: makeUrl()
		} as never);

		const resolvedMembers = await result.members;
		expect(resolvedMembers).toEqual(members);
		expect(mockGetMembersUseCase).toHaveBeenCalledWith('hh-42');
	});

	it('returns null household and empty members when user has no household', async () => {
		mockFindByUserId.mockReturnValue(Effect.succeed(null));

		const result = await load({
			locals: makeLocals(),
			url: makeUrl()
		} as never);

		expect(result.household).toBeNull();
		const resolvedMembers = await result.members;
		expect(resolvedMembers).toEqual([]);
		expect(mockGetMembersUseCase).not.toHaveBeenCalled();
	});
});
