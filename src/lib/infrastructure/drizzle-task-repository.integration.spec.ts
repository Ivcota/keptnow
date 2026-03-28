import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { TaskRepository } from '$lib/domain/tasks/task-repository.js';
import { DrizzleTaskRepository } from './drizzle-task-repository.js';
import { DatabaseLive } from './database.js';

const dbAvailable = !!process.env.DATABASE_URL;

describe.skipIf(!dbAvailable)('DrizzleTaskRepository (integration — requires PostgreSQL)', () => {
	const testLayer = DrizzleTaskRepository.pipe(Layer.provide(DatabaseLive));

	it('create inserts a row and findAll retrieves it', async () => {
		const { created, all } = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				const created = yield* repo.create({ title: 'Integration test task', priority: 3 });
				const all = yield* repo.findAll();
				return { created, all };
			}).pipe(Effect.provide(testLayer))
		);

		expect(created.title).toBe('Integration test task');
		expect(created.priority).toBe(3);
		expect(created.id).toBeTypeOf('number');
		expect(all.some((t) => t.id === created.id)).toBe(true);
	});
});
