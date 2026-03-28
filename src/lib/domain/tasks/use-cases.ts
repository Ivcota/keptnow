import { Effect } from 'effect';
import { TaskRepository } from './task-repository.js';
import { TaskValidationError, TaskRepositoryError, TaskNotFoundError } from './errors.js';
import type { Task, CreateTaskInput, CompleteTaskInput, RemoveTaskInput } from './task.js';

export const createTask = (
	userId: string,
	input: CreateTaskInput
): Effect.Effect<Task, TaskValidationError | TaskRepositoryError, TaskRepository> =>
	Effect.gen(function* () {
		if (!input.title.trim()) {
			yield* Effect.fail(new TaskValidationError({ message: 'Title must not be empty' }));
		}
		if (input.priority <= 0) {
			yield* Effect.fail(
				new TaskValidationError({ message: 'Priority must be a positive number' })
			);
		}
		const repo = yield* TaskRepository;
		return yield* repo.create(userId, input);
	});

export const findAllTasks = (
	userId: string
): Effect.Effect<Task[], TaskRepositoryError, TaskRepository> =>
	Effect.gen(function* () {
		const repo = yield* TaskRepository;
		return yield* repo.findAll(userId);
	});

export const toggleTaskCompletion = (
	userId: string,
	input: CompleteTaskInput
): Effect.Effect<Task, TaskRepositoryError | TaskNotFoundError, TaskRepository> =>
	Effect.gen(function* () {
		const repo = yield* TaskRepository;
		return yield* repo.toggleCompletion(userId, input.id);
	});

export const removeTask = (
	userId: string,
	input: RemoveTaskInput
): Effect.Effect<void, TaskRepositoryError | TaskNotFoundError, TaskRepository> =>
	Effect.gen(function* () {
		const repo = yield* TaskRepository;
		yield* repo.softDelete(userId, input.id);
	});
