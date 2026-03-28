import { Context, Effect } from 'effect';
import type { Task, CreateTaskInput } from './task.js';
import type { TaskRepositoryError, TaskNotFoundError } from './errors.js';

export interface TaskRepository {
	create(userId: string, input: CreateTaskInput): Effect.Effect<Task, TaskRepositoryError>;
	findAll(userId: string): Effect.Effect<Task[], TaskRepositoryError>;
	toggleCompletion(
		userId: string,
		id: number
	): Effect.Effect<Task, TaskRepositoryError | TaskNotFoundError>;
	softDelete(userId: string, id: number): Effect.Effect<void, TaskRepositoryError | TaskNotFoundError>;
}

export const TaskRepository = Context.GenericTag<TaskRepository>('TaskRepository');
