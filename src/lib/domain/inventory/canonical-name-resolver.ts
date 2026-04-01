import { Context, Effect } from 'effect';

export class CanonicalNameResolver extends Context.Tag('CanonicalNameResolver')<
	CanonicalNameResolver,
	{
		readonly resolve: (name: string) => Effect.Effect<string, Error>;
	}
>() {}
