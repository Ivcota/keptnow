import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { TaskRepository } from './task-repository.js';
import { createTask, findAllTasks, toggleTaskCompletion, removeTask } from './use-cases.js';
import { TaskValidationError, TaskNotFoundError } from './errors.js';
import type { Task } from './task.js';

const TEST_USER_ID = 'user-1';

const makeRepo = (overrides: Partial<typeof TaskRepository.Service> = {}) =>
	Layer.succeed(TaskRepository, {
		create: () => Effect.succeed({ id: 1, title: 'x', priority: 1, completedAt: null }),
		findAll: () => Effect.succeed([]),
		toggleCompletion: () => Effect.succeed({ id: 1, title: 'x', priority: 1, completedAt: null }),
		softDelete: () => Effect.succeed(undefined as void),
		...overrides
	});

describe('domain/tasks', () => {
	it('createTask delegates to repository', async () => {
		const created: Task = { id: 1, title: 'Buy milk', priority: 2, completedAt: null };

		const result = await Effect.runPromise(
			createTask(TEST_USER_ID, { title: 'Buy milk', priority: 2 }).pipe(
				Effect.provide(makeRepo({ create: () => Effect.succeed(created) }))
			)
		);

		expect(result).toEqual(created);
	});

	it('findAllTasks returns all tasks from repository', async () => {
		const tasks: Task[] = [
			{ id: 1, title: 'Buy milk', priority: 2, completedAt: null },
			{ id: 2, title: 'Walk dog', priority: 1, completedAt: null }
		];

		const result = await Effect.runPromise(
			findAllTasks(TEST_USER_ID).pipe(
				Effect.provide(makeRepo({ findAll: () => Effect.succeed(tasks) }))
			)
		);

		expect(result).toEqual(tasks);
	});

	it('createTask fails with TaskValidationError for empty title', async () => {
		const result = await Effect.runPromise(
			createTask(TEST_USER_ID, { title: '', priority: 1 }).pipe(
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(TaskValidationError);
		expect((result as TaskValidationError).message).toMatch(/empty/i);
	});

	it('createTask fails with TaskValidationError for non-positive priority', async () => {
		const result = await Effect.runPromise(
			createTask(TEST_USER_ID, { title: 'Test', priority: 0 }).pipe(
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(TaskValidationError);
		expect((result as TaskValidationError).message).toMatch(/positive/i);
	});

	it('toggleTaskCompletion delegates to repository', async () => {
		const toggled: Task = { id: 1, title: 'Buy milk', priority: 2, completedAt: new Date() };

		const result = await Effect.runPromise(
			toggleTaskCompletion(TEST_USER_ID, { id: 1 }).pipe(
				Effect.provide(makeRepo({ toggleCompletion: () => Effect.succeed(toggled) }))
			)
		);

		expect(result).toEqual(toggled);
	});

	it('toggleTaskCompletion propagates TaskNotFoundError', async () => {
		const result = await Effect.runPromise(
			toggleTaskCompletion(TEST_USER_ID, { id: 99 }).pipe(
				Effect.provide(
					makeRepo({ toggleCompletion: () => Effect.fail(new TaskNotFoundError({ id: 99 })) })
				),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(TaskNotFoundError);
		expect((result as TaskNotFoundError).id).toBe(99);
	});

	it('removeTask delegates to repository', async () => {
		const result = await Effect.runPromise(
			removeTask(TEST_USER_ID, { id: 1 }).pipe(Effect.provide(makeRepo()))
		);
		expect(result).toBeUndefined();
	});

	it('removeTask propagates TaskNotFoundError', async () => {
		const result = await Effect.runPromise(
			removeTask(TEST_USER_ID, { id: 99 }).pipe(
				Effect.provide(
					makeRepo({ softDelete: () => Effect.fail(new TaskNotFoundError({ id: 99 })) })
				),
				Effect.flip
			)
		);

		expect(result).toBeInstanceOf(TaskNotFoundError);
		expect((result as TaskNotFoundError).id).toBe(99);
	});
});
