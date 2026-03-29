<script lang="ts">
	import { enhance } from '$app/forms';
	import { compressImage } from '$lib/compress-image.js';
	import type { PageData, ActionData } from './$types';
	import type { Recipe } from '$lib/domain/recipe/recipe.js';
	import { matchIngredients, calculateReadiness } from '$lib/domain/recipe/ingredient-matching.js';
	import type { ReadinessStatus } from '$lib/domain/recipe/ingredient-matching.js';
	import { findSimilarRecipeName } from '$lib/domain/recipe/duplicate-detection.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type TabId = 'all' | 'ready' | 'almost-ready' | 'need-to-shop' | 'trash';

	let activeTab = $state<TabId>('all');

	// Batch scanning state
	interface ReviewIngredient {
		localId: number;
		name: string;
		canonicalName: string | null;
		quantity: string | null;
		unit: string | null;
	}

	interface BatchRecipe {
		batchId: number;
		name: string;
		ingredients: ReviewIngredient[];
	}

	let scanning = $state(false);
	let scanProgress = $state<{ current: number; total: number } | null>(null);
	let scanError = $state<string | null>(null);
	let batchRecipes = $state<BatchRecipe[]>([]);
	let showBatchReview = $state(false);
	let fileInput = $state<HTMLInputElement | undefined>();
	let nextLocalId = 0;
	let nextBatchId = 0;

	// Map of batchId → existing recipe name if a duplicate is detected
	const batchDuplicates = $derived(
		new Map(
			batchRecipes.map((r) => [r.batchId, findSimilarRecipeName(r.name, data.recipes)])
		)
	);

	// Edit state (for existing saved recipes)
	let editingId = $state<number | null>(null);
	let editName = $state('');
	let editIngredients = $state<ReviewIngredient[]>([]);

	// Expanded recipe state (for detail view)
	let expandedRecipeId = $state<number | null>(null);

	// Toast state
	interface Toast {
		id: number;
		message: string;
		undoRecipe: Recipe | null;
		timeoutId: ReturnType<typeof setTimeout>;
	}
	let toasts = $state<Toast[]>([]);
	let nextToastId = 0;

	function showTrashToast(recipe: Recipe) {
		const id = nextToastId++;
		const timeoutId = setTimeout(() => dismissToast(id), 5000);
		toasts.push({ id, message: `"${recipe.name}" moved to trash`, undoRecipe: recipe, timeoutId });
	}

	function dismissToast(id: number) {
		const idx = toasts.findIndex((t) => t.id === id);
		if (idx !== -1) {
			clearTimeout(toasts[idx].timeoutId);
			toasts.splice(idx, 1);
		}
	}

	// Readiness computed for each recipe
	const recipeReadiness = $derived(
		new Map(
			data.recipes.map((recipe) => [
				recipe.id,
				calculateReadiness(recipe.ingredients, data.foodItems)
			])
		)
	);

	const readinessOrder: Record<ReadinessStatus, number> = {
		ready: 0,
		'almost-ready': 1,
		'need-to-shop': 2
	};

	const sortedRecipes = $derived(
		[...data.recipes].sort((a, b) => {
			const ra = recipeReadiness.get(a.id)!;
			const rb = recipeReadiness.get(b.id)!;
			const orderDiff = readinessOrder[ra.status] - readinessOrder[rb.status];
			if (orderDiff !== 0) return orderDiff;
			return rb.matched / Math.max(rb.total, 1) - ra.matched / Math.max(ra.total, 1);
		})
	);

	const filteredRecipes = $derived(
		activeTab === 'all'
			? sortedRecipes
			: sortedRecipes.filter((r) => recipeReadiness.get(r.id)!.status === activeTab)
	);

	function triggerScan() {
		scanError = null;
		fileInput?.click();
	}

	async function handleFilesSelected(e: Event) {
		const files = Array.from((e.target as HTMLInputElement).files ?? []);
		if (files.length === 0) return;

		scanning = true;
		scanError = null;
		scanProgress = { current: 0, total: files.length };
		const extracted: BatchRecipe[] = [];

		for (let i = 0; i < files.length; i++) {
			scanProgress = { current: i + 1, total: files.length };

			let imageFile: File;
			try {
				imageFile = await compressImage(files[i]);
			} catch {
				continue;
			}

			const body = new FormData();
			body.append('image', imageFile);

			try {
				const res = await fetch('/api/scan-recipe', { method: 'POST', body });
				if (!res.ok) continue;

				const recipes = (await res.json()) as Array<{
					name: string;
					ingredients: Array<{
						name: string;
						canonicalName: string | null;
						quantity: string | null;
						unit: string | null;
					}>;
				}>;

				for (const recipe of recipes) {
					extracted.push({
						batchId: nextBatchId++,
						name: recipe.name,
						ingredients: recipe.ingredients.map((ing) => ({
							localId: nextLocalId++,
							name: ing.name,
							canonicalName: ing.canonicalName,
							quantity: ing.quantity,
							unit: ing.unit
						}))
					});
				}
			} catch {
				// skip network errors
			}
		}

		scanning = false;
		scanProgress = null;
		if (fileInput) fileInput.value = '';

		if (extracted.length === 0) {
			scanError = "Couldn't extract any recipes from the selected photos. Try clearer images.";
			return;
		}

		batchRecipes = extracted;
		showBatchReview = true;
	}

	function discardBatchRecipe(batchId: number) {
		const idx = batchRecipes.findIndex((r) => r.batchId === batchId);
		if (idx !== -1) batchRecipes.splice(idx, 1);
		if (batchRecipes.length === 0) cancelBatch();
	}

	function cancelBatch() {
		showBatchReview = false;
		batchRecipes = [];
		scanError = null;
	}

	function addBatchIngredient(batchId: number) {
		const recipe = batchRecipes.find((r) => r.batchId === batchId);
		if (recipe) recipe.ingredients.push({ localId: nextLocalId++, name: '', canonicalName: null, quantity: null, unit: null });
	}

	function removeBatchIngredient(batchId: number, localId: number) {
		const recipe = batchRecipes.find((r) => r.batchId === batchId);
		if (!recipe) return;
		const idx = recipe.ingredients.findIndex((i) => i.localId === localId);
		if (idx !== -1) recipe.ingredients.splice(idx, 1);
	}

	function startEdit(recipe: Recipe) {
		editingId = recipe.id;
		editName = recipe.name;
		editIngredients = recipe.ingredients.map((ing) => ({
			localId: nextLocalId++,
			name: ing.name,
			canonicalName: ing.canonicalName,
			quantity: ing.quantity,
			unit: ing.unit
		}));
	}

	function cancelEdit() {
		editingId = null;
		editName = '';
		editIngredients = [];
	}

	function addEditIngredient() {
		editIngredients.push({ localId: nextLocalId++, name: '', canonicalName: null, quantity: null, unit: null });
	}

	function removeEditIngredient(localId: number) {
		const idx = editIngredients.findIndex((i) => i.localId === localId);
		if (idx !== -1) editIngredients.splice(idx, 1);
	}

	const ingredientsJsonForEdit = $derived(
		JSON.stringify(
			editIngredients.map((i) => ({
				name: i.name,
				canonicalName: i.canonicalName,
				quantity: i.quantity,
				unit: i.unit
			}))
		)
	);

	function toggleExpanded(id: number) {
		expandedRecipeId = expandedRecipeId === id ? null : id;
	}

	const readinessLabel: Record<ReadinessStatus, string> = {
		ready: 'Ready to cook',
		'almost-ready': 'Almost ready',
		'need-to-shop': 'Need to shop'
	};

	const readinessColor: Record<ReadinessStatus, string> = {
		ready: 'text-green-600',
		'almost-ready': 'text-yellow-600',
		'need-to-shop': 'text-[#b0a090]'
	};
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
	<div class="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
		{#each toasts as toast (toast.id)}
			<div class="flex items-center gap-3 rounded-xl border border-[#e8e2d9] bg-white px-4 py-3 shadow-lg">
				<span class="text-sm text-[#2c2416]">{toast.message}</span>
				{#if toast.undoRecipe}
					<form
						method="POST"
						action="?/restore"
						use:enhance={() => () => dismissToast(toast.id)}
					>
						<input type="hidden" name="id" value={toast.undoRecipe.id} />
						<input type="hidden" name="trashedAt" value={toast.undoRecipe.trashedAt?.toISOString()} />
						<button type="submit" class="text-sm font-semibold text-[#5c4a2a] hover:underline">
							Undo
						</button>
					</form>
				{/if}
				<button
					onclick={() => dismissToast(toast.id)}
					class="text-[#b0a090] hover:text-[#8a7a6a]"
					aria-label="Dismiss"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

<main class="mx-auto max-w-lg px-4 pb-24 pt-6">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="font-[Cormorant_Garamond,serif] text-3xl font-semibold text-[#2c2416]">Recipes</h1>

		{#if !showBatchReview && editingId === null}
			<button
				onclick={triggerScan}
				disabled={scanning}
				class="flex items-center gap-2 rounded-xl bg-[#5c4a2a] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4a3a1f] disabled:opacity-50"
			>
				{#if scanning}
					<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
					</svg>
					Scanning…
				{:else}
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
						<circle cx="12" cy="13" r="4" />
					</svg>
					Scan Recipe
				{/if}
			</button>
		{/if}
	</div>

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		multiple
		class="hidden"
		onchange={handleFilesSelected}
	/>

	{#if scanning && scanProgress}
		<div class="mb-4 rounded-xl border border-[#e8e2d9] bg-white px-4 py-3">
			<p class="mb-2 text-sm text-[#5c4a2a]">
				Processing {scanProgress.current} of {scanProgress.total} photo{scanProgress.total === 1 ? '' : 's'}…
			</p>
			<div class="h-1.5 w-full overflow-hidden rounded-full bg-[#f0ece6]">
				<div
					class="h-full rounded-full bg-[#5c4a2a] transition-all duration-300"
					style="width: {Math.round((scanProgress.current / scanProgress.total) * 100)}%"
				></div>
			</div>
		</div>
	{/if}

	{#if scanError}
		<div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{scanError}
		</div>
	{/if}

	{#if form?.message}
		<div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.message}
		</div>
	{/if}

	{#if showBatchReview}
		<!-- Batch review -->
		<div class="mb-3 flex items-center justify-between">
			<p class="text-sm text-[#8a7a6a]">
				{batchRecipes.length} recipe{batchRecipes.length === 1 ? '' : 's'} found — review before saving
			</p>
			<button onclick={cancelBatch} class="text-xs font-semibold text-[#8a7a6a] hover:underline">
				Cancel all
			</button>
		</div>
		<div class="flex flex-col gap-4">
			{#each batchRecipes as batchRecipe (batchRecipe.batchId)}
				{@const ingredientsJson = JSON.stringify(
					batchRecipe.ingredients.map((i) => ({
						name: i.name,
						canonicalName: i.canonicalName,
						quantity: i.quantity,
						unit: i.unit
					}))
				)}
				{@const duplicateName = batchDuplicates.get(batchRecipe.batchId)}
				<div class="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm">
					<div class="mb-4 flex items-center justify-between gap-2">
						<h2 class="font-[Cormorant_Garamond,serif] text-xl font-semibold text-[#2c2416]">
							Review Recipe
						</h2>
						<button
							type="button"
							onclick={() => discardBatchRecipe(batchRecipe.batchId)}
							class="text-xs font-semibold text-red-400 hover:underline"
						>
							Discard
						</button>
					</div>
					<form
						method="POST"
						action="?/create"
						use:enhance={() => {
							return ({ update }) => {
								update({ reset: false }).then(() => {
									if (!form?.message) discardBatchRecipe(batchRecipe.batchId);
								});
							};
						}}
					>
						<div class="mb-4">
							<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7a6a]" for="batch-name-{batchRecipe.batchId}">
								Recipe Name
							</label>
							<input
								id="batch-name-{batchRecipe.batchId}"
								name="name"
								bind:value={batchRecipe.name}
								required
								class="w-full rounded-xl border border-[#e8e2d9] bg-[#faf8f5] px-3 py-2 text-sm text-[#2c2416] focus:border-[#5c4a2a] focus:outline-none"
							/>
						</div>
						{#if duplicateName}
							<div class="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
								A recipe named <strong>"{duplicateName}"</strong> already exists. You can save anyway or discard this one.
							</div>
						{/if}
						{@render ingredientEditor(
							batchRecipe.ingredients,
							() => addBatchIngredient(batchRecipe.batchId),
							(id) => removeBatchIngredient(batchRecipe.batchId, id)
						)}
						<input type="hidden" name="ingredients" value={ingredientsJson} />
						<button
							type="submit"
							class="w-full rounded-xl bg-[#5c4a2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a3a1f]"
						>
							Save Recipe
						</button>
					</form>
				</div>
			{/each}
		</div>
	{:else if editingId !== null}
		<!-- Edit existing recipe -->
		<div class="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm">
			<h2 class="mb-4 font-[Cormorant_Garamond,serif] text-xl font-semibold text-[#2c2416]">
				Edit Recipe
			</h2>
			<form
				method="POST"
				action="?/update"
				use:enhance={() => {
					return ({ update }) => {
						update({ reset: false }).then(() => {
							if (!form?.message) cancelEdit();
						});
					};
				}}
			>
				<input type="hidden" name="id" value={editingId} />
				<div class="mb-4">
					<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7a6a]" for="edit-name">
						Recipe Name
					</label>
					<input
						id="edit-name"
						name="name"
						bind:value={editName}
						required
						class="w-full rounded-xl border border-[#e8e2d9] bg-[#faf8f5] px-3 py-2 text-sm text-[#2c2416] focus:border-[#5c4a2a] focus:outline-none"
					/>
				</div>
				{@render ingredientEditor(editIngredients, addEditIngredient, removeEditIngredient)}
				<input type="hidden" name="ingredients" value={ingredientsJsonForEdit} />
				<div class="flex gap-2">
					<button type="button" onclick={cancelEdit} class="flex-1 rounded-xl border border-[#e8e2d9] px-4 py-2 text-sm font-semibold text-[#8a7a6a] hover:bg-[#f5f0ea]">
						Cancel
					</button>
					<button type="submit" class="flex-1 rounded-xl bg-[#5c4a2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a3a1f]">
						Save Changes
					</button>
				</div>
			</form>
		</div>
	{:else}
		<!-- Tab bar -->
		<div class="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-[#f0ece6] p-1">
			{#each [
				{ id: 'all' as TabId, label: 'All' },
				{ id: 'ready' as TabId, label: 'Ready' },
				{ id: 'almost-ready' as TabId, label: 'Almost Ready' },
				{ id: 'need-to-shop' as TabId, label: 'Need to Shop' },
				{ id: 'trash' as TabId, label: 'Trash' }
			] as tab}
				<button
					onclick={() => { activeTab = tab.id; }}
					class="flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition {activeTab === tab.id ? 'bg-white text-[#2c2416] shadow-sm' : 'text-[#8a7a6a] hover:text-[#2c2416]'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>

		{#if activeTab !== 'trash'}
			{#if filteredRecipes.length === 0}
				<div class="rounded-2xl border border-dashed border-[#d8cfc4] bg-white p-10 text-center">
					{#if activeTab === 'all'}
						<p class="mb-1 text-[#8a7a6a]">No recipes yet.</p>
						<p class="text-sm text-[#b0a090]">Tap "Scan Recipe" to photograph a recipe page.</p>
					{:else}
						<p class="text-[#8a7a6a]">No recipes in this category.</p>
					{/if}
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each filteredRecipes as recipe (recipe.id)}
						{@const readiness = recipeReadiness.get(recipe.id)!}
						{@const matches = matchIngredients(recipe.ingredients, data.foodItems)}
						{@const isExpanded = expandedRecipeId === recipe.id}
						<div class="rounded-2xl border border-[#e8e2d9] bg-white shadow-sm">
							<div class="px-5 py-4">
								<div class="flex items-start justify-between gap-2">
									<button
										onclick={() => toggleExpanded(recipe.id)}
										class="min-w-0 flex-1 text-left"
										aria-expanded={isExpanded}
									>
										<h2 class="font-[Cormorant_Garamond,serif] text-lg font-semibold text-[#2c2416]">
											{recipe.name}
										</h2>
										{#if recipe.ingredients.length > 0}
											<p class="mt-0.5 text-sm {readinessColor[readiness.status]}">
												{readiness.matched} of {readiness.total} ingredient{readiness.total === 1 ? '' : 's'} · {readinessLabel[readiness.status]}
											</p>
										{:else}
											<p class="mt-0.5 text-sm text-[#b0a090] italic">No ingredients</p>
										{/if}
									</button>
									<div class="flex flex-shrink-0 gap-2">
										<button
											onclick={() => startEdit(recipe)}
											class="text-xs font-semibold text-[#5c4a2a] hover:underline"
										>
											Edit
										</button>
										<form
											method="POST"
											action="?/trash"
											use:enhance={() => {
												return ({ update }) => {
													showTrashToast(recipe);
													update();
												};
											}}
										>
											<input type="hidden" name="id" value={recipe.id} />
											<button type="submit" class="text-xs font-semibold text-red-400 hover:underline">
												Delete
											</button>
										</form>
									</div>
								</div>
							</div>

							{#if isExpanded && recipe.ingredients.length > 0}
								<div class="border-t border-[#f0ece6] px-5 pb-4 pt-3">
									<ul class="flex flex-col gap-1.5">
										{#each matches as match}
											<li class="flex items-center gap-2 text-sm">
												{#if match.matched}
													<svg class="h-4 w-4 flex-shrink-0 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
														<polyline points="20 6 9 17 4 12" />
													</svg>
													<span class="text-[#2c2416]">{match.ingredient.name}</span>
												{:else}
													<svg class="h-4 w-4 flex-shrink-0 text-[#c0a880]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
														<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
													</svg>
													<span class="text-[#8a7a6a]">{match.ingredient.name}</span>
												{/if}
												{#if match.ingredient.quantity || match.ingredient.unit}
													<span class="ml-auto text-xs text-[#b0a090]">
														{[match.ingredient.quantity, match.ingredient.unit].filter(Boolean).join(' ')}
													</span>
												{/if}
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Trash tab -->
			{#if data.trashedRecipes.length === 0}
				<div class="rounded-2xl border border-dashed border-[#d8cfc4] bg-white p-10 text-center">
					<p class="text-[#8a7a6a]">Trash is empty.</p>
				</div>
			{:else}
				<div class="flex flex-col gap-3">
					{#each data.trashedRecipes as recipe (recipe.id)}
						<div class="rounded-2xl border border-[#e8e2d9] bg-white px-5 py-4 shadow-sm opacity-60">
							<div class="flex items-start justify-between gap-2">
								<h2 class="font-[Cormorant_Garamond,serif] text-lg font-semibold text-[#2c2416] line-through">
									{recipe.name}
								</h2>
								<form method="POST" action="?/restore" use:enhance>
									<input type="hidden" name="id" value={recipe.id} />
									<input type="hidden" name="trashedAt" value={recipe.trashedAt?.toISOString()} />
									<button type="submit" class="text-xs font-semibold text-[#5c4a2a] hover:underline">
										Restore
									</button>
								</form>
							</div>
							{#if recipe.ingredients.length > 0}
								<p class="mt-1 text-sm text-[#8a7a6a]">
									{recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</main>

{#snippet ingredientEditor(
	ingredients: ReviewIngredient[],
	onAdd: () => void,
	onRemove: (id: number) => void
)}
	<div class="mb-4">
		<div class="mb-2 flex items-center justify-between">
			<span class="text-xs font-semibold uppercase tracking-wide text-[#8a7a6a]">Ingredients</span>
			<button type="button" onclick={onAdd} class="text-xs font-semibold text-[#5c4a2a] hover:underline">
				+ Add
			</button>
		</div>
		{#if ingredients.length === 0}
			<p class="text-sm text-[#b0a090] italic">No ingredients. Add them manually.</p>
		{/if}
		<div class="flex flex-col gap-2">
			{#each ingredients as ing (ing.localId)}
				<div class="flex items-center gap-2">
					<input
						bind:value={ing.name}
						placeholder="Ingredient name"
						class="min-w-0 flex-1 rounded-xl border border-[#e8e2d9] bg-[#faf8f5] px-3 py-2 text-sm text-[#2c2416] focus:border-[#5c4a2a] focus:outline-none"
					/>
					<input
						bind:value={ing.quantity}
						placeholder="Qty"
						class="w-16 rounded-xl border border-[#e8e2d9] bg-[#faf8f5] px-3 py-2 text-sm text-[#2c2416] focus:border-[#5c4a2a] focus:outline-none"
					/>
					<input
						bind:value={ing.unit}
						placeholder="Unit"
						class="w-16 rounded-xl border border-[#e8e2d9] bg-[#faf8f5] px-3 py-2 text-sm text-[#2c2416] focus:border-[#5c4a2a] focus:outline-none"
					/>
					<button
						type="button"
						onclick={() => onRemove(ing.localId)}
						class="flex-shrink-0 text-[#c0a080] hover:text-red-500"
						aria-label="Remove ingredient"
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	</div>
{/snippet}
