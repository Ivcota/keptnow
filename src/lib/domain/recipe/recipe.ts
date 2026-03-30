import type { Quantity } from '$lib/domain/shared/quantity.js';

export interface Ingredient {
	id: number;
	recipeId: number;
	name: string;
	canonicalName: string | null;
	canonicalIngredientId: number | null;
	quantity: Quantity;
}

export interface Note {
	id: number;
	recipeId: number;
	text: string;
}

export interface Recipe {
	id: number;
	userId: string;
	name: string;
	ingredients: Ingredient[];
	notes: Note[];
	pinnedAt: Date | null;
	trashedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateIngredientInput {
	name: string;
	canonicalName?: string | null;
	canonicalIngredientId?: number | null;
	quantity: Quantity;
}

export interface CreateNoteInput {
	text: string;
}

export interface CreateRecipeInput {
	name: string;
	ingredients: CreateIngredientInput[];
	notes: CreateNoteInput[];
}

export interface UpdateRecipeInput {
	id: number;
	name: string;
	ingredients: CreateIngredientInput[];
	notes: CreateNoteInput[];
}
