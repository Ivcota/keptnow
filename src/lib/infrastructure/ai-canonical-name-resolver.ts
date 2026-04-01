import { Context, Effect } from 'effect';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { CanonicalNameResolver } from '$lib/domain/inventory/canonical-name-resolver.js';

type CanonicalNameResolverService = Context.Tag.Service<CanonicalNameResolver>;

const SYSTEM_PROMPT = `You are a food ingredient normalizer. Given a food item name, return a single canonical ingredient name in lowercase. Return only the canonical name, nothing else.

Examples:
- "Whole Milk" → "milk"
- "Chicken Breast" → "chicken"
- "Unsalted Butter" → "butter"
- "All-Purpose Flour" → "flour"
- "Organic Baby Spinach" → "spinach"
- "Roma Tomatoes" → "tomatoes"

If the item is not a recognizable basic ingredient, return the item name lowercased.`;

export const AICanonicalNameResolver: CanonicalNameResolverService = {
	resolve: (name) =>
		Effect.tryPromise({
			try: async () => {
				const result = await generateText({
					model: createAnthropic({ apiKey: ANTHROPIC_API_KEY })('claude-haiku-4-5-20251001'),
					system: SYSTEM_PROMPT,
					prompt: name
				});
				return result.text.trim().toLowerCase();
			},
			catch: (e) => new Error(e instanceof Error ? e.message : String(e))
		})
};
