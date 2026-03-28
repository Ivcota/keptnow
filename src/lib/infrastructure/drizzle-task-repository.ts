import { Layer, Effect } from 'effect';
import { and, eq, isNull } from 'drizzle-orm';
import { TaskRepository } from '$lib/domain/tasks/task-repository.js';
import { TaskRepositoryError, TaskNotFoundError } from '$lib/domain/tasks/errors.js';
import { Database } from './database.js';
import { task } from '$lib/server/db/schema';

export const DrizzleTaskRepository = Layer.effect(
	TaskRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			create: (userId, input) =>
				Effect.tryPromise({
					try: () =>
						db
							.insert(task)
							.values({ userId, ...input })
							.returning()
							.then((rows) => rows[0]),
					catch: (e) => new TaskRepositoryError({ message: 'Failed to create task', cause: e })
				}),
			findAll: (userId) =>
				Effect.tryPromise({
					try: () =>
						db
							.select()
							.from(task)
							.where(and(eq(task.userId, userId), isNull(task.deletedAt))),
					catch: (e) => new TaskRepositoryError({ message: 'Failed to fetch tasks', cause: e })
				}),
			toggleCompletion: (userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(task)
								.where(and(eq(task.id, id), eq(task.userId, userId), isNull(task.deletedAt))),
						catch: (e) =>
							new TaskRepositoryError({ message: 'Failed to find task', cause: e })
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
								.where(and(eq(task.id, id), eq(task.userId, userId)))
								.returning()
								.then((rows) => rows[0]),
						catch: (e) =>
							new TaskRepositoryError({ message: 'Failed to toggle task completion', cause: e })
					});

					return updated;
				}),
			softDelete: (userId, id) =>
				Effect.gen(function* () {
					const rows = yield* Effect.tryPromise({
						try: () =>
							db
								.select()
								.from(task)
								.where(and(eq(task.id, id), eq(task.userId, userId), isNull(task.deletedAt))),
						catch: (e) =>
							new TaskRepositoryError({ message: 'Failed to find task', cause: e })
					});

					if (rows.length === 0) {
						return yield* Effect.fail(new TaskNotFoundError({ id }));
					}

					yield* Effect.tryPromise({
						try: () =>
							db
								.update(task)
								.set({ deletedAt: new Date() })
								.where(and(eq(task.id, id), eq(task.userId, userId))),
						catch: (e) =>
							new TaskRepositoryError({ message: 'Failed to soft-delete task', cause: e })
					});
				})
		};
	})
);
