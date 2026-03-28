import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { TaskRepository } from '$lib/domain/tasks/task-repository.js';
import { createTask, toggleTaskCompletion } from '$lib/domain/tasks/use-cases.js';
import { TaskNotFoundError } from '$lib/domain/tasks/errors.js';
import { DrizzleTaskRepository } from './drizzle-task-repository.js';
import { Database } from './database.js';
import type { Task } from '$lib/domain/tasks/task.js';

describe('DrizzleTaskRepository', () => {
	it('layer depends on Database tag and provides TaskRepository', () => {
		const fakeTask: Task = { id: 1, title: 'Test task', priority: 1, completedAt: null };

		const mockDb = {
			insert: () => ({
				values: () => ({
					returning: () => Promise.resolve([fakeTask])
				})
			}),
			select: () => ({
				from: () => Promise.resolve([fakeTask])
			}),
			update: () => ({
				set: () => ({
					where: () => ({
						returning: () => Promise.resolve([fakeTask])
					})
				})
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

	it('toggleCompletion returns TaskNotFoundError when no row returned', () => {
		const mockDb = {
			insert: () => ({
				values: () => ({
					returning: () => Promise.resolve([])
				})
			}),
			select: () => ({
				from: () => ({
					where: () => Promise.resolve([])
				})
			}),
			update: () => ({
				set: () => ({
					where: () => ({
						returning: () => Promise.resolve([])
					})
				})
			})
		};

		const testLayer = DrizzleTaskRepository.pipe(
			Layer.provide(Layer.succeed(Database, mockDb as never))
		);

		return Effect.runPromise(
			toggleTaskCompletion({ id: 99 }).pipe(Effect.provide(testLayer), Effect.flip)
		).then((result) => {
			expect(result).toBeInstanceOf(TaskNotFoundError);
			expect((result as TaskNotFoundError).id).toBe(99);
		});
	});
});
