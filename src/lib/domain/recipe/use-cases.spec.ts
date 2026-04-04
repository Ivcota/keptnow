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

const TEST_HOUSEHOLD_ID = 'household-a';
const TEST_USER_ID = 'user-a';

const baseRecipe: Recipe = {
	id: 1,
	userId: TEST_USER_ID,
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
		unpinAll: noop,
		...overrides
	} as Context.Tag.Service<RecipeRepository>);
}

describe('createRecipe', () => {
	it('fails with RecipeValidationError for empty recipe name', async () => {
		const layer = makeRepo({ create: () => Effect.succeed(baseRecipe) });

		const error = await Effect.runPromise(
			createRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, { name: '  ', ingredients: [], notes: [] }).pipe(
				Effect.flip,
				Effect.provide(layer)
			)
		);

		expect(error).toBeInstanceOf(RecipeValidationError);
	});

	it('fails with RecipeValidationError for empty ingredient name', async () => {
		const layer = makeRepo({ create: () => Effect.succeed(baseRecipe) });

		const error = await Effect.runPromise(
			createRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, {
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
			createRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, {
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
			createRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, { name: '', ingredients: [], notes: [] }).pipe(
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
			updateRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, { id: 1, name: '', ingredients: [], notes: [] }).pipe(
				Effect.flip,
				Effect.provide(layer)
			)
		);

		expect(error).toBeInstanceOf(RecipeValidationError);
	});

	it('fails with RecipeValidationError for empty ingredient name', async () => {
		const layer = makeRepo({ update: () => Effect.succeed(baseRecipe) });

		const error = await Effect.runPromise(
			updateRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, {
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
			restoreRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, 1, now).pipe(Effect.flip, Effect.provide(layer))
		);

		expect(error).toBeInstanceOf(RecipeRestoreExpiredError);
	});

	it('succeeds when trashedAt is within the 24h window', async () => {
		const now = new Date('2026-01-02T12:00:00Z');
		const trashedAt = new Date('2026-01-01T13:00:00Z'); // 23 hours before now
		const trashedRecipe = { ...baseRecipe, trashedAt };
		const layer = makeRepo({ restore: () => Effect.succeed(trashedRecipe) });

		const result = await Effect.runPromise(
			restoreRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, 1, now).pipe(Effect.as('ok'), Effect.provide(layer))
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
			restoreRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, 1, now).pipe(Effect.as('ok'), Effect.provide(layer))
		);
		expect(result).toBe('ok');
	});
});

describe('pinRecipe', () => {
	it('calls repo.pin with the correct householdId, userId and id', async () => {
		let capturedHouseholdId: string | null | undefined = undefined;
		let capturedUserId: string | undefined = undefined;
		let capturedId: number | null = null;
		const layer = makeRepo({
			pin: (householdId, userId, id) => {
				capturedHouseholdId = householdId;
				capturedUserId = userId;
				capturedId = id;
				return Effect.void;
			}
		});

		await Effect.runPromise(pinRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, 42).pipe(Effect.provide(layer)));

		expect(capturedHouseholdId).toBe(TEST_HOUSEHOLD_ID);
		expect(capturedUserId).toBe(TEST_USER_ID);
		expect(capturedId).toBe(42);
	});

	it('propagates RecipeNotFoundError from repo', async () => {
		const layer = makeRepo({
			pin: (_, __, id) => Effect.fail(new RecipeNotFoundError({ id }))
		});

		const error = await Effect.runPromise(
			pinRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, 42).pipe(Effect.flip, Effect.provide(layer))
		);

		expect(error).toBeInstanceOf(RecipeNotFoundError);
	});
});

describe('unpinRecipe', () => {
	it('calls repo.unpin with the correct householdId, userId and id', async () => {
		let capturedHouseholdId: string | null | undefined = undefined;
		let capturedUserId: string | undefined = undefined;
		let capturedId: number | null = null;
		const layer = makeRepo({
			unpin: (householdId, userId, id) => {
				capturedHouseholdId = householdId;
				capturedUserId = userId;
				capturedId = id;
				return Effect.void;
			}
		});

		await Effect.runPromise(unpinRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, 7).pipe(Effect.provide(layer)));

		expect(capturedHouseholdId).toBe(TEST_HOUSEHOLD_ID);
		expect(capturedUserId).toBe(TEST_USER_ID);
		expect(capturedId).toBe(7);
	});

	it('propagates RecipeNotFoundError from repo', async () => {
		const layer = makeRepo({
			unpin: (_, __, id) => Effect.fail(new RecipeNotFoundError({ id }))
		});

		const error = await Effect.runPromise(
			unpinRecipe(TEST_HOUSEHOLD_ID, TEST_USER_ID, 7).pipe(Effect.flip, Effect.provide(layer))
		);

		expect(error).toBeInstanceOf(RecipeNotFoundError);
	});
});
