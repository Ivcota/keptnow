<script lang="ts">
	import { enhance } from '$app/forms';
	import { compressImage } from '$lib/compress-image.js';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Scanning state
	interface ReviewIngredient {
		localId: number;
		name: string;
		canonicalName: string | null;
		quantity: string | null;
		unit: string | null;
	}

	let scanning = $state(false);
	let scanError = $state<string | null>(null);
	let reviewName = $state('');
	let reviewIngredients = $state<ReviewIngredient[]>([]);
	let showReviewForm = $state(false);
	let fileInput = $state<HTMLInputElement | undefined>();
	let nextLocalId = 0;

	const ingredientsJson = $derived(
		JSON.stringify(
			reviewIngredients.map((i) => ({
				name: i.name,
				canonicalName: i.canonicalName,
				quantity: i.quantity,
				unit: i.unit
			}))
		)
	);

	function triggerScan() {
		scanError = null;
		fileInput?.click();
	}

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
			const res = await fetch('/api/scan-recipe', { method: 'POST', body });

			if (!res.ok) {
				scanError =
					res.status === 422
						? "Couldn't extract a recipe from this image. Try a clearer photo."
						: 'Something went wrong. Try again in a moment.';
				return;
			}

			const extracted = (await res.json()) as {
				name: string;
				ingredients: Array<{
					name: string;
					canonicalName: string | null;
					quantity: string | null;
					unit: string | null;
				}>;
			};

			reviewName = extracted.name;
			reviewIngredients = extracted.ingredients.map((ing) => ({
				localId: nextLocalId++,
				name: ing.name,
				canonicalName: ing.canonicalName,
				quantity: ing.quantity,
				unit: ing.unit
			}));
			showReviewForm = true;
		} catch {
			scanError = 'Something went wrong. Try again in a moment.';
		} finally {
			scanning = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function addIngredient() {
		reviewIngredients.push({
			localId: nextLocalId++,
			name: '',
			canonicalName: null,
			quantity: null,
			unit: null
		});
	}

	function removeIngredient(localId: number) {
		const idx = reviewIngredients.findIndex((i) => i.localId === localId);
		if (idx !== -1) reviewIngredients.splice(idx, 1);
	}

	function cancelReview() {
		showReviewForm = false;
		reviewName = '';
		reviewIngredients = [];
		scanError = null;
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

<main class="mx-auto max-w-lg px-4 pb-24 pt-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="font-[Cormorant_Garamond,serif] text-3xl font-semibold text-[#2c2416]">Recipes</h1>

		{#if !showReviewForm}
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
		capture="environment"
		class="hidden"
		onchange={handleFileSelected}
	/>

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

	{#if showReviewForm}
		<!-- Review & edit form -->
		<div class="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm">
			<h2 class="mb-4 font-[Cormorant_Garamond,serif] text-xl font-semibold text-[#2c2416]">
				Review Recipe
			</h2>

			<form
				method="POST"
				action="?/create"
				use:enhance={() => {
					return ({ update }) => {
						update({ reset: false }).then(() => {
							if (!form?.message) {
								cancelReview();
							}
						});
					};
				}}
			>
				<div class="mb-4">
					<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a7a6a]">
						Recipe Name
					</label>
					<input
						name="name"
						bind:value={reviewName}
						required
						class="w-full rounded-xl border border-[#e8e2d9] bg-[#faf8f5] px-3 py-2 text-sm text-[#2c2416] focus:border-[#5c4a2a] focus:outline-none"
					/>
				</div>

				<div class="mb-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-wide text-[#8a7a6a]">Ingredients</span>
						<button
							type="button"
							onclick={addIngredient}
							class="text-xs font-semibold text-[#5c4a2a] hover:underline"
						>
							+ Add
						</button>
					</div>

					{#if reviewIngredients.length === 0}
						<p class="text-sm text-[#b0a090] italic">No ingredients extracted. Add them manually.</p>
					{/if}

					<div class="flex flex-col gap-2">
						{#each reviewIngredients as ing (ing.localId)}
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
									onclick={() => removeIngredient(ing.localId)}
									class="flex-shrink-0 text-[#c0a080] hover:text-red-500"
									aria-label="Remove ingredient"
								>
									<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="18" y1="6" x2="6" y2="18" />
										<line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				</div>

				<input type="hidden" name="ingredients" value={ingredientsJson} />

				<div class="flex gap-2">
					<button
						type="button"
						onclick={cancelReview}
						class="flex-1 rounded-xl border border-[#e8e2d9] px-4 py-2 text-sm font-semibold text-[#8a7a6a] hover:bg-[#f5f0ea]"
					>
						Discard
					</button>
					<button
						type="submit"
						class="flex-1 rounded-xl bg-[#5c4a2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4a3a1f]"
					>
						Save Recipe
					</button>
				</div>
			</form>
		</div>
	{:else if data.recipes.length === 0}
		<div class="rounded-2xl border border-dashed border-[#d8cfc4] bg-white p-10 text-center">
			<p class="mb-1 text-[#8a7a6a]">No recipes yet.</p>
			<p class="text-sm text-[#b0a090]">Tap "Scan Recipe" to photograph a recipe page.</p>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each data.recipes as recipe (recipe.id)}
				<div class="rounded-2xl border border-[#e8e2d9] bg-white px-5 py-4 shadow-sm">
					<h2 class="font-[Cormorant_Garamond,serif] text-lg font-semibold text-[#2c2416]">
						{recipe.name}
					</h2>
					{#if recipe.ingredients.length > 0}
						<p class="mt-1 text-sm text-[#8a7a6a]">
							{recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'}
						</p>
					{:else}
						<p class="mt-1 text-sm text-[#b0a090] italic">No ingredients</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</main>
