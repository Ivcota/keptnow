<script lang="ts">
	import { page } from '$app/state';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	const navItems = [
		{ href: '/inventory', label: 'Inventory', icon: 'M3 7h18M3 12h18M3 17h18' },
		{
			href: '/recipes',
			label: 'Recipes',
			icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z'
		},
		{
			href: '/shop',
			label: 'Shop',
			icon: ''
		}
	];
</script>

<div class="flex min-h-screen flex-col bg-[#f8f6f3] font-[Nunito_Sans,sans-serif]">
	<AppHeader user={data.user} />
	{@render children()}
	<nav class="fixed right-0 bottom-0 left-0 z-40 border-t border-[#e8e2d9] bg-white">
		<div class="mx-auto flex max-w-lg">
			{#each navItems as item}
				{@const active = page.url.pathname.startsWith(item.href)}
				<a
					href={item.href}
					class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold transition {active
						? 'text-[#5c4a2a]'
						: 'text-[#b0a090] hover:text-[#8a7a6a]'}"
				>
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						{#if item.label === 'Inventory'}
							<line x1="8" y1="6" x2="21" y2="6" />
							<line x1="8" y1="12" x2="21" y2="12" />
							<line x1="8" y1="18" x2="21" y2="18" />
							<line x1="3" y1="6" x2="3.01" y2="6" />
							<line x1="3" y1="12" x2="3.01" y2="12" />
							<line x1="3" y1="18" x2="3.01" y2="18" />
						{:else}
							<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
							<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
						{/if}
					</svg>
					{item.label}
				</a>
			{/each}
		</div>
	</nav>
</div>
