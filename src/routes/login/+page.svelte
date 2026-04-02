<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { form, data }: { form: ActionData; data: PageData } = $props();
	let mode: 'signin' | 'signup' | 'forgot' = $state(
		(data.initialMode as 'signin' | 'forgot') ?? 'signin'
	);
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

			{#if mode !== 'forgot'}
				<!-- Mode toggle -->
				<div class="mb-8 flex rounded-lg bg-[#eee9e2] p-1">
					<button
						type="button"
						onclick={() => (mode = 'signin')}
						class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 {mode ===
						'signin'
							? 'bg-white text-[#1a1714] shadow-sm'
							: 'text-[#8a8279] hover:text-[#6b6560]'}"
					>
						Sign In
					</button>
					<button
						type="button"
						onclick={() => (mode = 'signup')}
						class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 {mode ===
						'signup'
							? 'bg-white text-[#1a1714] shadow-sm'
							: 'text-[#8a8279] hover:text-[#6b6560]'}"
					>
						Sign Up
					</button>
				</div>
			{/if}

			{#if mode === 'forgot'}
				<h2 class="mb-2 text-2xl font-semibold text-[#1a1714]">Forgot your password?</h2>
				<p class="mb-6 text-sm text-[#8a8279]">
					Enter your email and we'll send you a reset link.
				</p>

				{#if form?.success}
					<p
						class="rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-700"
					>
						If that email has an account, you'll receive a password reset link shortly.
					</p>
					<p class="mt-6 text-center text-sm text-[#8a8279]">
						<button
							type="button"
							onclick={() => (mode = 'signin')}
							class="font-medium text-[#c4a46a] hover:text-[#b3935a]"
						>
							Back to sign in
						</button>
					</p>
				{:else}
					<form method="post" action="?/forgotPassword" use:enhance class="flex flex-col gap-4">
						<div class="flex flex-col gap-1.5">
							<label for="forgot-email" class="text-sm font-medium text-[#3a3632]">Email</label>
							<input
								id="forgot-email"
								name="email"
								type="email"
								placeholder="you@example.com"
								required
								class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
							/>
						</div>

						<button
							type="submit"
							class="mt-2 rounded-lg bg-[#c4a46a] px-4 py-2.5 text-sm font-semibold tracking-wide text-[#1a1714] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a] hover:shadow-md active:translate-y-0"
						>
							Send reset link
						</button>
					</form>

					<p class="mt-6 text-center text-sm text-[#8a8279]">
						<button
							type="button"
							onclick={() => (mode = 'signin')}
							class="font-medium text-[#c4a46a] hover:text-[#b3935a]"
						>
							Back to sign in
						</button>
					</p>
				{/if}
			{:else}
				<h2 class="mb-2 text-2xl font-semibold text-[#1a1714]">
					{mode === 'signin' ? 'Welcome back' : 'Create your account'}
				</h2>
				<p class="mb-6 text-sm text-[#8a8279]">
					{mode === 'signin'
						? 'Enter your credentials to access your dashboard.'
						: 'Get started with KeptNow today.'}
				</p>

				<form
					method="post"
					action={mode === 'signin' ? '?/signInEmail' : '?/signUpEmail'}
					use:enhance
					class="flex flex-col gap-4"
				>
					{#if mode === 'signup'}
						<div class="flex flex-col gap-1.5">
							<label for="name" class="text-sm font-medium text-[#3a3632]">Name</label>
							<input
								id="name"
								name="name"
								type="text"
								placeholder="Your full name"
								class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
							/>
						</div>
					{/if}

					<div class="flex flex-col gap-1.5">
						<label for="email" class="text-sm font-medium text-[#3a3632]">Email</label>
						<input
							id="email"
							name="email"
							type="email"
							placeholder="you@example.com"
							required
							class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
						/>
					</div>

					<div class="flex flex-col gap-1.5">
						<div class="flex items-center justify-between">
							<label for="password" class="text-sm font-medium text-[#3a3632]">Password</label>
							{#if mode === 'signin'}
								<button
									type="button"
									onclick={() => (mode = 'forgot')}
									class="text-xs text-[#c4a46a] hover:text-[#b3935a]"
								>
									Forgot password?
								</button>
							{/if}
						</div>
						<input
							id="password"
							name="password"
							type="password"
							placeholder="••••••••"
							required
							class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
						/>
					</div>

					{#if form?.message}
						<p
							class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600"
						>
							{form.message}
						</p>
					{/if}

					<button
						type="submit"
						class="mt-2 rounded-lg bg-[#c4a46a] px-4 py-2.5 text-sm font-semibold tracking-wide text-[#1a1714] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a] hover:shadow-md active:translate-y-0"
					>
						{mode === 'signin' ? 'Sign In' : 'Create Account'}
					</button>
				</form>

				<p class="mt-6 text-center text-sm text-[#8a8279]">
					{#if mode === 'signin'}
						Don&apos;t have an account?
						<button
							type="button"
							onclick={() => (mode = 'signup')}
							class="font-medium text-[#c4a46a] hover:text-[#b3935a]"
						>
							Sign up
						</button>
					{:else}
						Already have an account?
						<button
							type="button"
							onclick={() => (mode = 'signin')}
							class="font-medium text-[#c4a46a] hover:text-[#b3935a]"
						>
							Sign in
						</button>
					{/if}
				</p>
			{/if}
		</div>
	</div>
</div>
