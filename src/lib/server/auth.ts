import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { household, user as userTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sendPasswordResetEmail } from '$lib/server/email';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: {
		enabled: true,
		sendResetPassword: async ({ user, url }) => {
			await sendPasswordResetEmail(user.email, url);
		}
	},
	databaseHooks: {
		user: {
			create: {
				after: async (newUser) => {
					const householdId = crypto.randomUUID();
					const now = new Date();
					await db.insert(household).values({
						id: householdId,
						name: `${newUser.name}'s Household`,
						createdAt: now,
						updatedAt: now
					});
					await db
						.update(userTable)
						.set({ householdId, householdRole: 'owner' })
						.where(eq(userTable.id, newUser.id));
				}
			}
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
