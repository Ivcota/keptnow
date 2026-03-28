<script lang='ts'>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	const initials = data.user.name
		? data.user.name
				.split(' ')
				.map((n: string) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2)
		: '?';
</script>

<div class="flex min-h-screen flex-col bg-[#f8f6f3]">
	<!-- Nav -->
	<nav class="border-b border-[#e8e2d9] bg-white">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
			<div class="flex items-center gap-3">
				<a
					href={resolve('/demo')}
					class="rounded-lg border border-[#ddd6cc] bg-white px-2.5 py-1.5 text-sm text-[#8a8279] shadow-sm transition-all duration-200 hover:bg-[#f0ebe4] hover:text-[#3a3632]"
				>
					&larr; Demos
				</a>
				<h1 class="font-[Cormorant_Garamond,serif] text-xl font-bold tracking-wide text-[#1a1714]">
					Home Maker Assist
				</h1>
			</div>
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-3">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-full bg-[#c4a46a] text-sm font-semibold text-[#1a1714]"
					>
						{initials}
					</div>
					<div class="hidden sm:block">
						<p class="text-sm font-medium text-[#1a1714]">{data.user.name}</p>
						<p class="text-xs text-[#8a8279]">{data.user.email}</p>
					</div>
				</div>
				<form method="post" action="?/signOut" use:enhance>
					<button
						type="submit"
						class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2 text-sm font-medium text-[#3a3632] shadow-sm transition-all duration-200 hover:bg-[#f0ebe4] active:bg-[#e8e2d9]"
					>
						Sign out
					</button>
				</form>
			</div>
		</div>
	</nav>

	<!-- Content -->
	<main class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
		<!-- Welcome card -->
		<div
			class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1714] via-[#252018] to-[#2a2520] p-8 sm:p-10"
		>
			<div
				class="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[radial-gradient(circle,#c4a46a_0%,transparent_70%)] opacity-15"
			></div>
			<div
				class="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-[radial-gradient(circle,#c4a46a_0%,transparent_70%)] opacity-10"
			></div>

			<span class="mb-3 inline-block text-xs font-semibold tracking-[0.2em] text-[#c4a46a]">
				DASHBOARD
			</span>
			<h2
				class="mb-3 font-[Cormorant_Garamond,serif] text-3xl font-bold leading-tight text-[#f0e6d3] sm:text-4xl"
			>
				Welcome back, {data.user.name?.split(' ')[0] ?? 'there'}
			</h2>
			<p class="max-w-xl text-base leading-relaxed text-[#9a9088]">
				Your household is running smoothly. Here's your overview.
			</p>
		</div>

		<!-- Info cards -->
		<div class="mt-8 grid gap-4 sm:grid-cols-3">
			<div class="rounded-xl border border-[#e8e2d9] bg-white p-6">
				<p class="mb-1 text-xs font-semibold tracking-[0.15em] text-[#8a8279]">ACCOUNT</p>
				<p class="text-lg font-semibold text-[#1a1714]">{data.user.name}</p>
				<p class="text-sm text-[#8a8279]">{data.user.email}</p>
			</div>
			<div class="rounded-xl border border-[#e8e2d9] bg-white p-6">
				<p class="mb-1 text-xs font-semibold tracking-[0.15em] text-[#8a8279]">USER ID</p>
				<p class="truncate font-mono text-sm text-[#3a3632]">{data.user.id}</p>
			</div>
			<div class="rounded-xl border border-[#e8e2d9] bg-white p-6">
				<p class="mb-1 text-xs font-semibold tracking-[0.15em] text-[#8a8279]">STATUS</p>
				<div class="flex items-center gap-2">
					<span class="inline-block h-2 w-2 rounded-full bg-[#6b8f71]"></span>
					<span class="text-sm font-medium text-[#3a3632]">Authenticated</span>
				</div>
			</div>
		</div>
	</main>
</div>
