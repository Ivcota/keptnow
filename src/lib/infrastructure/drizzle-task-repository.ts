import { Layer, Effect } from 'effect';
import { TaskRepository } from '$lib/domain/tasks/task-repository.js';
import { Database } from './database.js';
import { task } from '$lib/server/db/schema';

export const DrizzleTaskRepository = Layer.effect(
	TaskRepository,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			create: (input) =>
				Effect.promise(() =>
					db
						.insert(task)
						.values(input)
						.returning()
						.then((rows) => rows[0])
				),
			findAll: () => Effect.promise(() => db.select().from(task))
		};
	})
);
