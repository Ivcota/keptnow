import { describe, it, expect } from 'vitest';
import { Context, Effect, Layer } from 'effect';
import { RecipeRepository } from './recipe-repository.js';
import { RecipeValidationError, RecipeRestoreExpiredError, RecipeNotFoundError } from './errors.js';
import {
	createRecipe,
	updateRecipe,
	restoreRecipe,
	pinRecipe,
	unpinRecipe,
	RESTORE_WINDOW_HOURS
} from './use-cases.js';
import type { Recipe } from './recipe.js';

const baseRecipe: Recipe = {
	id: 1,
	userId: 'user-a',
	name: 'Test Recipe',
	ingredients: [],
	notes: [],
	pinnedAt: null,
	trashedAt: null,
	createdAt: new Date(),
	updatedAt: new Date()
};

const noop = () => Effect.die('not implemented');

function makeRepo(overrides: Partial<Context.Tag.Service<RecipeRepository>>): Layer.Layer<RecipeRepository> {
	return Layer.succeed(RecipeRepository, {
		findAll: noop,
		findTrashed: noop,
		create: noop,
		update: noop,
		trash: noop,
		restore: noop,
		pin: noop,
		unpin: noop,
		...overrides
	} as Context.Tag.Service<RecipeRepository>);
}

describe('createRecipe', () => {
	it('fails with RecipeValidationError for empty recipe name', async () => {
		const layer = makeRepo({ create: () => Effect.succeed(baseRecipe) });

		const error = await Effect.runPromise(
			createRecipe('user-a', { name: '  ', ingredients: [], notes: [] }).pipe(
				Effect.flip,
				Effect.provide(layer)
			)
		);

		expect(error).toBeInstanceOf(RecipeValidationError);
	});

	it('fails with RecipeValidationError for empty ingredient name', async () => {
		const layer = makeRepo({ create: () => Effect.succeed(baseRecipe) });

		const error = await Effect.runPromise(
			createRecipe('user-a', {
				name: 'Valid Name',
				ingredients: [{ name: '', quantity: { value: 1, unit: 'count' } }],
				notes: []
			}).pipe(Effect.flip, Effect.provide(layer))
		);

		expect(error).toBeInstanceOf(RecipeValidationError);
	});

	it('fails with RecipeValidationError for empty note text', async () => {
		const layer = makeRepo({ create: () => Effect.succeed(baseRecipe) });

		const error = await Effect.runPromise(
			createRecipe('user-a', {
				name: 'Valid Name',
				ingredients: [],
				notes: [{ text: '   ' }]
			}).pipe(Effect.flip, Effect.provide(layer))
		);

		expect(error).toBeInstanceOf(RecipeValidationError);
	});

	it('does not call repo when validation fails', async () => {
		let repoCalled = false;
		const layer = makeRepo({
			create: () => {
				repoCalled = true;
				return Effect.succeed(baseRecipe);
			}
		});

		await Effect.runPromise(
			createRecipe('user-a', { name: '', ingredients: [], notes: [] }).pipe(
				Effect.ignore,
				Effect.provide(layer)
			)
		);

		expect(repoCalled).toBe(false);
	});
});

describe('updateRecipe', () => {
	it('fails with RecipeValidationError for empty recipe name', async () => {
		const layer = makeRepo({ update: () => Effect.succeed(baseRecipe) });

		const error = await Effect.runPromise(
			updateRecipe('user-a', { id: 1, name: '', ingredients: [], notes: [] }).pipe(
				Effect.flip,
				Effect.provide(layer)
			)
		);

		expect(error).toBeInstanceOf(RecipeValidationError);
	});

	it('fails with RecipeValidationError for empty ingredient name', async () => {
		const layer = makeRepo({ update: () => Effect.succeed(baseRecipe) });

		const error = await Effect.runPromise(
			updateRecipe('user-a', {
				id: 1,
				name: 'Valid Name',
				ingredients: [{ name: '   ', quantity: { value: 1, unit: 'count' } }],
				notes: []
			}).pipe(Effect.flip, Effect.provide(layer))
		);

		expect(error).toBeInstanceOf(RecipeValidationError);
	});
});

