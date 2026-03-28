import { Effect } from 'effect';
import { TaskRepository } from './task-repository.js';
import { TaskValidationError, TaskRepositoryError, TaskNotFoundError } from './errors.js';
import type { Task, CreateTaskInput, CompleteTaskInput } from './task.js';

export const createTask = (
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
		return yield* repo.create(input);
	});

export const findAllTasks = (): Effect.Effect<Task[], TaskRepositoryError, TaskRepository> =>
	Effect.gen(function* () {
		const repo = yield* TaskRepository;
		return yield* repo.findAll();
	});

export const toggleTaskCompletion = (
	input: CompleteTaskInput
): Effect.Effect<Task, TaskRepositoryError | TaskNotFoundError, TaskRepository> =>
	Effect.gen(function* () {
		const repo = yield* TaskRepository;
		return yield* repo.toggleCompletion(input.id);
	});
