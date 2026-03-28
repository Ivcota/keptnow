<script lang="ts">
	import { resolve } from '$app/paths';

	const demos = [
		{ href: resolve('/demo/better-auth'), title: 'Better Auth', description: 'Authentication flow with sign in & sign up' },
		{ href: resolve('/demo/tasks'), title: 'Tasks', description: 'Task management with create, complete & delete' }
	];
</script>

<div class="flex min-h-screen flex-col bg-[#f8f6f3]">
	<nav class="border-b border-[#e8e2d9] bg-white">
		<div class="mx-auto flex max-w-5xl items-center px-6 py-4">
			<h1 class="font-[Cormorant_Garamond,serif] text-xl font-bold tracking-wide text-[#1a1714]">
				KeptNow
			</h1>
			<span class="ml-3 rounded-md bg-[#eee9e2] px-2 py-0.5 text-xs font-medium text-[#8a8279]">demos</span>
		</div>
	</nav>

	<main class="mx-auto w-full max-w-5xl px-6 py-10">
		<h2 class="mb-2 text-2xl font-semibold text-[#1a1714]">Demo Sections</h2>
		<p class="mb-8 text-sm text-[#8a8279]">Explore the individual feature demos below.</p>

		<div class="grid gap-4 sm:grid-cols-2">
			{#each demos as demo}
				<a
					href={demo.href}
					class="group rounded-xl border border-[#e8e2d9] bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c4a46a66] hover:shadow-md"
				>
					<h3 class="mb-1 text-lg font-semibold text-[#1a1714] group-hover:text-[#c4a46a]">
						{demo.title}
					</h3>
					<p class="text-sm text-[#8a8279]">{demo.description}</p>
					<span class="mt-4 inline-block text-sm font-medium text-[#c4a46a]">
						Open &rarr;
					</span>
				</a>
			{/each}
		</div>
	</main>
</div>
