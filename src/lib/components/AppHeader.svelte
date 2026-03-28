<script lang="ts">
	import { enhance } from '$app/forms';

	let { user }: { user: { name: string | null; email: string } } = $props();
	let dropdownOpen = $state(false);

	const initials = user.name
		? user.name
				.split(' ')
				.map((n: string) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2)
		: '?';
</script>

<svelte:window onclick={() => (dropdownOpen = false)} />

<header class="sticky top-0 z-50 border-b border-[#e8e2d9] bg-white/95 backdrop-blur-sm">
	<nav class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
		<a
			href="/inventory"
			class="font-[Cormorant_Garamond,serif] text-xl font-bold tracking-wide text-[#1a1714] transition-colors hover:text-[#c4a46a]"
		>
			KeptNow
		</a>

		<!-- User menu -->
		<div class="relative">
			<button
				type="button"
				onclick={(e) => { e.stopPropagation(); dropdownOpen = !dropdownOpen; }}
				class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#f0ebe4]"
			>
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full bg-[#c4a46a] text-xs font-semibold text-[#1a1714]"
				>
					{initials}
				</div>
				<span class="hidden text-sm font-medium text-[#3a3632] sm:block">
					{user.name ?? user.email}
				</span>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="hidden text-[#8a8279] sm:block"
					aria-hidden="true"
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</button>

			{#if dropdownOpen}
				<div
					class="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-[#e8e2d9] bg-white py-1.5 shadow-lg"
					role="menu"
					onclick={(e) => e.stopPropagation()}
				>
					<div class="border-b border-[#e8e2d9] px-4 py-2.5">
						<p class="text-sm font-medium text-[#1a1714]">{user.name}</p>
						<p class="text-xs text-[#8a8279]">{user.email}</p>
					</div>
					<form method="post" action="?/signOut" use:enhance class="px-1.5 pt-1.5">
						<button
							type="submit"
							class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#3a3632] transition-colors hover:bg-[#f0ebe4]"
							role="menuitem"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
								<polyline points="16 17 21 12 16 7" />
								<line x1="21" y1="12" x2="9" y2="12" />
							</svg>
							Sign out
						</button>
					</form>
				</div>
			{/if}
		</div>
	</nav>
</header>
