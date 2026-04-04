import { describe, it, expect, vi } from 'vitest';
import { Context, Effect, Layer } from 'effect';
import { CanonicalIngredientResolver } from '$lib/domain/shared/canonical-ingredient-resolver.js';
import type { CanonicalIngredient } from '$lib/domain/shared/canonical-ingredient.js';
import { FoodItemRepository } from './food-item-repository.js';
import { resolveAndPatchCanonicalName } from './use-cases.js';
import { FoodItemRepositoryError } from './errors.js';

const TEST_USER_ID = 'user-1';
const TEST_HOUSEHOLD_ID = 'household-1';

const makeIngredient = (overrides: Partial<CanonicalIngredient> = {}): CanonicalIngredient => ({
	id: 1,
	name: 'milk',
	unitCategory: 'volume',
	...overrides
});

const makeResolver = (impl: Partial<Context.Tag.Service<CanonicalIngredientResolver>> = {}) =>
	Layer.succeed(CanonicalIngredientResolver, {
		resolve: () => Effect.succeed(makeIngredient()),
		...impl
	} as Context.Tag.Service<CanonicalIngredientResolver>);

const makeRepo = (impl: Partial<Context.Tag.Service<FoodItemRepository>> = {}) =>
	Layer.succeed(FoodItemRepository, {
		create: () => Effect.die('not used'),
		bulkCreate: () => Effect.die('not used'),
		findAll: () => Effect.die('not used'),
		update: () => Effect.die('not used'),
		trash: () => Effect.die('not used'),
		restore: () => Effect.die('not used'),
		findTrashed: () => Effect.die('not used'),
		patchCanonicalName: () => Effect.succeed(undefined as void),
		trashAll: () => Effect.die('not used'),
		...impl
	} as Context.Tag.Service<FoodItemRepository>);

describe('resolveAndPatchCanonicalName', () => {
	it('calls resolver with item name and patches the canonical name', async () => {
		const patchSpy = vi.fn(() => Effect.succeed(undefined as void));

		await Effect.runPromise(
			resolveAndPatchCanonicalName(TEST_HOUSEHOLD_ID, TEST_USER_ID, 1, 'Whole Milk').pipe(
				Effect.provide(makeResolver({ resolve: () => Effect.succeed(makeIngredient({ name: 'milk' })) })),
				Effect.provide(makeRepo({ patchCanonicalName: patchSpy }))
			)
		);

		expect(patchSpy).toHaveBeenCalledWith(TEST_HOUSEHOLD_ID, TEST_USER_ID, 1, 'milk');
	});

	it('propagates resolver error so caller can swallow it', async () => {
		const error = new Error('AI unavailable');

		const result = await Effect.runPromise(
			resolveAndPatchCanonicalName(TEST_HOUSEHOLD_ID, TEST_USER_ID, 2, 'Chicken Breast').pipe(
				Effect.provide(makeResolver({ resolve: () => Effect.fail(error) })),
				Effect.provide(makeRepo()),
				Effect.flip
			)
		);

		expect(result).toBe(error);
	});

	it('does not call patchCanonicalName when resolver fails', async () => {
		const patchSpy = vi.fn(() => Effect.succeed(undefined as void));

		await Effect.runPromise(
			resolveAndPatchCanonicalName(TEST_HOUSEHOLD_ID, TEST_USER_ID, 3, 'Eggs').pipe(
				Effect.provide(makeResolver({ resolve: () => Effect.fail(new Error('fail')) })),
				Effect.provide(makeRepo({ patchCanonicalName: patchSpy })),
				Effect.catchAll(() => Effect.void)
			)
		);

		expect(patchSpy).not.toHaveBeenCalled();
	});

	it('propagates repository error when patch fails', async () => {
		const repoError = new FoodItemRepositoryError({ message: 'DB down', cause: null });

		const result = await Effect.runPromise(
			resolveAndPatchCanonicalName(TEST_HOUSEHOLD_ID, TEST_USER_ID, 4, 'Butter').pipe(
				Effect.provide(makeResolver({ resolve: () => Effect.succeed(makeIngredient({ name: 'butter' })) })),
				Effect.provide(makeRepo({ patchCanonicalName: () => Effect.fail(repoError) })),
				Effect.flip
			)
		);

		expect(result).toBe(repoError);
	});
});
