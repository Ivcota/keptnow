import { fail } from '@sveltejs/kit';
import { Effect } from 'effect';
import type { Actions, PageServerLoad } from './$types';
import { appRuntime } from '$lib/server/runtime';
import { createRecipe, findAllRecipes } from '$lib/domain/recipe/use-cases';
import type { CreateRecipeIngredientInput } from '$lib/domain/recipe/recipe';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const recipes = await appRuntime.runPromise(findAllRecipes(userId).pipe(Effect.orDie));
	return { recipes };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const userId = locals.user.id;
		const formData = await request.formData();

		const name = formData.get('name')?.toString() ?? '';
		const ingredientsRaw = formData.get('ingredients')?.toString() ?? '[]';

		let ingredients: CreateRecipeIngredientInput[];
		try {
			ingredients = JSON.parse(ingredientsRaw);
		} catch {
			return fail(400, { message: 'Invalid ingredients data' });
		}

		const outcome = await appRuntime.runPromise(
			Effect.match(createRecipe(userId, { name, ingredients }), {
				onFailure: (e) =>
					e._tag === 'RecipeValidationError'
						? { ok: false as const, status: 400 as const, message: e.message }
						: { ok: false as const, status: 500 as const, message: 'Database error' },
				onSuccess: () => ({ ok: true as const })
			})
		);

		if (!outcome.ok) return fail(outcome.status, { message: outcome.message });
	}
};
