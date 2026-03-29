import { pgTable, serial, integer, text, timestamp, numeric, pgEnum, boolean, unique } from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';

export const storageLocationEnum = pgEnum('storage_location', ['pantry', 'fridge', 'freezer']);
export const trackingTypeEnum = pgEnum('tracking_type', ['amount', 'count']);

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1),
	completedAt: timestamp('completed_at'),
	deletedAt: timestamp('deleted_at')
});

export const foodItem = pgTable('food_item', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	canonicalName: text('canonical_name'),
	storageLocation: storageLocationEnum('storage_location').notNull(),
	trackingType: trackingTypeEnum('tracking_type').notNull(),
	amount: numeric('amount'),
	quantity: integer('quantity'),
	expirationDate: timestamp('expiration_date'),
	trashedAt: timestamp('trashed_at'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const recipe = pgTable('recipe', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	pinnedAt: timestamp('pinned_at'),
	trashedAt: timestamp('trashed_at'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const recipeIngredient = pgTable('recipe_ingredient', {
	id: serial('id').primaryKey(),
	recipeId: integer('recipe_id')
		.notNull()
		.references(() => recipe.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	canonicalName: text('canonical_name'),
	quantity: text('quantity'),
	unit: text('unit')
});

export const shoppingListSourceTypeEnum = pgEnum('shopping_list_source_type', ['restock', 'recipe']);

export const shoppingListItem = pgTable('shopping_list_item', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	canonicalKey: text('canonical_key').notNull(),
	displayName: text('display_name').notNull(),
	checked: boolean('checked').notNull().default(false),
	sourceType: shoppingListSourceTypeEnum('source_type').notNull(),
	sourceRestockItemId: integer('source_restock_item_id'),
	sourceRecipeNames: text('source_recipe_names').array(),
	carriedStorageLocation: storageLocationEnum('carried_storage_location').notNull(),
	carriedTrackingType: trackingTypeEnum('carried_tracking_type').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
}, (t) => [
	unique().on(t.userId, t.canonicalKey)
]);

export const canonicalIngredient = pgTable('canonical_ingredient', {
	id: serial('id').primaryKey(),
	name: text('name').notNull().unique(),
	unitCategory: text('unit_category').notNull()
});

export * from './auth.schema';
