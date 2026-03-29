import { Layer, Effect } from 'effect';
import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { CanonicalIngredientResolver } from '$lib/domain/shared/canonical-ingredient-resolver.js';
import type { UnitCategory } from '$lib/domain/shared/canonical-ingredient.js';
import { Database } from './database.js';
import { canonicalIngredient } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

const ResolvedIngredientSchema = z.object({
	canonicalName: z.string().describe('Lowercase canonical ingredient name, e.g. "milk", "flour"'),
	unitCategory: z
		.enum(['volume', 'mass', 'count'])
		.describe(
			'How this ingredient is typically measured: volume (cups, ml), mass (grams, lb), or count (eggs, items)'
		)
});

async function resolveViaAI(
	name: string
): Promise<{ canonicalName: string; unitCategory: UnitCategory }> {
	const result = await generateObject({
		model: createAnthropic({ apiKey: ANTHROPIC_API_KEY })('claude-haiku-4-5-20251001'),
		schema: ResolvedIngredientSchema,
		system: `You are a food ingredient classifier. Given a food item name, return:
1. A canonical lowercase ingredient name (e.g. "Whole Milk" → "milk", "Chicken Breast" → "chicken")
2. The unit category for how this ingredient is typically measured in recipes:
   - "volume" for liquids and loose goods measured in cups/ml/tbsp (milk, oil, flour, sugar)
   - "mass" for ingredients weighed in grams/pounds (butter, meat, cheese)
   - "count" for discrete items (eggs, apples, cans, packages)

If uncertain between volume and mass, prefer the most common cooking convention.`,
		prompt: name
	});
	return {
		canonicalName: result.object.canonicalName.trim().toLowerCase(),
		unitCategory: result.object.unitCategory
	};
}

export const DrizzleAICanonicalIngredientResolver = Layer.effect(
	CanonicalIngredientResolver,
	Effect.gen(function* () {
		const db = yield* Database;
		return {
			resolve: (name: string) =>
				Effect.tryPromise({
					try: async () => {
						const { canonicalName, unitCategory } = await resolveViaAI(name);

							// Reuse existing entry if name matches; insert on first encounter
						const existing = await db
							.select()
							.from(canonicalIngredient)
							.where(eq(canonicalIngredient.name, canonicalName))
							.limit(1);

						if (existing.length > 0) {
							const row = existing[0];
							return {
								id: row.id,
								name: row.name,
								unitCategory: row.unitCategory as UnitCategory
							};
						}

						const rows = await db
							.insert(canonicalIngredient)
							.values({ name: canonicalName, unitCategory })
							.onConflictDoNothing()
							.returning();

						if (rows.length > 0) {
							const row = rows[0];
							return { id: row.id, name: row.name, unitCategory: row.unitCategory as UnitCategory };
						}

						// Race condition: another process inserted between our SELECT and INSERT
						const refetch = await db
							.select()
							.from(canonicalIngredient)
							.where(eq(canonicalIngredient.name, canonicalName))
							.limit(1);
						const row = refetch[0];
						return { id: row.id, name: row.name, unitCategory: row.unitCategory as UnitCategory };
					},
					catch: (e) => new Error(e instanceof Error ? e.message : String(e))
				})
		};
	})
);
