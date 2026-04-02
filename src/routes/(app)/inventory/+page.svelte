<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { PageData, ActionData } from './$types';
	import { getExpirationStatus } from '$lib/domain/inventory/expiration.js';
	import { compressImage } from '$lib/compress-image.js';
	import type { StorageLocation, FoodItem } from '$lib/domain/inventory/food-item.js';
	import { formatQuantity } from '$lib/format-quantity.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type TabId = 'all' | StorageLocation | 'trash' | 'restock';

	let activeTab = $state<TabId>('all');
	let addStorageLocation = $derived<StorageLocation>(
		activeTab === 'all' || activeTab === 'trash' || activeTab === 'restock' ? 'pantry' : activeTab
	);
	let addName = $state('');
	let addQuantityValue = $state('1');
	let addQuantityUnit = $state('count');
	let addExpirationDate = $state('');
	let editingId = $state<number | null>(null);
	let addFormOpen = $state(false);
	$effect(() => {
		if (data.items.length === 0) addFormOpen = true;
	});

	function resetAddForm() {
		addName = '';
		addQuantityValue = '1';
		addQuantityUnit = 'count';
		addExpirationDate = '';
		// addStorageLocation stays derived from activeTab — no reset needed
	}

	// Toast state
	interface Toast {
		id: number;
		message: string;
		undoItem: FoodItem | null;
		timeoutId: ReturnType<typeof setTimeout>;
	}
	let toasts = $state<Toast[]>([]);
	let nextToastId = 0;

	function showTrashToast(item: FoodItem) {
		const id = nextToastId++;
		const timeoutId = setTimeout(() => dismissToast(id), 5000);
		toasts.push({ id, message: `"${item.name}" moved to trash`, undoItem: item, timeoutId });
	}

	function showBulkAddToast(count: number) {
		const id = nextToastId++;
		const timeoutId = setTimeout(() => dismissToast(id), 5000);
		toasts.push({
			id,
			message: `${count} item${count === 1 ? '' : 's'} added from receipt`,
			undoItem: null,
			timeoutId
		});
	}

	function dismissToast(id: number) {
		const idx = toasts.findIndex((t) => t.id === id);
		if (idx !== -1) {
			clearTimeout(toasts[idx].timeoutId);
			toasts.splice(idx, 1);
		}
	}

	let tabBarEl: HTMLDivElement;
	let showTabFade = $state(true);

	function onTabScroll() {
		if (!tabBarEl) return;
		const { scrollLeft, scrollWidth, clientWidth } = tabBarEl;
		showTabFade = scrollLeft + clientWidth < scrollWidth - 2;
	}

	const locationTabs: { id: TabId; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'pantry', label: 'Pantry' },
		{ id: 'fridge', label: 'Fridge' },
		{ id: 'freezer', label: 'Freezer' },
		{ id: 'trash', label: 'Trash' },
		{ id: 'restock', label: 'Restock' }
	];

	const filteredItems = $derived(
		data.items
			.filter((item) => activeTab === 'all' || item.storageLocation === activeTab)
			.sort((a, b) => {
				if (a.expirationDate === null && b.expirationDate === null) return 0;
				if (a.expirationDate === null) return 1;
				if (b.expirationDate === null) return -1;
				return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
			})
	);

	const statusColors = {
		fresh: 'bg-green-100 text-green-700 border-green-200',
		'expiring-soon': 'bg-yellow-100 text-yellow-700 border-yellow-200',
		expired: 'bg-red-100 text-red-700 border-red-200'
	};

	const statusLabels = {
		fresh: 'Fresh',
		'expiring-soon': 'Expiring soon',
		expired: 'Expired'
	};

	let showDeleteAllDialog = $state(false);
	let checkedRestockIds = $state(new Set<number>());

	function toggleRestock(id: number) {
		if (checkedRestockIds.has(id)) {
			checkedRestockIds.delete(id);
		} else {
			checkedRestockIds.add(id);
		}
		checkedRestockIds = new Set(checkedRestockIds);
	}

	function startEdit(item: FoodItem) {
		editingId = item.id;
	}

	function toDateInputValue(date: Date | null): string {
		if (!date) return '';
		return new Date(date).toISOString().split('T')[0];
	}

	// Receipt scanning state
	interface ReviewItem {
		localId: number;
		checked: boolean;
		name: string;
		canonicalName: string | null;
		storageLocation: StorageLocation;
		quantityValue: number;
		quantityUnit: string;
		expirationDate: string;
	}

	let scanning = $state(false);
	let scanError = $state<string | null>(null);
	let reviewItems = $state<ReviewItem[]>([]);
	let fileInput = $state<HTMLInputElement | undefined>();
	let nextReviewId = 0;

	const checkedCount = $derived(reviewItems.filter((i) => i.checked).length);
	const selectedItemsJson = $derived(
		JSON.stringify(
			reviewItems
				.filter((i) => i.checked)
				.map((i) => ({
					name: i.name,
					canonicalName: i.canonicalName,
					storageLocation: i.storageLocation,
					quantityValue: i.quantityValue,
					quantityUnit: i.quantityUnit,
					expirationDate: i.expirationDate || null
				}))
		)
	);

	function triggerScan() {
		scanError = null;
		fileInput?.click();
	}

	$effect(() => {
		if (page.url.searchParams.get('scan') === 'true' && fileInput) {
			triggerScan();
		}
	});

	async function handleFileSelected(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		scanning = true;
		scanError = null;

		let imageFile: File;
		try {
			imageFile = await compressImage(file);
		} catch {
			scanError = 'Could not process this image. Try a different photo.';
			scanning = false;
			return;
		}

		const body = new FormData();
		body.append('image', imageFile);

		try {
			const res = await fetch('/api/scan-receipt', { method: 'POST', body });

			if (!res.ok) {
				const text = await res.text().catch(() => '');
				scanError =
					text.includes("Couldn't extract") || res.status === 422
						? "Couldn't extract any items from this image. Try a clearer photo."
						: 'Something went wrong. Try again in a moment.';
				return;
			}

			const items = (await res.json()) as Array<{
				name: string;
				canonicalName: string | null;
				storageLocation: StorageLocation;
				quantity: { value: number; unit: string };
				expirationDate: string | null;
			}>;

			if (items.length === 0) {
				scanError = "Couldn't extract any items from this image. Try a clearer photo.";
				return;
			}

			reviewItems = items.map((item) => ({
				localId: nextReviewId++,
				checked: true,
				name: item.name,
				canonicalName: item.canonicalName,
				storageLocation: item.storageLocation,
				quantityValue: item.quantity.value,
				quantityUnit: item.quantity.unit,
				expirationDate: item.expirationDate
					? new Date(item.expirationDate).toISOString().split('T')[0]
					: ''
			}));
		} catch {
			scanError = 'Something went wrong. Try again in a moment.';
		} finally {
			scanning = false;
			if (fileInput) fileInput.value = '';
		}
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Nunito+Sans:wght@300;400;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<!-- Toast notifications -->
{#if toasts.length > 0}
	<div class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
		{#each toasts as toast (toast.id)}
			<div
				class="flex items-center gap-3 rounded-xl border border-[#e8e2d9] bg-white px-4 py-3 shadow-lg"
			>
				<span class="text-sm text-[#3a3632]">{toast.message}</span>
				{#if toast.undoItem}
					<form
						method="post"
						action="?/restore"
						use:enhance={() => {
							return ({ result, update }) => {
								if (result.type !== 'failure') dismissToast(toast.id);
								update();
							};
						}}
					>
						<input type="hidden" name="id" value={toast.undoItem.id} />
						<input
							type="hidden"
							name="trashedAt"
							value={toast.undoItem.trashedAt?.toISOString() ?? ''}
						/>
						<button
							type="submit"
							class="rounded-lg bg-[#c4a46a] px-3 py-1.5 text-xs font-semibold text-[#1a1714] transition-colors hover:bg-[#d4b87a]"
						>
							Undo
						</button>
					</form>
				{/if}
				<button
					type="button"
					onclick={() => dismissToast(toast.id)}
					class="ml-1 text-[#b5aea4] hover:text-[#3a3632]"
					aria-label="Dismiss"
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
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

<main class="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
	<!-- Hero -->
	<div
		class="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1714] via-[#252018] to-[#2a2520] p-8 sm:p-10"
	>
		<span class="mb-3 inline-block text-xs font-semibold tracking-[0.2em] text-[#c4a46a]">
			INVENTORY
		</span>
		<h2
			class="mb-3 font-[Cormorant_Garamond,serif] text-3xl leading-tight font-bold text-[#f0e6d3] sm:text-4xl"
		>
			Food Inventory
		</h2>
		<p class="max-w-xl text-base leading-relaxed text-[#9a9088]">
			{data.items.length === 0
				? 'Nothing in inventory yet. Add your first item above.'
				: `${data.items.length} item${data.items.length === 1 ? '' : 's'} in inventory`}
		</p>
		{#if data.items.length > 0}
			<button
				type="button"
				onclick={() => (showDeleteAllDialog = true)}
				class="mt-5 rounded-lg border border-red-800/40 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:border-red-600/60 hover:text-red-300"
			>
				Delete all inventory
			</button>
		{/if}
	</div>

	<!-- Tab bar -->
	<div class="relative mb-6">
		<div
			class="scrollbar-hide flex gap-1 overflow-x-auto rounded-xl border border-[#e8e2d9] bg-white p-1"
			bind:this={tabBarEl}
			onscroll={onTabScroll}
		>
			{#each locationTabs as tab}
				<button
					type="button"
					onclick={() => (activeTab = tab.id)}
					class="shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all duration-150 sm:flex-1
							{activeTab === tab.id
						? 'bg-[#1a1714] text-white shadow-sm'
						: 'text-[#8a8279] hover:bg-[#f0ebe4] hover:text-[#3a3632]'}"
				>
					{tab.label}
					{#if tab.id === 'trash' && data.trashedItems.length > 0}
						<span
							class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
						>
							{data.trashedItems.length}
						</span>
					{/if}
					{#if tab.id === 'restock' && data.restockItems.length > 0}
						<span
							class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-[#1a1714]"
							style="background-color: #c4a46a;"
						>
							{data.restockItems.length}
						</span>
					{/if}
				</button>
			{/each}
		</div>
		{#if showTabFade}
			<div
				class="pointer-events-none absolute top-0 right-0 bottom-0 w-8 rounded-r-xl bg-gradient-to-l from-white to-transparent"
			></div>
		{/if}
	</div>

	<!-- Restock tab content -->
	{#if activeTab === 'restock'}
		{#if data.restockItems.length === 0}
			<p class="mb-10 text-sm text-[#8a8279]">Nothing needs restocking right now.</p>
		{:else}
			<section class="mb-10">
				<ul class="divide-y divide-[#e8e2d9] rounded-xl border border-[#e8e2d9] bg-white">
					{#each data.restockItems as restockItem (restockItem.foodItem.id)}
						{@const statusColors = {
							expired: 'bg-red-100 text-red-700 border-red-200',
							'expiring-soon': 'bg-yellow-100 text-yellow-700 border-yellow-200'
						}}
						{@const statusLabels = {
							expired: 'Expired',
							'expiring-soon': 'Expiring soon'
						}}
						{@const isChecked = checkedRestockIds.has(restockItem.foodItem.id)}
						<li class="flex flex-wrap items-center gap-3 px-4 py-3">
							<input
								type="checkbox"
								aria-label="Check off {restockItem.foodItem.name}"
								checked={isChecked}
								onchange={() => toggleRestock(restockItem.foodItem.id)}
								class="h-4 w-4 cursor-pointer accent-[#c4a46a]"
							/>
							<span class="font-medium text-[#1a1714]">{restockItem.foodItem.name}</span>
							<span
								class="rounded-full border px-2 py-0.5 text-xs font-medium {statusColors[
									restockItem.expirationStatus
								]}"
							>
								{statusLabels[restockItem.expirationStatus]}
							</span>
							{#if isChecked}
								<form
									method="post"
									action="?/trash"
									use:enhance={() => {
										return ({ result, update }) => {
											if (result.type !== 'failure') {
												checkedRestockIds.delete(restockItem.foodItem.id);
											}
											update();
										};
									}}
								>
									<input type="hidden" name="id" value={restockItem.foodItem.id} />
									<button
										type="submit"
										class="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
									>
										Trash old
									</button>
								</form>
								<form
									method="post"
									action="?/trash"
									use:enhance={() => {
										return ({ result, update }) => {
											if (result.type !== 'failure') {
												checkedRestockIds.delete(restockItem.foodItem.id);
												addName = restockItem.foodItem.name;
												addExpirationDate = '';
												activeTab = restockItem.foodItem.storageLocation;
												addFormOpen = true;
											}
											update();
										};
									}}
								>
									<input type="hidden" name="id" value={restockItem.foodItem.id} />
									<button
										type="submit"
										class="rounded-lg bg-[#c4a46a] px-3 py-1 text-xs font-semibold text-[#1a1714] hover:bg-[#d4b87a]"
									>
										Replace
									</button>
								</form>
							{/if}
							<a
								href={restockItem.walmartUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="ml-auto text-xs font-semibold text-[#c4a46a] hover:underline"
							>
								Buy on Walmart
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Trash tab content -->
	{:else if activeTab === 'trash'}
		{#if data.trashedItems.length === 0}
			<p class="mb-10 text-sm text-[#8a8279]">No recently trashed items.</p>
		{:else}
			<section class="mb-10">
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.trashedItems as item (item.id)}
						<article
							class="rounded-xl border border-[#e8e2d9] bg-white p-6 opacity-70 transition-all duration-200"
						>
							<div class="mb-1 flex items-start justify-between gap-2">
								<h3
									class="font-[Cormorant_Garamond,serif] text-lg font-bold text-[#8a8279] line-through"
								>
									{item.name}
								</h3>
								<span
									class="shrink-0 rounded-full border border-[#e8e2d9] px-2 py-0.5 text-xs font-medium text-[#8a8279] capitalize"
								>
									{item.storageLocation}
								</span>
							</div>

							<p class="mb-4 text-xs font-medium tracking-[0.1em] text-[#8a8279]">
								Trashed {item.trashedAt ? new Date(item.trashedAt).toLocaleString() : ''}
							</p>

							<form method="post" action="?/restore" use:enhance>
								<input type="hidden" name="id" value={item.id} />
								<input
									type="hidden"
									name="trashedAt"
									value={item.trashedAt ? new Date(item.trashedAt).toISOString() : ''}
								/>
								<button
									type="submit"
									class="w-full rounded-lg border border-[#c4a46a] px-3 py-2 text-xs font-semibold text-[#c4a46a] transition-colors hover:bg-[#c4a46a] hover:text-[#1a1714]"
								>
									Restore
								</button>
							</form>
						</article>
					{/each}
				</div>
			</section>
		{/if}
	{:else}
		<!-- Add Item Form / Receipt Review -->
		<section class="mb-10 rounded-xl border border-[#e8e2d9] bg-white">
			<!-- Hidden file input for camera/photo library -->
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				capture="environment"
				class="hidden"
				onchange={handleFileSelected}
			/>

			{#if reviewItems.length > 0}
				<!-- Receipt review list -->
				<div class="p-6 sm:p-8">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="font-[Cormorant_Garamond,serif] text-lg font-bold text-[#1a1714]">
							Review Scanned Items
						</h3>
						<button
							type="button"
							onclick={() => {
								reviewItems = [];
								scanError = null;
							}}
							class="text-sm text-[#8a8279] hover:text-[#3a3632]"
						>
							Cancel
						</button>
					</div>

					<ul class="mb-4 flex flex-col gap-2">
						{#each reviewItems as item (item.localId)}
							<li class="flex flex-wrap items-center gap-2 rounded-lg border border-[#e8e2d9] p-3">
								<input
									type="checkbox"
									bind:checked={item.checked}
									class="h-4 w-4 shrink-0 cursor-pointer accent-[#c4a46a]"
									aria-label="Include {item.name}"
								/>
								<input
									type="text"
									bind:value={item.name}
									class="min-w-24 flex-1 rounded border border-[#ddd6cc] bg-white px-2 py-1 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-1 focus:ring-[#c4a46a33]"
									aria-label="Name"
								/>
								<select
									bind:value={item.storageLocation}
									class="rounded border border-[#ddd6cc] bg-white px-2 py-1 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a]"
									aria-label="Storage location"
								>
									<option value="pantry">Pantry</option>
									<option value="fridge">Fridge</option>
									<option value="freezer">Freezer</option>
								</select>
								<input
									type="number"
									bind:value={item.quantityValue}
									min="0.01"
									step="any"
									placeholder="qty"
									class="w-16 rounded border border-[#ddd6cc] bg-white px-2 py-1 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a]"
									aria-label="Quantity"
								/>
								<select
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
								<input
									type="date"
									bind:value={item.expirationDate}
									class="rounded border border-[#ddd6cc] bg-white px-2 py-1 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a]"
									aria-label="Expiration date"
								/>
							</li>
						{/each}
					</ul>

					<form
						method="post"
						action="?/bulkCreate"
						use:enhance={() => {
							return ({ result, update }) => {
								if (result.type !== 'failure') {
									const count =
										result.type === 'success' && result.data
											? (result.data as { count: number }).count
											: 0;
									showBulkAddToast(count);
									reviewItems = [];
								}
								update();
							};
						}}
					>
						<input type="hidden" name="items" value={selectedItemsJson} />
						<div class="flex items-center gap-4">
							<button
								type="submit"
								disabled={checkedCount === 0}
								class="rounded-lg bg-[#c4a46a] px-5 py-2.5 text-sm font-semibold tracking-wide text-[#1a1714] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
							>
								Add {checkedCount} Item{checkedCount === 1 ? '' : 's'}
							</button>
							{#if form?.message}
								<p
									class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-600"
								>
									{form.message}
								</p>
							{/if}
						</div>
					</form>
				</div>
			{:else}
				<!-- Collapsible add form header -->
				<button
					type="button"
					onclick={() => (addFormOpen = !addFormOpen)}
					class="flex w-full items-center justify-between p-6 sm:px-8 sm:py-6"
				>
					<h3 class="font-[Cormorant_Garamond,serif] text-lg font-bold text-[#1a1714]">Add Item</h3>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-[#8a8279] transition-transform duration-200 {addFormOpen
							? 'rotate-180'
							: ''}"
						aria-hidden="true"
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>

				{#if addFormOpen}
					<div class="px-6 pt-0 pb-6 sm:px-8 sm:pb-8">
						<!-- Scan Receipt button -->
						<div class="mb-4 flex items-center justify-end">
							<button
								type="button"
								onclick={triggerScan}
								disabled={scanning}
								class="text-sm font-medium text-[#c4a46a] transition-colors hover:text-[#d4b87a] disabled:cursor-not-allowed disabled:opacity-50"
							>
								{scanning ? 'Scanning…' : 'Scan Receipt'}
							</button>
						</div>

						<!-- Shimmer loading bar -->
						{#if scanning}
							<div class="mb-4 h-1 w-full overflow-hidden rounded-full bg-[#e8e2d9]">
								<div class="scan-shimmer h-full w-1/3 rounded-full bg-[#c4a46a]"></div>
							</div>
						{/if}

						{#if scanError}
							<p
								class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-600"
							>
								{scanError}
							</p>
						{/if}

						<form
							method="post"
							action="?/create"
							use:enhance={() => {
								return ({ result, update }) => {
									if (result.type !== 'failure') resetAddForm();
									update({ reset: false });
								};
							}}
							class="flex flex-col gap-4"
						>
							<!-- Name -->
							<div class="flex flex-col gap-1.5">
								<label for="name" class="text-sm font-medium text-[#3a3632]">Name</label>
								<input
									id="name"
									type="text"
									name="name"
									bind:value={addName}
									required
									placeholder="e.g. Milk, Eggs, Pasta"
									class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
								/>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<!-- Storage location — pre-selects from active tab, stays after save -->
								<div class="flex flex-col gap-1.5">
									<label for="storageLocation" class="text-sm font-medium text-[#3a3632]">
										Storage Location
									</label>
									<select
										id="storageLocation"
										name="storageLocation"
										value={addStorageLocation}
										class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
									>
										<option value="pantry">Pantry</option>
										<option value="fridge">Fridge</option>
										<option value="freezer">Freezer</option>
									</select>
								</div>

								<!-- Unit -->
								<div class="flex flex-col gap-1.5">
									<label for="quantityUnit" class="text-sm font-medium text-[#3a3632]">Unit</label>
									<select
										id="quantityUnit"
										name="quantityUnit"
										bind:value={addQuantityUnit}
										class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
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
							</div>

							<!-- Quantity value -->
							<div class="flex flex-col gap-1.5">
								<label for="quantityValue" class="text-sm font-medium text-[#3a3632]">Quantity</label>
								<input
									id="quantityValue"
									type="number"
									name="quantityValue"
									min="0.01"
									step="any"
									bind:value={addQuantityValue}
									class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
								/>
							</div>

							<!-- Expiration date (optional) -->
							<div class="flex flex-col gap-1.5">
								<label for="expirationDate" class="text-sm font-medium text-[#3a3632]">
									Expiration date <span class="font-normal text-[#8a8279]">(optional)</span>
								</label>
								<input
									id="expirationDate"
									type="date"
									name="expirationDate"
									bind:value={addExpirationDate}
									class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
								/>
							</div>

							<div class="flex items-center gap-4">
								<button
									type="submit"
									class="rounded-lg bg-[#c4a46a] px-5 py-2.5 text-sm font-semibold tracking-wide text-[#1a1714] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a] hover:shadow-md active:translate-y-0"
								>
									Add Item
								</button>
								{#if form?.message}
									<p
										class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-600"
									>
										{form.message}
									</p>
								{/if}
							</div>
						</form>
					</div>
				{/if}
			{/if}
		</section>

		<!-- Active items list -->
		{#if filteredItems.length > 0}
			<section class="mb-10">
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each filteredItems as item (item.id)}
						{@const status = item.expirationDate
							? getExpirationStatus(new Date(item.expirationDate))
							: null}

						{#if editingId === item.id}
							<!-- Edit form -->
							<article class="rounded-xl border border-[#c4a46a66] bg-white p-6 shadow-sm">
								<form
									method="post"
									action="?/update"
									use:enhance={() => {
										return ({ result, update }) => {
											if (result.type !== 'failure') editingId = null;
											update();
										};
									}}
									class="flex flex-col gap-3"
								>
									<input type="hidden" name="id" value={item.id} />

									<div class="flex flex-col gap-1">
										<label for="edit-name-{item.id}" class="text-xs font-medium text-[#3a3632]"
											>Name</label
										>
										<input
											id="edit-name-{item.id}"
											type="text"
											name="name"
											value={item.name}
											required
											class="rounded-lg border border-[#ddd6cc] bg-white px-3 py-2 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
										/>
									</div>

									<div class="grid grid-cols-2 gap-2">
										<div class="flex flex-col gap-1">
											<label for="edit-loc-{item.id}" class="text-xs font-medium text-[#3a3632]"
												>Location</label
											>
											<select
												id="edit-loc-{item.id}"
												name="storageLocation"
												value={item.storageLocation}
												class="rounded-lg border border-[#ddd6cc] bg-white px-3 py-2 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
											>
												<option value="pantry">Pantry</option>
												<option value="fridge">Fridge</option>
												<option value="freezer">Freezer</option>
											</select>
										</div>

										<div class="flex flex-col gap-1">
											<label for="edit-unit-{item.id}" class="text-xs font-medium text-[#3a3632]"
												>Unit</label
											>
											<select
												id="edit-unit-{item.id}"
												name="quantityUnit"
												value={item.quantity.unit}
												class="rounded-lg border border-[#ddd6cc] bg-white px-3 py-2 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
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
									</div>

									<div class="flex flex-col gap-1">
										<label for="edit-qty-{item.id}" class="text-xs font-medium text-[#3a3632]"
											>Quantity</label
										>
										<input
											id="edit-qty-{item.id}"
											type="number"
											name="quantityValue"
											min="0.01"
											step="any"
											value={item.quantity.value}
											class="rounded-lg border border-[#ddd6cc] bg-white px-3 py-2 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
										/>
									</div>

									<div class="flex flex-col gap-1">
										<label for="edit-expiry-{item.id}" class="text-xs font-medium text-[#3a3632]"
											>Expiry date</label
										>
										<input
											id="edit-expiry-{item.id}"
											type="date"
											name="expirationDate"
											value={toDateInputValue(item.expirationDate)}
											class="rounded-lg border border-[#ddd6cc] bg-white px-3 py-2 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
										/>
									</div>

									<div class="flex gap-2">
										<button
											type="submit"
											class="flex-1 rounded-lg bg-[#c4a46a] px-3 py-2 text-xs font-semibold text-[#1a1714] transition-colors hover:bg-[#d4b87a]"
										>
											Save
										</button>
										<button
											type="button"
											onclick={() => (editingId = null)}
											class="flex-1 rounded-lg border border-[#ddd6cc] px-3 py-2 text-xs font-medium text-[#8a8279] transition-colors hover:bg-[#f0ebe4]"
										>
											Cancel
										</button>
									</div>

									{#if form?.message}
										<p class="text-xs text-red-600">{form.message}</p>
									{/if}
								</form>
							</article>
						{:else}
							<!-- View card -->
							<article
								class="group rounded-xl border border-[#e8e2d9] bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c4a46a66] hover:shadow-md"
							>
								<div class="mb-1 flex items-start justify-between gap-2">
									<h3 class="font-[Cormorant_Garamond,serif] text-lg font-bold text-[#1a1714]">
										{item.name}
									</h3>
									<div class="flex shrink-0 items-center gap-1">
										<span
											class="rounded-full border border-[#e8e2d9] px-2 py-0.5 text-xs font-medium text-[#8a8279] capitalize"
										>
											{item.storageLocation}
										</span>
										<!-- Edit button -->
										<button
											type="button"
											onclick={() => startEdit(item)}
											aria-label="Edit {item.name}"
											class="flex h-6 w-6 items-center justify-center rounded-full text-[#b5aea4] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#f0ebe4] hover:text-[#3a3632]"
										>
											<svg
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2.5"
												stroke-linecap="round"
												stroke-linejoin="round"
												aria-hidden="true"
											>
												<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
												<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
											</svg>
										</button>
										<!-- Trash button -->
										<form
											method="post"
											action="?/trash"
											use:enhance={() => {
												return ({ result, update }) => {
													if (result.type !== 'failure') {
														showTrashToast({ ...item, trashedAt: new Date() });
													}
													update();
												};
											}}
										>
											<input type="hidden" name="id" value={item.id} />
											<button
												type="submit"
												aria-label="Trash {item.name}"
												class="flex h-6 w-6 items-center justify-center rounded-full text-[#b5aea4] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
											>
												<svg
													width="12"
													height="12"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2.5"
													stroke-linecap="round"
													stroke-linejoin="round"
													aria-hidden="true"
												>
													<polyline points="3 6 5 6 21 6" />
													<path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
													<path d="M10 11v6M14 11v6" />
													<path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
												</svg>
											</button>
										</form>
									</div>
								</div>

								<p class="mb-3 text-xs font-medium tracking-[0.1em] text-[#8a8279]">
									{formatQuantity(item.quantity)}
								</p>

								{#if item.expirationDate && status}
									<div class="flex items-center gap-2">
										<span
											class="rounded-full border px-2 py-0.5 text-xs font-medium {statusColors[
												status
											]}"
										>
											{statusLabels[status]}
										</span>
										<span class="text-xs text-[#8a8279]">
											{new Date(item.expirationDate).toLocaleDateString()}
										</span>
									</div>
								{/if}
							</article>
						{/if}
					{/each}
				</div>
			</section>
		{:else}
			<p class="mb-10 text-sm text-[#8a8279]">
				{activeTab === 'all' ? 'No items in inventory.' : `No items in ${activeTab}.`}
			</p>
		{/if}
	{/if}
</main>

<!-- Delete All confirmation dialog -->
{#if showDeleteAllDialog}
	<dialog
		open
		class="fixed inset-0 z-50 m-auto h-fit w-full max-w-sm rounded-2xl border border-[#e8e2d9] bg-white p-8 shadow-2xl backdrop:bg-black/40"
	>
		<h2 class="mb-2 font-[Cormorant_Garamond,serif] text-xl font-bold text-[#1a1714]">
			Delete all inventory?
		</h2>
		<p class="mb-6 text-sm leading-relaxed text-[#8a8279]">
			All {data.items.length} item{data.items.length === 1 ? '' : 's'} will be moved to trash. You can restore
			them within 24 hours.
		</p>
		<div class="flex gap-3">
			<button
				type="button"
				onclick={() => (showDeleteAllDialog = false)}
				class="flex-1 rounded-lg border border-[#e8e2d9] px-4 py-2.5 text-sm font-semibold text-[#3a3632] transition-colors hover:bg-[#f5f0eb]"
			>
				Cancel
			</button>
			<form
				method="post"
				action="?/deleteAll"
				use:enhance={() => {
					showDeleteAllDialog = false;
					return ({ update }) => update();
				}}
				class="flex-1"
			>
				<button
					type="submit"
					class="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
				>
					Delete all
				</button>
			</form>
		</div>
	</dialog>
{/if}

<style>
	@keyframes shimmer {
		0% {
			transform: translateX(-200%);
		}
		100% {
			transform: translateX(500%);
		}
	}
	.scan-shimmer {
		animation: shimmer 1.5s ease-in-out infinite;
	}
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
