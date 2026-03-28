import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import { TaskRepository } from '$lib/domain/tasks/task-repository.js';
import { TaskNotFoundError } from '$lib/domain/tasks/errors.js';
import { DrizzleTaskRepository } from './drizzle-task-repository.js';
import { DatabaseLive } from './database.js';

const dbAvailable = !!process.env.DATABASE_URL;

describe.skipIf(!dbAvailable)('DrizzleTaskRepository (integration — requires PostgreSQL)', () => {
	const testLayer = DrizzleTaskRepository.pipe(Layer.provide(DatabaseLive));

	it('create inserts a row and findAll retrieves it', async () => {
		const { created, all } = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				const created = yield* repo.create({ title: 'Integration test task', priority: 3 });
				const all = yield* repo.findAll();
				return { created, all };
			}).pipe(Effect.provide(testLayer))
		);

		expect(created.title).toBe('Integration test task');
		expect(created.priority).toBe(3);
		expect(created.id).toBeTypeOf('number');
		expect(created.completedAt).toBeNull();
		expect(all.some((t) => t.id === created.id)).toBe(true);
	});

	it('toggleCompletion marks a task as completed', async () => {
		const { created, toggled } = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				const created = yield* repo.create({ title: 'Toggle test task', priority: 1 });
				const toggled = yield* repo.toggleCompletion(created.id);
				return { created, toggled };
			}).pipe(Effect.provide(testLayer))
		);

		expect(created.completedAt).toBeNull();
		expect(toggled.completedAt).toBeInstanceOf(Date);
	});

	it('toggleCompletion unmarks a completed task', async () => {
		const { toggled1, toggled2 } = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				const created = yield* repo.create({ title: 'Toggle off test task', priority: 1 });
				const toggled1 = yield* repo.toggleCompletion(created.id);
				const toggled2 = yield* repo.toggleCompletion(created.id);
				return { toggled1, toggled2 };
			}).pipe(Effect.provide(testLayer))
		);

		expect(toggled1.completedAt).toBeInstanceOf(Date);
		expect(toggled2.completedAt).toBeNull();
	});

	it('toggleCompletion returns TaskNotFoundError for non-existent task', async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				return yield* repo.toggleCompletion(999999).pipe(Effect.flip);
			}).pipe(Effect.provide(testLayer))
		);

		expect(result).toBeInstanceOf(TaskNotFoundError);
	});

	it('softDelete sets deleted_at and findAll excludes the task', async () => {
		const { created, allBefore, allAfter } = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				const created = yield* repo.create({ title: 'Soft delete test', priority: 1 });
				const allBefore = yield* repo.findAll();
				yield* repo.softDelete(created.id);
				const allAfter = yield* repo.findAll();
				return { created, allBefore, allAfter };
			}).pipe(Effect.provide(testLayer))
		);

		expect(allBefore.some((t) => t.id === created.id)).toBe(true);
		expect(allAfter.some((t) => t.id === created.id)).toBe(false);
	});

	it('softDelete returns TaskNotFoundError for non-existent task', async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				return yield* repo.softDelete(999999).pipe(Effect.flip);
			}).pipe(Effect.provide(testLayer))
		);

		expect(result).toBeInstanceOf(TaskNotFoundError);
	});

	it('softDelete returns TaskNotFoundError on double-delete', async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				const created = yield* repo.create({ title: 'Double delete test', priority: 1 });
				yield* repo.softDelete(created.id);
				return yield* repo.softDelete(created.id).pipe(Effect.flip);
			}).pipe(Effect.provide(testLayer))
		);

		expect(result).toBeInstanceOf(TaskNotFoundError);
	});

	it('toggleCompletion returns TaskNotFoundError on soft-deleted task', async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				const created = yield* repo.create({ title: 'Toggle on deleted', priority: 1 });
				yield* repo.softDelete(created.id);
				return yield* repo.toggleCompletion(created.id).pipe(Effect.flip);
			}).pipe(Effect.provide(testLayer))
		);

		expect(result).toBeInstanceOf(TaskNotFoundError);
	});

	it('findAll still returns completed tasks', async () => {
		const { toggled, all } = await Effect.runPromise(
			Effect.gen(function* () {
				const repo = yield* TaskRepository;
				const created = yield* repo.create({ title: 'Completed visible task', priority: 1 });
				const toggled = yield* repo.toggleCompletion(created.id);
				const all = yield* repo.findAll();
				return { toggled, all };
			}).pipe(Effect.provide(testLayer))
		);

		expect(toggled.completedAt).toBeInstanceOf(Date);
		expect(all.some((t) => t.id === toggled.id)).toBe(true);
	});
});
