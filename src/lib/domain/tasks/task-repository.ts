import { Context, Effect } from 'effect';
import type { Task, CreateTaskInput } from './task.js';
import type { TaskRepositoryError } from './errors.js';

export interface TaskRepository {
	create(input: CreateTaskInput): Effect.Effect<Task, TaskRepositoryError>;
	findAll(): Effect.Effect<Task[], TaskRepositoryError>;
}

export const TaskRepository = Context.GenericTag<TaskRepository>('TaskRepository');
