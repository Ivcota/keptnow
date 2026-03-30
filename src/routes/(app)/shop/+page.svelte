<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { formatQuantity } from '$lib/format-quantity.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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

	// Review modal state
	type ReviewItem = {
		localId: number;
		name: string;
		storageLocation: 'pantry' | 'fridge' | 'freezer';
		quantityValue: number;
		quantityUnit: 'count' | 'ml' | 'g';
		expirationDate: string;
	};

	let showReview = $state(false);
	let reviewItems = $state<ReviewItem[]>([]);

	function openReviewOrSubmit() {
		const checkedRecipeItems = checkedItems.filter((i) => i.sourceType === 'recipe');
		if (checkedRecipeItems.length === 0) {
			// No recipe items — submit immediately with empty recipe list
			const form = document.getElementById('complete-form') as HTMLFormElement;
			form.requestSubmit();
			return;
		}
		reviewItems = checkedRecipeItems.map((item, idx) => ({
			localId: idx,
			name: item.displayName,
			storageLocation: item.carriedStorageLocation,
			quantityValue: item.quantity.value,
			quantityUnit: item.quantity.unit,
			expirationDate: ''
		}));
		showReview = true;
	}

	function cancelReview() {
		showReview = false;
		reviewItems = [];
	}

	const recipeItemsJson = $derived(
		JSON.stringify(
			reviewItems.map((item) => ({
				name: item.name,
				canonicalName: null,
				storageLocation: item.storageLocation,
				quantity: { value: item.quantityValue, unit: item.quantityUnit },
				expirationDate: item.expirationDate ? item.expirationDate : null
			}))
		)
	);

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

<main class="mx-auto max-w-lg px-4 pt-6 pb-32">
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

	<!-- Hidden complete form -->
	<form id="complete-form" method="POST" action="?/completeShopping" use:enhance>
		<input type="hidden" name="recipeItemsJson" value={recipeItemsJson} />
	</form>

	<!-- Done shopping button -->
	{#if hasCheckedItems}
		<div class="fixed bottom-16 left-0 right-0 flex justify-center p-5">
			<button
				type="button"
				onclick={openReviewOrSubmit}
				class="w-full max-w-lg rounded-2xl bg-[#2c2416] px-6 py-4 text-base font-semibold text-white shadow-lg active:bg-[#3d3420]"
			>
				Done shopping
			</button>
		</div>
	{/if}
</main>

<!-- Review modal for recipe items -->
{#if showReview}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
		<div class="w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
			<div class="flex items-center justify-between px-6 pt-6 pb-4">
				<h2 class="font-[Cormorant_Garamond,serif] text-2xl font-semibold text-[#2c2416]">
					Review Items
				</h2>
				<button
					type="button"
					onclick={cancelReview}
					class="rounded-full p-1 text-[#8a7a6a] hover:bg-[#f5f0ea]"
					aria-label="Cancel"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div class="max-h-[60vh] overflow-y-auto px-6 pb-2">
				{#each reviewItems as item (item.localId)}
					<div class="mb-4 rounded-2xl border border-[#e8e2d9] bg-[#faf8f5] p-4">
						<p class="mb-3 text-base font-semibold text-[#2c2416]">{item.name}</p>
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-3">
								<label for="location-{item.localId}" class="w-28 text-sm text-[#8a7a6a]">Location</label>
								<select
									id="location-{item.localId}"
									bind:value={item.storageLocation}
									class="flex-1 rounded-lg border border-[#e8e2d9] bg-white px-3 py-1.5 text-sm text-[#2c2416]"
								>
									<option value="pantry">Pantry</option>
									<option value="fridge">Fridge</option>
									<option value="freezer">Freezer</option>
								</select>
							</div>
							<div class="flex items-center gap-3">
								<label for="unit-{item.localId}" class="w-28 text-sm text-[#8a7a6a]">Unit</label>
								<select
									id="unit-{item.localId}"
									bind:value={item.quantityUnit}
									class="flex-1 rounded-lg border border-[#e8e2d9] bg-white px-3 py-1.5 text-sm text-[#2c2416]"
								>
									<option value="count">count</option>
									<option value="ml">ml</option>
									<option value="g">g</option>
								</select>
							</div>
							<div class="flex items-center gap-3">
								<label for="qty-{item.localId}" class="w-28 text-sm text-[#8a7a6a]">Quantity</label>
								<input
									id="qty-{item.localId}"
									type="number"
									bind:value={item.quantityValue}
									min="0.01"
									step="any"
									class="flex-1 rounded-lg border border-[#e8e2d9] bg-white px-3 py-1.5 text-sm text-[#2c2416]"
								/>
							</div>
							<div class="flex items-center gap-3">
								<label for="exp-{item.localId}" class="w-28 text-sm text-[#8a7a6a]">Expires</label>
								<input
									id="exp-{item.localId}"
									type="date"
									bind:value={item.expirationDate}
									class="flex-1 rounded-lg border border-[#e8e2d9] bg-white px-3 py-1.5 text-sm text-[#2c2416]"
								/>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="px-6 pb-8 pt-4">
				<button
					type="button"
					onclick={() => {
						showReview = false;
						const form = document.getElementById('complete-form') as HTMLFormElement;
						form.requestSubmit();
					}}
					class="w-full rounded-2xl bg-[#2c2416] px-6 py-4 text-base font-semibold text-white shadow-sm active:bg-[#3d3420]"
				>
					Add {reviewItems.length} item{reviewItems.length === 1 ? '' : 's'} to inventory
				</button>
			</div>
		</div>
	</div>
{/if}
