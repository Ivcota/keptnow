import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { TaskRepository } from '$lib/domain/tasks/task-repository.js';
import { createTask } from '$lib/domain/tasks/use-cases.js';
import { DrizzleTaskRepository } from './drizzle-task-repository.js';
import { Database } from './database.js';
import type { Task } from '$lib/domain/tasks/task.js';

describe('DrizzleTaskRepository', () => {
	it('layer depends on Database tag and provides TaskRepository', () => {
		// Verify the layer requires Database and provides TaskRepository
		// by providing a mock Database and running a use case through it.
		// The mock DB returns pre-canned rows without touching a real database.

		const fakeTask: Task = { id: 1, title: 'Test task', priority: 1 };

		const mockDb = {
			insert: () => ({
				values: () => ({
					returning: () => Promise.resolve([fakeTask])
				})
			}),
			select: () => ({
				from: () => Promise.resolve([fakeTask])
			})
		};

		const testLayer = DrizzleTaskRepository.pipe(
			Layer.provide(Layer.succeed(Database, mockDb as never))
		);

		return Effect.runPromise(
			createTask({ title: 'Test task', priority: 1 }).pipe(Effect.provide(testLayer))
		).then((result) => {
			expect(result).toEqual(fakeTask);
		});
	});
});
