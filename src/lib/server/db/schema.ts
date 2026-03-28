import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1),
	completedAt: timestamp('completed_at'),
	deletedAt: timestamp('deleted_at')
});

export *  from './auth.schema';
