import { Context, Effect } from 'effect';
import type { CanonicalIngredient } from './canonical-ingredient.js';

export class CanonicalIngredientResolver extends Context.Tag('CanonicalIngredientResolver')<
	CanonicalIngredientResolver,
	{
		readonly resolve: (name: string) => Effect.Effect<CanonicalIngredient, Error>;
	}
>() {}
