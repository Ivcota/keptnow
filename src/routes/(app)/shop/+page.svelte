<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const checkedIds = $state(new Set(data.items.filter((i) => i.checked).map((i) => i.id)));

	function isChecked(id: number): boolean {
		return checkedIds.has(id);
	}

	function handleToggle(id: number, nextChecked: boolean) {
		if (nextChecked) {
			checkedIds.add(id);
		} else {
			checkedIds.delete(id);
		}
	}

	const uncheckedItems = $derived(data.items.filter((i) => !isChecked(i.id)));
	const checkedItems = $derived(data.items.filter((i) => isChecked(i.id)));
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Nunito+Sans:wght@300;400;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main class="mx-auto max-w-lg px-4 pt-6 pb-24">
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
							{#if item.sourceType === 'recipe'}
								<span class="block text-sm text-[#8a7a6a]">
									{item.sourceRecipeNames?.join(' · ') ?? ''}
								</span>
							{:else if item.sourceRecipeNames && item.sourceRecipeNames.length > 0}
								<span class="block text-sm text-[#8a7a6a]">
									Expiring · {item.sourceRecipeNames.join(' · ')}
								</span>
							{:else}
								<span class="block text-sm text-[#8a7a6a]">Expiring</span>
							{/if}
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
							</span>
						</button>
					</form>
				{/each}
			{/if}
		</div>
	{/if}
</main>
