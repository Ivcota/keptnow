<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
	let mobileMenuOpen = $state(false);
</script>

<svelte:window onclick={() => (mobileMenuOpen = false)} />

<div class="flex min-h-screen flex-col bg-[#f8f6f3] font-[Nunito_Sans,sans-serif]">
	<!-- STICKY NAV -->
	<header class="sticky top-0 z-50 border-b border-[#c4a46a33] bg-[#f8f6f3]/95 backdrop-blur-sm">
		<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a
				href="/"
				class="font-[Cormorant_Garamond,serif] text-2xl font-bold tracking-wide text-[#1a1714] transition-colors hover:text-[#c4a46a]"
			>
				KeptNow
			</a>

			<!-- Desktop nav -->
			<div class="hidden items-center gap-6 sm:flex">
				<a
					href="/"
					class="text-sm font-medium text-[#4a4540] transition-colors hover:text-[#c4a46a]"
				>
					Home
				</a>
				<a
					href="/about"
					class="text-sm font-medium text-[#4a4540] transition-colors hover:text-[#c4a46a]"
				>
					About
				</a>
				<a
					href="/roadmap"
					class="text-sm font-medium text-[#4a4540] transition-colors hover:text-[#c4a46a]"
				>
					Roadmap
				</a>
				{#if data.user}
					<a
						href="/inventory"
						class="rounded-lg bg-[#c4a46a] px-5 py-2 text-sm font-semibold tracking-wide text-[#1a1714] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a]"
					>
						Go to App
					</a>
				{:else}
					<a
						href="/login"
						class="rounded-lg bg-[#c4a46a] px-5 py-2 text-sm font-semibold tracking-wide text-[#1a1714] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a]"
					>
						Get Started
					</a>
				{/if}
			</div>

			<!-- Mobile hamburger button -->
			<button
				type="button"
				class="sm:hidden rounded-lg p-2 text-[#4a4540] transition-colors hover:bg-[#f0ebe4]"
				onclick={(e) => {
					e.stopPropagation();
					mobileMenuOpen = !mobileMenuOpen;
				}}
				aria-label="Toggle menu"
				aria-expanded={mobileMenuOpen}
			>
				{#if mobileMenuOpen}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				{:else}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<line x1="3" y1="12" x2="21" y2="12" />
						<line x1="3" y1="6" x2="21" y2="6" />
						<line x1="3" y1="18" x2="21" y2="18" />
					</svg>
				{/if}
			</button>
		</nav>

		<!-- Mobile menu -->
		{#if mobileMenuOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div
				class="border-t border-[#c4a46a33] px-6 py-4 sm:hidden"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="flex flex-col gap-3">
					<a
						href="/"
						class="rounded-lg px-3 py-2 text-sm font-medium text-[#4a4540] transition-colors hover:bg-[#f0ebe4] hover:text-[#c4a46a]"
						onclick={() => (mobileMenuOpen = false)}
					>
						Home
					</a>
					<a
						href="/about"
						class="rounded-lg px-3 py-2 text-sm font-medium text-[#4a4540] transition-colors hover:bg-[#f0ebe4] hover:text-[#c4a46a]"
						onclick={() => (mobileMenuOpen = false)}
					>
						About
					</a>
					<a
						href="/roadmap"
						class="rounded-lg px-3 py-2 text-sm font-medium text-[#4a4540] transition-colors hover:bg-[#f0ebe4] hover:text-[#c4a46a]"
						onclick={() => (mobileMenuOpen = false)}
					>
						Roadmap
					</a>
					{#if data.user}
						<a
							href="/inventory"
							class="mt-1 rounded-lg bg-[#c4a46a] px-5 py-2.5 text-center text-sm font-semibold tracking-wide text-[#1a1714] transition-colors hover:bg-[#d4b87a]"
							onclick={() => (mobileMenuOpen = false)}
						>
							Go to App
						</a>
					{:else}
						<a
							href="/login"
							class="mt-1 rounded-lg bg-[#c4a46a] px-5 py-2.5 text-center text-sm font-semibold tracking-wide text-[#1a1714] transition-colors hover:bg-[#d4b87a]"
							onclick={() => (mobileMenuOpen = false)}
						>
							Get Started
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</header>

	<!-- PAGE CONTENT -->
	<main class="flex-1">
		{@render children()}
	</main>

	<!-- FOOTER -->
	<footer class="border-t border-[#c4a46a33] bg-[#1a1714] py-10">
		<div
			class="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between"
		>
			<p class="text-sm text-[#6b6560]">
				&copy; {new Date().getFullYear()} KeptNow. All rights reserved.
			</p>
			<div class="flex items-center gap-6">
				<a href="/" class="text-sm text-[#8a8279] transition-colors hover:text-[#c4a46a]"> Home </a>
				<a href="/about" class="text-sm text-[#8a8279] transition-colors hover:text-[#c4a46a]">
					About
				</a>
				<a href="/roadmap" class="text-sm text-[#8a8279] transition-colors hover:text-[#c4a46a]">
					Roadmap
				</a>
			</div>
		</div>
	</footer>
</div>
