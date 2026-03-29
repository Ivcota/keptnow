export interface RecipeIngredient {
	id: number;
	recipeId: number;
	name: string;
	canonicalName: string | null;
	quantity: string | null;
	unit: string | null;
}

export interface Recipe {
	id: number;
	userId: string;
	name: string;
	ingredients: RecipeIngredient[];
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateRecipeIngredientInput {
	name: string;
	canonicalName: string | null;
	quantity: string | null;
	unit: string | null;
}

export interface CreateRecipeInput {
	name: string;
	ingredients: CreateRecipeIngredientInput[];
}
