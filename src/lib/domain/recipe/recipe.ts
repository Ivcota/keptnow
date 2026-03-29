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
	trashedAt: Date | null;
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

export interface UpdateRecipeInput {
	id: number;
	name: string;
	ingredients: CreateRecipeIngredientInput[];
}
