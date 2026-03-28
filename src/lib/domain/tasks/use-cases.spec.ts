import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { TaskRepository } from './task-repository.js';
import { createTask, findAllTasks, toggleTaskCompletion } from './use-cases.js';
import { TaskValidationError, TaskNotFoundError } from './errors.js';
import type { Task } from './task.js';

describe('domain/tasks', () => {
	it('createTask delegates to repository', async () => {
		const created: Task = { id: 1, title: 'Buy milk', priority: 2, completedAt: null };

		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed(created),
			findAll: () => Effect.succeed([]),
			toggleCompletion: () => Effect.succeed(created)
		});

		const result = await Effect.runPromise(
			createTask({ title: 'Buy milk', priority: 2 }).pipe(Effect.provide(mockRepo))
		);

		expect(result).toEqual(created);
	});

	it('findAllTasks returns all tasks from repository', async () => {
		const tasks: Task[] = [
			{ id: 1, title: 'Buy milk', priority: 2, completedAt: null },
			{ id: 2, title: 'Walk dog', priority: 1, completedAt: null }
		];

		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed(tasks[0]),
			findAll: () => Effect.succeed(tasks),
			toggleCompletion: () => Effect.succeed(tasks[0])
		});

		const result = await Effect.runPromise(
			findAllTasks().pipe(Effect.provide(mockRepo))
		);

		expect(result).toEqual(tasks);
	});

	it('createTask fails with TaskValidationError for empty title', async () => {
		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed({ id: 1, title: '', priority: 1, completedAt: null }),
			findAll: () => Effect.succeed([]),
			toggleCompletion: () => Effect.succeed({ id: 1, title: '', priority: 1, completedAt: null })
		});

		const result = await Effect.runPromise(
			createTask({ title: '', priority: 1 }).pipe(Effect.provide(mockRepo), Effect.flip)
		);

		expect(result).toBeInstanceOf(TaskValidationError);
		expect((result as TaskValidationError).message).toMatch(/empty/i);
	});

	it('createTask fails with TaskValidationError for non-positive priority', async () => {
		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed({ id: 1, title: 'Test', priority: 0, completedAt: null }),
			findAll: () => Effect.succeed([]),
			toggleCompletion: () =>
				Effect.succeed({ id: 1, title: 'Test', priority: 0, completedAt: null })
		});

		const result = await Effect.runPromise(
			createTask({ title: 'Test', priority: 0 }).pipe(Effect.provide(mockRepo), Effect.flip)
		);

		expect(result).toBeInstanceOf(TaskValidationError);
		expect((result as TaskValidationError).message).toMatch(/positive/i);
	});

	it('toggleTaskCompletion delegates to repository', async () => {
		const toggled: Task = { id: 1, title: 'Buy milk', priority: 2, completedAt: new Date() };

		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed(toggled),
			findAll: () => Effect.succeed([]),
			toggleCompletion: () => Effect.succeed(toggled)
		});

		const result = await Effect.runPromise(
			toggleTaskCompletion({ id: 1 }).pipe(Effect.provide(mockRepo))
		);

		expect(result).toEqual(toggled);
	});

	it('toggleTaskCompletion propagates TaskNotFoundError', async () => {
		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed({ id: 1, title: 'x', priority: 1, completedAt: null }),
			findAll: () => Effect.succeed([]),
			toggleCompletion: () => Effect.fail(new TaskNotFoundError({ id: 99 }))
		});

		const result = await Effect.runPromise(
			toggleTaskCompletion({ id: 99 }).pipe(Effect.provide(mockRepo), Effect.flip)
		);

		expect(result).toBeInstanceOf(TaskNotFoundError);
		expect((result as TaskNotFoundError).id).toBe(99);
	});
});
