<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { formatQuantity } from '$lib/format-quantity.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showReceiptModal = $state(page.url.searchParams.get('completed') === 'true');

	$effect(() => {
		if (page.url.searchParams.get('completed') === 'true') {
			showReceiptModal = true;
		}
	});

	function skipReceiptScan() {
		showReceiptModal = false;
		goto('/shop', { replaceState: true });
	}

	// Optimistic overrides: id → intended checked state, set immediately on click
	const optimisticOverrides = $state(new Map<number, boolean>());

	// When server data refreshes, clear overrides whose state the server has caught up with
	$effect(() => {
		const items = data.items;
		untrack(() => {
			for (const [id, optimistic] of optimisticOverrides) {
				const serverItem = items.find((i) => i.id === id);
				if (serverItem !== undefined && serverItem.checked === optimistic) {
					optimisticOverrides.delete(id);
				}
			}
		});
	});

	function isChecked(id: number): boolean {
		if (optimisticOverrides.has(id)) return optimisticOverrides.get(id)!;
		return data.items.find((i) => i.id === id)?.checked ?? false;
	}

	function handleToggle(id: number, nextChecked: boolean) {
		optimisticOverrides.set(id, nextChecked);
	}

	const uncheckedItems = $derived(data.items.filter((i) => !isChecked(i.id)));
	const checkedItems = $derived(data.items.filter((i) => isChecked(i.id)));

	const hasCheckedItems = $derived(data.items.some((i) => isChecked(i.id)));
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Nunito+Sans:wght@300;400;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main class="mx-auto w-[85%] max-w-5xl pt-6 pb-32">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="font-[Cormorant_Garamond,serif] text-3xl font-semibold text-[#2c2416]">
			Shopping List
		</h1>
	</div>

	{#if data.items.length === 0}
		<div class="rounded-2xl border border-dashed border-[#d8cfc4] bg-white p-10 text-center">
			<p class="mb-1 text-[#8a7a6a]">Nothing to shop for.</p>
			<p class="text-sm text-[#b0a090]">Items will appear here when food is expiring or pinned recipes have missing ingredients.</p>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each uncheckedItems as item (item.id)}
				<form
					method="POST"
					action="?/toggle"
					use:enhance={() => {
						handleToggle(item.id, true);
						return async ({ update }) => update({ reset: false });
					}}
				>
					<input type="hidden" name="id" value={item.id} />
					<input type="hidden" name="checked" value="true" />
					<button
						type="submit"
						class="flex w-full items-center gap-4 rounded-2xl border border-[#e8e2d9] bg-white px-5 py-4 text-left shadow-sm active:bg-[#f5f0ea]"
					>
						<span
							class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#c0a880]"
						></span>
						<span class="min-w-0 flex-1">
							<span class="block text-base font-semibold text-[#2c2416]">{item.displayName}</span>
							<span class="block text-sm text-[#8a7a6a]">
								{formatQuantity(item.quantity)}
								{#if item.sourceType === 'recipe'}
									· {item.sourceRecipeNames?.join(' · ') ?? ''}
								{:else if item.sourceRecipeNames && item.sourceRecipeNames.length > 0}
									· Expiring · {item.sourceRecipeNames.join(' · ')}
								{:else}
									· Expiring
								{/if}
							</span>
						</span>
					</button>
				</form>
			{/each}

			{#if checkedItems.length > 0}
				<div class="mt-4 mb-2">
					<p class="text-xs font-semibold tracking-wide text-[#b0a090] uppercase">
						In cart ({checkedItems.length})
					</p>
				</div>
				{#each checkedItems as item (item.id)}
					<form
						method="POST"
						action="?/toggle"
						use:enhance={() => {
							handleToggle(item.id, false);
							return async ({ update }) => update({ reset: false });
						}}
					>
						<input type="hidden" name="id" value={item.id} />
						<input type="hidden" name="checked" value="false" />
						<button
							type="submit"
							class="flex w-full items-center gap-4 rounded-2xl border border-[#e8e2d9] bg-[#faf8f5] px-5 py-4 text-left opacity-60 shadow-sm active:bg-[#f0ece6]"
						>
							<span
								class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-green-400 bg-green-50"
							>
								<svg
									class="h-4 w-4 text-green-500"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<polyline points="20 6 9 17 4 12" />
								</svg>
							</span>
							<span class="min-w-0 flex-1">
								<span class="block text-base font-semibold text-[#2c2416] line-through"
									>{item.displayName}</span
								>
								<span class="block text-sm text-[#b0a090]">{formatQuantity(item.quantity)}</span>
							</span>
						</button>
					</form>
				{/each}
			{/if}
		</div>
	{/if}

	<!-- Done shopping button -->
	{#if hasCheckedItems}
		<div class="fixed bottom-16 left-0 right-0 flex justify-center px-6 pb-5">
			<form method="POST" action="?/completeShopping" use:enhance class="w-full max-w-5xl">
				<button
					type="submit"
					class="w-full rounded-2xl bg-[#2c2416] px-6 py-4 text-lg font-semibold text-white shadow-lg active:bg-[#3d3420]"
				>
					Done shopping
				</button>
			</form>
		</div>
	{/if}
</main>

<!-- Post-trip receipt scan modal -->
{#if showReceiptModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
		<div class="w-full max-w-sm rounded-3xl bg-[#f8f6f3] p-8 shadow-xl">
			<h2 class="mb-3 font-[Cormorant_Garamond,serif] text-2xl font-semibold text-[#2c2416]">
				Shopping done!
			</h2>
			<p class="mb-8 text-[#5a4a3a]">
				Scan your receipt to update your inventory while it's fresh.
			</p>
			<div class="flex flex-col gap-3">
				<a
					href="/inventory?scan=receipt"
					class="block w-full rounded-2xl bg-[#2c2416] px-6 py-4 text-center text-base font-semibold text-white shadow-md active:bg-[#3d3420]"
				>
					Scan Receipt
				</a>
				<button
					type="button"
					onclick={skipReceiptScan}
					class="w-full rounded-2xl border border-[#d8cfc4] bg-white px-6 py-4 text-base font-semibold text-[#5a4a3a] active:bg-[#f0ece6]"
				>
					Skip for now
				</button>
			</div>
		</div>
	</div>
{/if}
