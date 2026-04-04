import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { TaskRepository } from '$lib/domain/tasks/task-repository.js';
import { createTask, toggleTaskCompletion, removeTask } from '$lib/domain/tasks/use-cases.js';
import { TaskNotFoundError } from '$lib/domain/tasks/errors.js';
import { DrizzleTaskRepository } from './drizzle-task-repository.js';
import { Database } from './database.js';
import type { Task } from '$lib/domain/tasks/task.js';

const TEST_USER_ID = 'user-1';
const TEST_HOUSEHOLD_ID = 'household-1';

const makeDbLayer = (mockDb: object) =>
	DrizzleTaskRepository.pipe(Layer.provide(Layer.succeed(Database, mockDb as never)));

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
				from: () => ({
					where: () => Promise.resolve([fakeTask])
				})
			}),
			update: () => ({
				set: () => ({
					where: () => ({
						returning: () => Promise.resolve([fakeTask])
					})
				})
			})
		};

		return Effect.runPromise(
			createTask(TEST_HOUSEHOLD_ID, TEST_USER_ID, { title: 'Test task', priority: 1 }).pipe(
				Effect.provide(makeDbLayer(mockDb))
			)
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

		return Effect.runPromise(
			toggleTaskCompletion(TEST_HOUSEHOLD_ID, TEST_USER_ID, { id: 99 }).pipe(
				Effect.provide(makeDbLayer(mockDb)),
				Effect.flip
			)
		).then((result) => {
			expect(result).toBeInstanceOf(TaskNotFoundError);
			expect((result as TaskNotFoundError).id).toBe(99);
		});
	});

	it('softDelete returns TaskNotFoundError when no row found', () => {
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

		return Effect.runPromise(
			removeTask(TEST_HOUSEHOLD_ID, TEST_USER_ID, { id: 99 }).pipe(Effect.provide(makeDbLayer(mockDb)), Effect.flip)
		).then((result) => {
			expect(result).toBeInstanceOf(TaskNotFoundError);
			expect((result as TaskNotFoundError).id).toBe(99);
		});
	});
});
