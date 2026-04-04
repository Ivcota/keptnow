import { Layer, Effect } from 'effect';
import { and, eq, isNull } from 'drizzle-orm';
import { TaskRepository } from '$lib/domain/tasks/task-repository.js';
import { TaskRepositoryError, TaskNotFoundError } from '$lib/domain/tasks/errors.js';
import { Database } from './database.js';
import { task } from '$lib/server/db/schema';

function scopeCondition(householdId: string | null, userId: string) {
	return householdId ? eq(task.householdId, householdId) : eq(task.userId, userId);
}

export const DrizzleTaskRepository = Layer.effect(
	TaskRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			create: (householdId, userId, input) =>
				Effect.tryPromise({
					try: () =>
						db
							.insert(task)
							.values({ userId, householdId, ...input })
							.returning()
							.then((rows) => rows[0]),
					catch: (e) => new TaskRepositoryError({ message: 'Failed to create task', cause: e })
				}),
			findAll: (householdId, userId) =>
				Effect.tryPromise({
					try: () =>
						db
							.select()
							.from(task)
							.where(and(scopeCondition(householdId, userId), isNull(task.deletedAt))),
					catch: (e) => new TaskRepositoryError({ message: 'Failed to fetch tasks', cause: e })
				}),
			toggleCompletion: (householdId, userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(task)
								.where(and(eq(task.id, id), scopeCondition(householdId, userId), isNull(task.deletedAt))),
						catch: (e) => new TaskRepositoryError({ message: 'Failed to find task', cause: e })
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new TaskNotFoundError({ id }));
					}

					const existing = rows[0];
					const newCompletedAt = existing.completedAt === null ? new Date() : null;

					const updated = yield* Effect.tryPromise({
						try: () =>
							db
								.update(task)
								.set({ completedAt: newCompletedAt })
								.where(and(eq(task.id, id), scopeCondition(householdId, userId)))
								.returning()
								.then((rows) => rows[0]),
						catch: (e) =>
							new TaskRepositoryError({ message: 'Failed to toggle task completion', cause: e })
					});

					return updated;
				}),
			softDelete: (householdId, userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(task)
								.where(and(eq(task.id, id), scopeCondition(householdId, userId), isNull(task.deletedAt))),
						catch: (e) => new TaskRepositoryError({ message: 'Failed to find task', cause: e })
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new TaskNotFoundError({ id }));
					}

					yield* Effect.tryPromise({
						try: () =>
							db
								.update(task)
								.set({ deletedAt: new Date() })
								.where(and(eq(task.id, id), scopeCondition(householdId, userId))),
						catch: (e) =>
							new TaskRepositoryError({ message: 'Failed to soft-delete task', cause: e })
					});
				})
		};
	})
);
