<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { PageData, ActionData } from './$types';
	import { getExpirationStatus } from '$lib/domain/inventory/expiration.js';
	import { compressImage } from '$lib/compress-image.js';
	import type { StorageLocation, FoodItem } from '$lib/domain/inventory/food-item.js';
	import type { QuantityUnit } from '$lib/domain/shared/quantity.js';
	import { formatQuantity } from '$lib/format-quantity.js';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ScanReviewModal, { type SelectedItem } from '$lib/components/ScanReviewModal.svelte';
	import type { ExtractedFoodItem } from '$lib/domain/receipt/types.js';
	import { createToastState } from '$lib/toast-state.svelte.js';
	import { clearScanParam } from '$lib/scan-utils.js';

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
	// Bottom sheet state
	let sheetOpen = $state(false);
	let sheetMode = $state<'options' | 'manual'>('options');

	function openSheet(mode: 'options' | 'manual' = 'options') {
		sheetMode = mode;
		sheetOpen = true;
	}

	function closeSheet() {
		sheetOpen = false;
		sheetMode = 'options';
	}

	function resetAddForm() {
		addName = '';
		addQuantityValue = '1';
		addQuantityUnit = 'count';
		addExpirationDate = '';
		// addStorageLocation stays derived from activeTab — no reset needed
	}

	// Toast state
	const toastState = createToastState();
	let toasts = $derived(toastState.toasts);

	function showTrashToast(item: FoodItem) {
		toastState.showToast(`"${item.name}" moved to trash`, { data: item });
	}

	function showBulkAddToast(count: number) {
		toastState.showToast(
			`${count} item${count === 1 ? '' : 's'} added from receipt`
		);
	}

	function dismissToast(id: number) {
		toastState.dismissToast(id);
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

	// Scanning state (shared between receipt and food photo scan)
	let scanning = $state(false);
	let scannedItems = $state<ExtractedFoodItem[]>([]);
	let lastScanType = $state<'receipt' | 'food' | null>(null);
	let fileInput = $state<HTMLInputElement | undefined>();
	let foodFileInput = $state<HTMLInputElement | undefined>();

	// Form submission loading states
	let manualSubmitting = $state(false);
	let bulkSubmitting = $state(false);

	// Bulk submission state (populated by ScanReviewModal onsubmit)
	let pendingBulkItems = $state<SelectedItem[]>([]);
	let bulkFormEl = $state<HTMLFormElement | undefined>();
	const pendingBulkJson = $derived(JSON.stringify(pendingBulkItems));

	function triggerScan() {
		fileInput?.click();
	}

	function triggerFoodScan() {
		foodFileInput?.click();
	}

	$effect(() => {
		const scanParam = page.url.searchParams.get('scan');
		if (scanParam === 'receipt' && fileInput) {
			triggerScan();
		} else if (scanParam === 'food' && foodFileInput) {
			triggerFoodScan();
		}
	});

	function retryScan() {
		if (lastScanType === 'receipt') triggerScan();
		else if (lastScanType === 'food') triggerFoodScan();
	}

	function showScanError(message: string) {
		toastState.showScanErrorToast(message, retryScan);
	}

	async function handleScanResponse(res: Response, inputEl: HTMLInputElement | undefined) {
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			const message =
				text.includes("Couldn't extract") || res.status === 422
					? "Couldn't extract any items from this image. Try a clearer photo."
					: 'Something went wrong. Try again in a moment.';
			showScanError(message);
			return;
		}

		const rawItems = (await res.json()) as Array<{
			name: string;
			canonicalName: string | null;
			storageLocation: StorageLocation;
			quantity: { value: number; unit: string };
			expirationDate: string | null;
		}>;

		if (rawItems.length === 0) {
			showScanError("Couldn't extract any items from this image. Try a clearer photo.");
			return;
		}

		scannedItems = rawItems.map((item) => ({
			name: item.name,
			canonicalName: item.canonicalName,
			storageLocation: item.storageLocation,
			quantity: { value: item.quantity.value, unit: item.quantity.unit as QuantityUnit },
			expirationDate: item.expirationDate ? new Date(item.expirationDate) : null
		}));
		if (inputEl) inputEl.value = '';
	}

	async function handleFileSelected(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		scanning = true;
		lastScanType = 'receipt';
		const scanToastId = toastState.showScanningToast('Scanning receipt...');

		let imageFile: File;
		try {
			imageFile = await compressImage(file);
		} catch {
			showScanError('Could not process this image. Try a different photo.');
			toastState.dismissToast(scanToastId);
			scanning = false;
			return;
		}

		const body = new FormData();
		body.append('image', imageFile);

		try {
			const res = await fetch('/api/scan-receipt', { method: 'POST', body });
			await handleScanResponse(res, fileInput);
		} catch {
			showScanError('Something went wrong. Try again in a moment.');
		} finally {
			toastState.dismissToast(scanToastId);
			scanning = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function handleFoodFileSelected(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		scanning = true;
		lastScanType = 'food';
		const scanToastId = toastState.showScanningToast('Scanning food photo...');

		let imageFile: File;
		try {
			imageFile = await compressImage(file);
		} catch {
			showScanError('Could not process this image. Try a different photo.');
			toastState.dismissToast(scanToastId);
			scanning = false;
			return;
		}

		const body = new FormData();
		body.append('image', imageFile);

		try {
			const res = await fetch('/api/scan-food', { method: 'POST', body });
			await handleScanResponse(res, foodFileInput);
		} catch {
			showScanError('Something went wrong. Try again in a moment.');
		} finally {
			toastState.dismissToast(scanToastId);
			scanning = false;
			if (foodFileInput) foodFileInput.value = '';
		}
	}

	async function handleScanReviewSubmit(items: SelectedItem[]) {
		pendingBulkItems = items;
		// Allow Svelte to bind the form element before submitting
		await Promise.resolve();
		bulkFormEl?.requestSubmit();
	}

	function handleScanReviewCancel() {
		scannedItems = [];
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
			{@const undoItem = toast.data as FoodItem | undefined}
			<div
				class="flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg {toast.variant === 'error' ? 'border-red-200 bg-red-50' : 'border-[#e8e2d9] bg-white'}"
			>
				{#if !toast.dismissable}
					<!-- Scanning spinner -->
					<div class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#c4a46a] border-t-transparent"></div>
				{/if}
				<span class="text-sm {toast.variant === 'error' ? 'text-red-700' : 'text-[#3a3632]'}">{toast.message}</span>
				{#if toast.action}
					<button
						type="button"
						onclick={() => toastState.invokeAction(toast.id)}
						class="shrink-0 whitespace-nowrap rounded-lg bg-[#c4a46a] px-3 py-1.5 text-xs font-semibold text-[#1a1714] transition-colors hover:bg-[#d4b87a]"
					>
						{toast.action.label}
					</button>
				{/if}
				{#if undoItem?.trashedAt !== undefined}
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
						<input type="hidden" name="id" value={undoItem.id} />
						<input
							type="hidden"
							name="trashedAt"
							value={undoItem.trashedAt?.toISOString() ?? ''}
						/>
						<button
							type="submit"
							class="rounded-lg bg-[#c4a46a] px-3 py-1.5 text-xs font-semibold text-[#1a1714] transition-colors hover:bg-[#d4b87a]"
						>
							Undo
						</button>
					</form>
				{/if}
				{#if toast.dismissable}
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
				{/if}
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
					{#if tab.id === 'trash'}
						{#await data.trashedItems then trashedItems}
							{#if trashedItems.length > 0}
								<span
									class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
								>
									{trashedItems.length}
								</span>
							{/if}
						{/await}
					{/if}
					{#if tab.id === 'restock'}
						{#await data.restockItems then restockItems}
							{#if restockItems.length > 0}
								<span
									class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-[#1a1714]"
									style="background-color: #c4a46a;"
								>
									{restockItems.length}
								</span>
							{/if}
						{/await}
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
		{#await data.restockItems}
			<p class="mb-10 text-sm text-[#8a8279]">Loading restock items...</p>
		{:then restockItems}
		{#if restockItems.length === 0}
			<p class="mb-10 text-sm text-[#8a8279]">Nothing needs restocking right now.</p>
		{:else}
			<section class="mb-10">
				<ul class="divide-y divide-[#e8e2d9] rounded-xl border border-[#e8e2d9] bg-white">
					{#each restockItems as restockItem (restockItem.foodItem.id)}
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
												openSheet('manual');
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
		{/await}

		<!-- Trash tab content -->
	{:else if activeTab === 'trash'}
		{#await data.trashedItems}
			<p class="mb-10 text-sm text-[#8a8279]">Loading trashed items...</p>
		{:then trashedItems}
		{#if trashedItems.length === 0}
			<p class="mb-10 text-sm text-[#8a8279]">No recently trashed items.</p>
		{:else}
			<section class="mb-10">
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each trashedItems as item (item.id)}
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
		{/await}
	{:else}
		<!-- Hidden file input for receipt scan (?scan=receipt deep-link and bottom sheet) -->
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			class="hidden"
			onchange={handleFileSelected}
		/>

		<!-- Hidden file input for food photo scan (?scan=food deep-link and bottom sheet) -->
		<input
			bind:this={foodFileInput}
			type="file"
			accept="image/*"
			capture="environment"
			class="hidden"
			onchange={handleFoodFileSelected}
		/>

		<!-- Receipt Review -->
		{#if scannedItems.length > 0}
			<ScanReviewModal
				items={scannedItems}
				submitting={bulkSubmitting}
				onsubmit={handleScanReviewSubmit}
				oncancel={handleScanReviewCancel}
			/>
			{#if form?.message}
				<p class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-600">
					{form.message}
				</p>
			{/if}
		{/if}

		<!-- Hidden bulk create form (submitted programmatically by handleScanReviewSubmit) -->
		<form
			method="post"
			action="?/bulkCreate"
			bind:this={bulkFormEl}
			class="hidden"
			use:enhance={() => {
				bulkSubmitting = true;
				return ({ result, update }) => {
					bulkSubmitting = false;
					if (result.type !== 'failure') {
						clearScanParam();
						const count =
							result.type === 'success' && result.data
								? (result.data as { count: number }).count
								: 0;
						showBulkAddToast(count);
						scannedItems = [];
						pendingBulkItems = [];
					}
					update();
				};
			}}
		>
			<input type="hidden" name="items" value={pendingBulkJson} />
		</form>

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

<!-- FAB: Add Items (only shown on inventory tabs, not trash/restock) -->
{#if activeTab !== 'trash' && activeTab !== 'restock' && scannedItems.length === 0}
	<button
		type="button"
		onclick={() => openSheet()}
		aria-label="Add items to inventory"
		class="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#c4a46a] px-5 py-3 text-sm font-semibold text-[#1a1714] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:translate-x-[-50%] hover:bg-[#d4b87a] hover:shadow-xl active:translate-y-0 active:translate-x-[-50%]"
	>
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
		Add Items
	</button>
{/if}

<!-- Add Items Bottom Sheet -->
<BottomSheet open={sheetOpen} ondismiss={closeSheet}>
	{#if sheetMode === 'options'}
		<!-- Three entry point options -->
		<div class="px-6 pb-8 pt-4">
			<h2 class="mb-6 font-[Cormorant_Garamond,serif] text-xl font-bold text-[#1a1714]">
				Add Items
			</h2>
			<ul class="flex flex-col gap-3">
				<!-- Scan Food Photo -->
				<li>
					<button
						type="button"
						onclick={() => { closeSheet(); triggerFoodScan(); }}
						class="flex w-full items-center gap-4 rounded-xl border border-[#e8e2d9] bg-white px-5 py-4 text-left transition-all duration-150 hover:border-[#c4a46a66] hover:bg-[#faf8f5] hover:shadow-sm"
						aria-label="Scan Food Photo"
					>
						<span
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0ebe4]"
							aria-hidden="true"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#c4a46a"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
								/>
								<circle cx="12" cy="13" r="4" />
							</svg>
						</span>
						<span>
							<span class="block text-sm font-semibold text-[#1a1714]">Scan Food Photo</span>
							<span class="block text-xs text-[#8a8279]">Photograph food to identify items</span>
						</span>
						<svg
							class="ml-auto text-[#b5aea4]"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</li>

				<!-- Scan Receipt -->
				<li>
					<button
						type="button"
						onclick={() => { closeSheet(); triggerScan(); }}
						class="flex w-full items-center gap-4 rounded-xl border border-[#e8e2d9] bg-white px-5 py-4 text-left transition-all duration-150 hover:border-[#c4a46a66] hover:bg-[#faf8f5] hover:shadow-sm"
						aria-label="Scan Receipt"
					>
						<span
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0ebe4]"
							aria-hidden="true"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#c4a46a"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="9 11 12 14 22 4" />
								<path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
							</svg>
						</span>
						<span>
							<span class="block text-sm font-semibold text-[#1a1714]">Scan Receipt</span>
							<span class="block text-xs text-[#8a8279]">Upload or photograph a receipt</span>
						</span>
						<svg
							class="ml-auto text-[#b5aea4]"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</li>

				<!-- Enter Manually (functional) -->
				<li>
					<button
						type="button"
						onclick={() => (sheetMode = 'manual')}
						class="flex w-full items-center gap-4 rounded-xl border border-[#e8e2d9] bg-white px-5 py-4 text-left transition-all duration-150 hover:border-[#c4a46a66] hover:bg-[#faf8f5] hover:shadow-sm"
					>
						<span
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0ebe4]"
							aria-hidden="true"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#c4a46a"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
								<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
							</svg>
						</span>
						<span>
							<span class="block text-sm font-semibold text-[#1a1714]">Enter Manually</span>
							<span class="block text-xs text-[#8a8279]">Type in item details</span>
						</span>
						<svg
							class="ml-auto text-[#b5aea4]"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				</li>
			</ul>
		</div>
	{:else}
		<!-- Manual add form -->
		<div class="px-6 pb-8 pt-4">
			<div class="mb-5 flex items-center gap-3">
				<button
					type="button"
					onclick={() => (sheetMode = 'options')}
					class="flex items-center gap-1 text-sm text-[#8a8279] hover:text-[#3a3632]"
					aria-label="Back to options"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<polyline points="15 18 9 12 15 6" />
					</svg>
					Back
				</button>
				<h2 class="font-[Cormorant_Garamond,serif] text-xl font-bold text-[#1a1714]">
					Enter Manually
				</h2>
			</div>

			<form
				method="post"
				action="?/create"
				use:enhance={() => {
					manualSubmitting = true;
					return ({ result, update }) => {
						manualSubmitting = false;
						if (result.type !== 'failure') {
							resetAddForm();
							closeSheet();
						}
						update({ reset: false });
					};
				}}
				class="flex flex-col gap-4"
			>
				<!-- Name -->
				<div class="flex flex-col gap-1.5">
					<label for="sheet-name" class="text-sm font-medium text-[#3a3632]">Name</label>
					<input
						id="sheet-name"
						type="text"
						name="name"
						bind:value={addName}
						required
						placeholder="e.g. Milk, Eggs, Pasta"
						class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<!-- Storage location -->
					<div class="flex flex-col gap-1.5">
						<label for="sheet-storageLocation" class="text-sm font-medium text-[#3a3632]">
							Storage
						</label>
						<select
							id="sheet-storageLocation"
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
						<label for="sheet-quantityUnit" class="text-sm font-medium text-[#3a3632]">Unit</label>
						<select
							id="sheet-quantityUnit"
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
					<label for="sheet-quantityValue" class="text-sm font-medium text-[#3a3632]">
						Quantity
					</label>
					<input
						id="sheet-quantityValue"
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
					<label for="sheet-expirationDate" class="text-sm font-medium text-[#3a3632]">
						Expiration date <span class="font-normal text-[#8a8279]">(optional)</span>
					</label>
					<input
						id="sheet-expirationDate"
						type="date"
						name="expirationDate"
						bind:value={addExpirationDate}
						class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
					/>
				</div>

				<div class="flex items-center gap-4 pb-2">
					<button
						type="submit"
						disabled={manualSubmitting}
						class="flex items-center gap-2 rounded-lg bg-[#c4a46a] px-5 py-2.5 text-sm font-semibold tracking-wide text-[#1a1714] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
					>
						{#if manualSubmitting}
							<div class="h-4 w-4 animate-spin rounded-full border-2 border-[#1a1714] border-t-transparent"></div>
							Adding...
						{:else}
							Add Item
						{/if}
					</button>
					{#if form?.message}
						<p class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-600">
							{form.message}
						</p>
					{/if}
				</div>
			</form>
		</div>
	{/if}
</BottomSheet>

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
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
