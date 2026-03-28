import { ManagedRuntime, Layer } from 'effect';
import { DrizzleTaskRepository } from '$lib/infrastructure/drizzle-task-repository.js';
import { DatabaseLive } from '$lib/infrastructure/database.js';

const AppLive = DrizzleTaskRepository.pipe(Layer.provide(DatabaseLive));

export const appRuntime = ManagedRuntime.make(AppLive);
