<script lang="ts">
	import type { ExtractedFoodItem } from '$lib/domain/receipt/types.js';
	import type { StorageLocation } from '$lib/domain/inventory/food-item.js';

	type ReviewItem = {
		localId: number;
		checked: boolean;
		expanded: boolean;
		name: string;
		canonicalName: string | null;
		storageLocation: StorageLocation;
		quantityValue: number;
		quantityUnit: string;
		expirationDate: string;
	};

	export type SelectedItem = {
		name: string;
		canonicalName: string | null;
		storageLocation: StorageLocation;
		quantityValue: number;
		quantityUnit: string;
		expirationDate: string | null;
	};

	let {
		items,
		onsubmit,
		oncancel
	}: {
		items: ExtractedFoodItem[];
		onsubmit: (selectedItems: SelectedItem[]) => void;
		oncancel: () => void;
	} = $props();

	function toReviewItems(input: ExtractedFoodItem[]): ReviewItem[] {
		let nextId = 0;
		return input.map((item) => ({
			localId: nextId++,
			checked: true,
			expanded: false,
			name: item.name,
			canonicalName: item.canonicalName,
			storageLocation: item.storageLocation,
			quantityValue: item.quantity.value,
			quantityUnit: item.quantity.unit,
			expirationDate: item.expirationDate
				? new Date(item.expirationDate).toISOString().split('T')[0]
				: ''
		}));
	}

	// Capture initial items as local mutable review state
	// eslint-disable-next-line svelte/no-state-referenced-locally
	let reviewItems = $state<ReviewItem[]>(toReviewItems(items));

	const checkedCount = $derived(reviewItems.filter((i) => i.checked).length);

	function toggleExpanded(localId: number) {
		reviewItems = reviewItems.map((item) => ({
			...item,
			expanded: item.localId === localId ? !item.expanded : false
		}));
	}

	function handleSubmit() {
		const selectedItems: SelectedItem[] = reviewItems
			.filter((i) => i.checked)
			.map((i) => ({
				name: i.name,
				canonicalName: i.canonicalName,
				storageLocation: i.storageLocation,
				quantityValue: i.quantityValue,
				quantityUnit: i.quantityUnit,
				expirationDate: i.expirationDate || null
			}));
		onsubmit(selectedItems);
	}
</script>

<section class="mb-10 rounded-xl border border-[#e8e2d9] bg-white">
	<div class="p-6 sm:p-8">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-[Cormorant_Garamond,serif] text-lg font-bold text-[#1a1714]">
				Review Scanned Items
			</h3>
			<button type="button" onclick={oncancel} class="text-sm text-[#8a8279] hover:text-[#3a3632]">
				Cancel
			</button>
		</div>

		<ul class="mb-4 flex flex-col gap-2">
			{#each reviewItems as item (item.localId)}
				<li class="rounded-lg border border-[#e8e2d9]">
					<!-- Collapsed row -->
					<div class="flex items-center gap-3 p-3">
						<input
							type="checkbox"
							bind:checked={item.checked}
							class="h-4 w-4 shrink-0 cursor-pointer accent-[#c4a46a]"
							aria-label="Include {item.name}"
						/>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span
							class="flex-1 cursor-pointer select-none text-sm font-medium text-[#1a1714]"
							onclick={() => toggleExpanded(item.localId)}
						>
							{item.name}
						</span>
						<span class="text-xs capitalize text-[#8a8279]">{item.storageLocation}</span>
						<button
							type="button"
							onclick={() => toggleExpanded(item.localId)}
							aria-label="{item.expanded ? 'Collapse' : 'Expand'} {item.name}"
							class="text-[#b5aea4] transition-transform duration-150 hover:text-[#3a3632]"
							style="transform: rotate({item.expanded ? 180 : 0}deg)"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</button>
					</div>

					<!-- Expanded edit fields -->
					{#if item.expanded}
						<div class="flex flex-wrap gap-2 border-t border-[#e8e2d9] px-3 pb-3 pt-2">
							<div class="flex flex-col gap-1">
								<label for="review-name-{item.localId}" class="text-xs font-medium text-[#8a8279]">
									Name
								</label>
								<input
									id="review-name-{item.localId}"
									type="text"
									bind:value={item.name}
									class="min-w-24 rounded border border-[#ddd6cc] bg-white px-2 py-1 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-1 focus:ring-[#c4a46a33]"
									aria-label="Name"
								/>
							</div>
							<div class="flex flex-col gap-1">
								<label
									for="review-storage-{item.localId}"
									class="text-xs font-medium text-[#8a8279]"
								>
									Storage
								</label>
								<select
									id="review-storage-{item.localId}"
									bind:value={item.storageLocation}
									class="rounded border border-[#ddd6cc] bg-white px-2 py-1 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a]"
									aria-label="Storage location"
								>
									<option value="pantry">Pantry</option>
									<option value="fridge">Fridge</option>
									<option value="freezer">Freezer</option>
								</select>
							</div>
							<div class="flex flex-col gap-1">
								<label for="review-qty-{item.localId}" class="text-xs font-medium text-[#8a8279]">
									Qty
								</label>
								<input
									id="review-qty-{item.localId}"
									type="number"
									bind:value={item.quantityValue}
									min="0.01"
									step="any"
									class="w-16 rounded border border-[#ddd6cc] bg-white px-2 py-1 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a]"
									aria-label="Quantity"
								/>
							</div>
							<div class="flex flex-col gap-1">
								<label
									for="review-unit-{item.localId}"
									class="text-xs font-medium text-[#8a8279]"
								>
									Unit
								</label>
								<select
									id="review-unit-{item.localId}"
									bind:value={item.quantityUnit}
									class="rounded border border-[#ddd6cc] bg-white px-2 py-1 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a]"
									aria-label="Unit"
								>
									<optgroup label="Count">
										<option value="count">count</option>
										<option value="each">each</option>
										<option value="dozen">dozen</option>
									</optgroup>
									<optgroup label="Volume">
										<option value="tsp">tsp</option>
										<option value="tbsp">tbsp</option>
										<option value="fl oz">fl oz</option>
										<option value="cup">cup</option>
										<option value="pt">pint</option>
										<option value="qt">quart</option>
										<option value="gal">gallon</option>
										<option value="ml">ml</option>
										<option value="l">liter</option>
									</optgroup>
									<optgroup label="Weight">
										<option value="oz">oz</option>
										<option value="lb">lb</option>
										<option value="g">g</option>
										<option value="kg">kg</option>
									</optgroup>
								</select>
							</div>
							<div class="flex flex-col gap-1">
								<label
									for="review-expiry-{item.localId}"
									class="text-xs font-medium text-[#8a8279]"
								>
									Expiry
								</label>
								<input
									id="review-expiry-{item.localId}"
									type="date"
									bind:value={item.expirationDate}
									class="rounded border border-[#ddd6cc] bg-white px-2 py-1 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a]"
									aria-label="Expiration date"
								/>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={handleSubmit}
				disabled={checkedCount === 0}
				class="rounded-lg bg-[#c4a46a] px-5 py-2.5 text-sm font-semibold tracking-wide text-[#1a1714] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
			>
				Add {checkedCount} Item{checkedCount === 1 ? '' : 's'}
			</button>
		</div>
	</div>
</section>
