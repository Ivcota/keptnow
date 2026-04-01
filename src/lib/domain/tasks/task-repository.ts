import { Context, Effect } from 'effect';
import type { Task, CreateTaskInput } from './task.js';
import type { TaskRepositoryError, TaskNotFoundError } from './errors.js';

export class TaskRepository extends Context.Tag('TaskRepository')<
	TaskRepository,
	{
		readonly create: (
			userId: string,
			input: CreateTaskInput
		) => Effect.Effect<Task, TaskRepositoryError>;
		readonly findAll: (userId: string) => Effect.Effect<Task[], TaskRepositoryError>;
		readonly toggleCompletion: (
			userId: string,
			id: number
		) => Effect.Effect<Task, TaskRepositoryError | TaskNotFoundError>;
		readonly softDelete: (
			userId: string,
			id: number
		) => Effect.Effect<void, TaskRepositoryError | TaskNotFoundError>;
	}
>() {}