describe('restoreRecipe', () => {
	it('fails with RecipeRestoreExpiredError when trashedAt is beyond 24h window', async () => {
		const now = new Date('2026-01-02T12:00:00Z');
		const trashedAt = new Date('2026-01-01T11:00:00Z'); // 25 hours before now
		const trashedRecipe = { ...baseRecipe, trashedAt };
		const layer = makeRepo({ restore: () => Effect.succeed(trashedRecipe) });

		const error = await Effect.runPromise(
			restoreRecipe('user-a', 1, now).pipe(Effect.flip, Effect.provide(layer))
		);

		expect(error).toBeInstanceOf(RecipeRestoreExpiredError);
	});

	it('succeeds when trashedAt is within the 24h window', async () => {
		const now = new Date('2026-01-02T12:00:00Z');
		const trashedAt = new Date('2026-01-01T13:00:00Z'); // 23 hours before now
		const trashedRecipe = { ...baseRecipe, trashedAt };
		const layer = makeRepo({ restore: () => Effect.succeed(trashedRecipe) });

		const result = await Effect.runPromise(
			restoreRecipe('user-a', 1, now).pipe(Effect.as('ok'), Effect.provide(layer))
		);
		expect(result).toBe('ok');
	});

	it('treats exactly 24h as within the window', async () => {
		const now = new Date('2026-01-02T12:00:00Z');
		const trashedAt = new Date(now.getTime() - RESTORE_WINDOW_HOURS * 60 * 60 * 1000); // exactly 24h
		const trashedRecipe = { ...baseRecipe, trashedAt };
		const layer = makeRepo({ restore: () => Effect.succeed(trashedRecipe) });

		// Exactly 24h is NOT > 24h, so it should succeed
		const result = await Effect.runPromise(
			restoreRecipe('user-a', 1, now).pipe(Effect.as('ok'), Effect.provide(layer))
		);
		expect(result).toBe('ok');
	});
});

describe('pinRecipe', () => {
	it('calls repo.pin with the correct userId and id', async () => {
		let capturedUserId: string | null = null;
		let capturedId: number | null = null;
		const layer = makeRepo({
			pin: (userId, id) => {
				capturedUserId = userId;
				capturedId = id;
				return Effect.void;
			}
		});

		await Effect.runPromise(pinRecipe('user-a', 42).pipe(Effect.provide(layer)));

		expect(capturedUserId).toBe('user-a');
		expect(capturedId).toBe(42);
	});

	it('propagates RecipeNotFoundError from repo', async () => {
		const layer = makeRepo({
			pin: (_, id) => Effect.fail(new RecipeNotFoundError({ id }))
		});

		const error = await Effect.runPromise(
			pinRecipe('user-a', 42).pipe(Effect.flip, Effect.provide(layer))
		);

		expect(error).toBeInstanceOf(RecipeNotFoundError);
	});
});

describe('unpinRecipe', () => {
	it('calls repo.unpin with the correct userId and id', async () => {
		let capturedUserId: string | null = null;
		let capturedId: number | null = null;
		const layer = makeRepo({
			unpin: (userId, id) => {
				capturedUserId = userId;
				capturedId = id;
				return Effect.void;
			}
		});

		await Effect.runPromise(unpinRecipe('user-a', 7).pipe(Effect.provide(layer)));

		expect(capturedUserId).toBe('user-a');
		expect(capturedId).toBe(7);
	});

	it('propagates RecipeNotFoundError from repo', async () => {
		const layer = makeRepo({
			unpin: (_, id) => Effect.fail(new RecipeNotFoundError({ id }))
		});

		const error = await Effect.runPromise(
			unpinRecipe('user-a', 7).pipe(Effect.flip, Effect.provide(layer))
		);

		expect(error).toBeInstanceOf(RecipeNotFoundError);
	});
});
