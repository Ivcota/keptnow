import { Context, Effect } from 'effect';
import type { CanonicalIngredient } from './canonical-ingredient.js';

export interface CanonicalIngredientResolver {
	resolve(name: string): Effect.Effect<CanonicalIngredient, Error>;
}

export const CanonicalIngredientResolver =
	Context.GenericTag<CanonicalIngredientResolver>('CanonicalIngredientResolver');
