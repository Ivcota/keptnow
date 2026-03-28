import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { TaskRepository } from './task-repository.js';
import { createTask, findAllTasks } from './use-cases.js';
import { TaskValidationError } from './errors.js';
import type { Task } from './task.js';

describe('domain/tasks', () => {
	it('createTask delegates to repository', async () => {
		const created: Task = { id: 1, title: 'Buy milk', priority: 2 };

		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed(created),
			findAll: () => Effect.succeed([])
		});

		const result = await Effect.runPromise(
			createTask({ title: 'Buy milk', priority: 2 }).pipe(Effect.provide(mockRepo))
		);

		expect(result).toEqual(created);
	});

	it('findAllTasks returns all tasks from repository', async () => {
		const tasks: Task[] = [
			{ id: 1, title: 'Buy milk', priority: 2 },
			{ id: 2, title: 'Walk dog', priority: 1 }
		];

		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed(tasks[0]),
			findAll: () => Effect.succeed(tasks)
		});

		const result = await Effect.runPromise(
			findAllTasks().pipe(Effect.provide(mockRepo))
		);

		expect(result).toEqual(tasks);
	});

	it('createTask fails with TaskValidationError for empty title', async () => {
		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed({ id: 1, title: '', priority: 1 }),
			findAll: () => Effect.succeed([])
		});

		const result = await Effect.runPromise(
			createTask({ title: '', priority: 1 }).pipe(Effect.provide(mockRepo), Effect.flip)
		);

		expect(result).toBeInstanceOf(TaskValidationError);
		expect((result as TaskValidationError).message).toMatch(/empty/i);
	});

	it('createTask fails with TaskValidationError for non-positive priority', async () => {
		const mockRepo = Layer.succeed(TaskRepository, {
			create: () => Effect.succeed({ id: 1, title: 'Test', priority: 0 }),
			findAll: () => Effect.succeed([])
		});

		const result = await Effect.runPromise(
			createTask({ title: 'Test', priority: 0 }).pipe(Effect.provide(mockRepo), Effect.flip)
		);

		expect(result).toBeInstanceOf(TaskValidationError);
		expect((result as TaskValidationError).message).toMatch(/positive/i);
	});
});
