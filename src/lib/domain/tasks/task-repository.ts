import { Context, Effect } from 'effect';
import type { Task, CreateTaskInput } from './task.js';
import type { TaskRepositoryError, TaskNotFoundError } from './errors.js';

export interface TaskRepository {
	create(input: CreateTaskInput): Effect.Effect<Task, TaskRepositoryError>;
	findAll(): Effect.Effect<Task[], TaskRepositoryError>;
	toggleCompletion(id: number): Effect.Effect<Task, TaskRepositoryError | TaskNotFoundError>;
	softDelete(id: number): Effect.Effect<void, TaskRepositoryError | TaskNotFoundError>;
}

export const TaskRepository = Context.GenericTag<TaskRepository>('TaskRepository');
