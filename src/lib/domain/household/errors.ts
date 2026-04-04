import { Data } from 'effect';

export class HouseholdRepositoryError extends Data.TaggedError('HouseholdRepositoryError')<{
	message: string;
	cause?: unknown;
}> {}

export class InvalidInviteCodeError extends Data.TaggedError('InvalidInviteCodeError')<{
	code: string;
}> {}

export class ExpiredInviteCodeError extends Data.TaggedError('ExpiredInviteCodeError')<{
	code: string;
}> {}

export class HouseholdFullError extends Data.TaggedError('HouseholdFullError')<{
	householdId: string;
}> {}

export class NotHouseholdOwnerError extends Data.TaggedError('NotHouseholdOwnerError')<{
	userId: string;
	householdId: string;
}> {}

export class OwnerCannotLeaveError extends Data.TaggedError('OwnerCannotLeaveError')<{
	userId: string;
	householdId: string;
}> {}

export class CannotRemoveSelfError extends Data.TaggedError('CannotRemoveSelfError')<{
	userId: string;
}> {}

export class MemberNotFoundError extends Data.TaggedError('MemberNotFoundError')<{
	userId: string;
	householdId: string;
}> {}
