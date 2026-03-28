<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { getExpirationStatus } from '$lib/domain/inventory/expiration.js';
	import type { StorageLocation, FoodItem } from '$lib/domain/inventory/food-item.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type TabId = 'all' | StorageLocation | 'trash' | 'restock';

	let activeTab = $state<TabId>('all');
	let addTrackingType = $state('count');
	let addStorageLocation = $derived<StorageLocation>(
		activeTab === 'all' || activeTab === 'trash' || activeTab === 'restock' ? 'pantry' : activeTab
	);
	let addName = $state('');
	let addAmount = $state('');
	let addQuantity = $state('1');
	let addExpirationDate = $state('');
	let editingId = $state<number | null>(null);
	let editTrackingType = $state('count');

	function resetAddForm() {
		addName = '';
		addTrackingType = 'count';
		addAmount = '';
		addQuantity = '1';
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

	function dismissToast(id: number) {
		const idx = toasts.findIndex((t) => t.id === id);
		if (idx !== -1) {
			clearTimeout(toasts[idx].timeoutId);
			toasts.splice(idx, 1);
		}
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

	function startEdit(item: FoodItem) {
		editingId = item.id;
		editTrackingType = item.trackingType;
	}

	function toDateInputValue(date: Date | null): string {
		if (!date) return '';
		return new Date(date).toISOString().split('T')[0];
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

<div class="flex min-h-screen flex-col bg-[#f8f6f3] font-[Nunito_Sans,sans-serif]">
	<nav class="border-b border-[#e8e2d9] bg-white">
		<div class="mx-auto flex max-w-5xl items-center px-6 py-4">
			<h1 class="font-[Cormorant_Garamond,serif] text-xl font-bold tracking-wide text-[#1a1714]">
				Home Maker Assist
			</h1>
		</div>
	</nav>

	<main class="mx-auto w-full max-w-5xl px-6 py-10">
		<!-- Hero -->
		<div
			class="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1714] via-[#252018] to-[#2a2520] p-8 sm:p-10"
		>
			<span class="mb-3 inline-block text-xs font-semibold tracking-[0.2em] text-[#c4a46a]">
				INVENTORY
			</span>
			<h2
				class="mb-3 font-[Cormorant_Garamond,serif] text-3xl font-bold leading-tight text-[#f0e6d3] sm:text-4xl"
			>
				Food Inventory
			</h2>
			<p class="max-w-xl text-base leading-relaxed text-[#9a9088]">
				{data.items.length === 0
					? 'Nothing in inventory yet. Add your first item below.'
					: `${data.items.length} item${data.items.length === 1 ? '' : 's'} in inventory`}
			</p>
		</div>

		<!-- Tab bar -->
		<div class="mb-6 flex gap-1 rounded-xl border border-[#e8e2d9] bg-white p-1">
			{#each locationTabs as tab}
				<button
					type="button"
					onclick={() => (activeTab = tab.id)}
					class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150
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
							<li class="flex items-center gap-3 px-4 py-3">
								<span
									class="font-medium text-[#1a1714]"
								>{restockItem.foodItem.name}</span>
								<span
									class="rounded-full border px-2 py-0.5 text-xs font-medium {statusColors[restockItem.expirationStatus]}"
								>
									{statusLabels[restockItem.expirationStatus]}
								</span>
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
										class="shrink-0 rounded-full border border-[#e8e2d9] px-2 py-0.5 text-xs font-medium capitalize text-[#8a8279]"
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
												<label
													for="edit-loc-{item.id}"
													class="text-xs font-medium text-[#3a3632]">Location</label
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
												<label
													for="edit-type-{item.id}"
													class="text-xs font-medium text-[#3a3632]">Track by</label
												>
												<select
													id="edit-type-{item.id}"
													name="trackingType"
													bind:value={editTrackingType}
													class="rounded-lg border border-[#ddd6cc] bg-white px-3 py-2 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
												>
													<option value="count">Count (qty)</option>
													<option value="amount">Amount (%)</option>
												</select>
											</div>
										</div>

										{#if editTrackingType === 'amount'}
											<div class="flex flex-col gap-1">
												<label
													for="edit-amount-{item.id}"
													class="text-xs font-medium text-[#3a3632]">Amount (%)</label
												>
												<input
													id="edit-amount-{item.id}"
													type="number"
													name="amount"
													min="0"
													max="100"
													value={item.amount ?? ''}
													class="rounded-lg border border-[#ddd6cc] bg-white px-3 py-2 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
												/>
											</div>
										{:else}
											<div class="flex flex-col gap-1">
												<label
													for="edit-qty-{item.id}"
													class="text-xs font-medium text-[#3a3632]">Quantity</label
												>
												<input
													id="edit-qty-{item.id}"
													type="number"
													name="quantity"
													min="1"
													value={item.quantity ?? 1}
													class="rounded-lg border border-[#ddd6cc] bg-white px-3 py-2 text-sm text-[#1a1714] outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
												/>
											</div>
										{/if}

										<div class="flex flex-col gap-1">
											<label
												for="edit-expiry-{item.id}"
												class="text-xs font-medium text-[#3a3632]">Expiry date</label
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
									class="group rounded-xl border border-[#e8e2d9] bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[#c4a46a66]"
								>
									<div class="mb-1 flex items-start justify-between gap-2">
										<h3
											class="font-[Cormorant_Garamond,serif] text-lg font-bold text-[#1a1714]"
										>
											{item.name}
										</h3>
										<div class="flex shrink-0 items-center gap-1">
											<span
												class="rounded-full border border-[#e8e2d9] px-2 py-0.5 text-xs font-medium capitalize text-[#8a8279]"
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
														<path
															d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
														/>
														<path d="M10 11v6M14 11v6" />
														<path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
													</svg>
												</button>
											</form>
										</div>
									</div>

									<p class="mb-3 text-xs font-medium tracking-[0.1em] text-[#8a8279]">
										{#if item.trackingType === 'amount'}
											{item.amount !== null ? `${item.amount}% remaining` : 'Amount not set'}
										{:else}
											{item.quantity !== null ? `Qty: ${item.quantity}` : 'Quantity not set'}
										{/if}
									</p>

									{#if item.expirationDate && status}
										<div class="flex items-center gap-2">
											<span
												class="rounded-full border px-2 py-0.5 text-xs font-medium {statusColors[status]}"
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

			<!-- Add Item Form (Quick-add mode: stays open, clears after save) -->
			<section class="rounded-xl border border-[#e8e2d9] bg-white p-6 sm:p-8">
				<h3 class="mb-4 font-[Cormorant_Garamond,serif] text-lg font-bold text-[#1a1714]">
					Add Item
				</h3>
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
							class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] placeholder:text-[#b5aea4] shadow-sm outline-none transition-all duration-200 focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
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
								class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm outline-none transition-all duration-200 focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
							>
								<option value="pantry">Pantry</option>
								<option value="fridge">Fridge</option>
								<option value="freezer">Freezer</option>
							</select>
						</div>

						<!-- Tracking type -->
						<div class="flex flex-col gap-1.5">
							<label for="trackingType" class="text-sm font-medium text-[#3a3632]">Track by</label>
							<select
								id="trackingType"
								name="trackingType"
								bind:value={addTrackingType}
								class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm outline-none transition-all duration-200 focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
							>
								<option value="count">Count (qty)</option>
								<option value="amount">Amount (%)</option>
							</select>
						</div>
					</div>

					<!-- Amount or Quantity -->
					{#if addTrackingType === 'amount'}
						<div class="flex flex-col gap-1.5">
							<label for="amount" class="text-sm font-medium text-[#3a3632]">
								Amount remaining (%)
							</label>
							<input
								id="amount"
								type="number"
								name="amount"
								min="0"
								max="100"
								bind:value={addAmount}
								placeholder="0–100"
								class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm outline-none transition-all duration-200 focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
							/>
						</div>
					{:else}
						<div class="flex flex-col gap-1.5">
							<label for="quantity" class="text-sm font-medium text-[#3a3632]">Quantity</label>
							<input
								id="quantity"
								type="number"
								name="quantity"
								min="1"
								bind:value={addQuantity}
								class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm outline-none transition-all duration-200 focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
							/>
						</div>
					{/if}

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
							class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm outline-none transition-all duration-200 focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
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
			</section>
		{/if}
	</main>
</div>
