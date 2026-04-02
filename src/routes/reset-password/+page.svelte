<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<div class="flex min-h-screen">
	<!-- Left: Branding Panel -->
	<div
		class="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-[#1a1714] via-[#252018] to-[#2a2520] p-12 lg:flex"
	>
		<div>
			<h1 class="font-[Cormorant_Garamond,serif] text-2xl font-bold tracking-wide text-[#c4a46a]">
				KeptNow
			</h1>
		</div>
		<div class="relative">
			<div
				class="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,#c4a46a_0%,transparent_70%)] opacity-10"
			></div>
			<h2
				class="mb-4 font-[Cormorant_Garamond,serif] text-4xl leading-tight font-bold text-[#f0e6d3]"
			>
				Your home,<br />thoughtfully managed.
			</h2>
			<p class="max-w-sm text-base leading-relaxed text-[#9a9088]">
				Stay on top of tasks, routines, and everything that keeps your household running smoothly.
			</p>
		</div>
		<p class="text-sm text-[#6b6560]">&copy; 2026 KeptNow</p>
	</div>

	<!-- Right: Form Panel -->
	<div class="flex w-full items-center justify-center bg-[#f8f6f3] px-6 lg:w-1/2">
		<div class="w-full max-w-sm">
			<!-- Mobile logo -->
			<h1
				class="mb-8 text-center font-[Cormorant_Garamond,serif] text-2xl font-bold tracking-wide text-[#1a1714] lg:hidden"
			>
				KeptNow
			</h1>

			<h2 class="mb-2 text-2xl font-semibold text-[#1a1714]">Set a new password</h2>
			<p class="mb-6 text-sm text-[#8a8279]">Enter your new password below.</p>

			<form
				method="post"
				action="?/resetPassword"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						submitting = false;
						await update();
					};
				}}
				class="flex flex-col gap-4"
			>
				<div class="flex flex-col gap-1.5">
					<label for="password" class="text-sm font-medium text-[#3a3632]">New password</label>
					<input
						id="password"
						name="password"
						type="password"
						placeholder="••••••••"
						required
						minlength="8"
						class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label for="confirmPassword" class="text-sm font-medium text-[#3a3632]"
						>Confirm new password</label
					>
					<input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						placeholder="••••••••"
						required
						minlength="8"
						class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
					/>
				</div>

				{#if form?.message}
					<div
						class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600"
					>
						<p>{form.message}</p>
						{#if (form as { tokenError?: boolean })?.tokenError}
							<p class="mt-1">
								<a href="/login?forgot=1" class="font-medium underline hover:text-red-800"
									>Request a new reset email</a
								>
							</p>
						{/if}
					</div>
				{/if}

				<button
					type="submit"
					disabled={submitting}
					class="mt-2 rounded-lg bg-[#c4a46a] px-4 py-2.5 text-sm font-semibold tracking-wide text-[#1a1714] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a] hover:shadow-md active:translate-y-0 disabled:opacity-60"
				>
					{submitting ? 'Resetting…' : 'Reset password'}
				</button>
			</form>

			<p class="mt-6 text-center text-sm text-[#8a8279]">
				<a href="/login" class="font-medium text-[#c4a46a] hover:text-[#b3935a]">Back to sign in</a>
			</p>
		</div>
	</div>
</div>
