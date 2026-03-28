import { Layer, Effect } from 'effect';
import { TaskRepository } from '$lib/domain/tasks/task-repository.js';
import { TaskRepositoryError } from '$lib/domain/tasks/errors.js';
import { Database } from './database.js';
import { task } from '$lib/server/db/schema';

export const DrizzleTaskRepository = Layer.effect(
	TaskRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			create: (input) =>
				Effect.tryPromise({
					try: () =>
						db
							.insert(task)
							.values(input)
							.returning()
							.then((rows) => rows[0]),
					catch: (e) => new TaskRepositoryError({ message: 'Failed to create task', cause: e })
				}),
			findAll: () =>
				Effect.tryPromise({
					try: () => db.select().from(task),
					catch: (e) => new TaskRepositoryError({ message: 'Failed to fetch tasks', cause: e })
				})
		};
	})
);
