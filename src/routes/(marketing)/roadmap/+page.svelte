<svelte:head>
	<title>Roadmap — KeptNow</title>
</svelte:head>

<!-- HERO -->
<section class="bg-[#1a1714] px-6 py-28 sm:py-36">
	<div class="mx-auto max-w-3xl">
		<span class="mb-6 inline-block text-xs font-semibold tracking-[0.2em] text-[#c4a46a]">
			ROADMAP
		</span>
		<h1
			class="mb-6 font-[Cormorant_Garamond,serif] text-5xl leading-tight font-bold text-[#f0e6d3] sm:text-6xl"
		>
			Where we are.<br />
			<em class="font-normal text-[#c4a46a] italic">Where we're going.</em>
		</h1>
		<p class="text-xl leading-relaxed text-[#9a9088]">
			KeptNow is being built in phases. Here's what's live — and what's coming next.
		</p>
	</div>
</section>

<!-- TIMELINE -->
<section class="bg-[#f8f6f3] px-6 py-20">
	<div class="mx-auto max-w-3xl">
		<div class="relative">
			<!-- Vertical line -->
			<div
				class="absolute top-0 left-[1.1rem] h-full w-0.5 bg-gradient-to-b from-[#c4a46a] via-[#c4a46a40] to-transparent sm:left-[1.35rem]"
			></div>

			<div class="space-y-16">
				<!-- Phase 1: Foundation — COMPLETE -->
				<div class="relative flex gap-6 sm:gap-8">
					<div class="relative flex-shrink-0">
						<div
							class="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#6b8f71] shadow-[0_0_0_4px_#f8f6f3,0_0_0_6px_#6b8f7166]"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#fff"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
					</div>
					<div class="flex-1 pb-2">
						<div class="mb-1 flex flex-wrap items-center gap-3">
							<h2 class="font-[Cormorant_Garamond,serif] text-3xl font-bold text-[#1a1714]">
								Phase 1: Foundation
							</h2>
							<span
								class="rounded-full bg-[#6b8f71] px-3 py-0.5 text-xs font-semibold tracking-wide text-white"
							>
								COMPLETE
							</span>
						</div>
						<p class="mb-6 text-sm leading-relaxed text-[#7a756e]">
							The bedrock — authentication, task management, and the infrastructure that everything
							else is built on.
						</p>

						<div class="grid gap-3 sm:grid-cols-2">
							{#each ['User authentication & accounts', 'Task creation & management', 'Task completion tracking', 'Per-user data isolation', 'Marketing site & roadmap', 'App dashboard shell'] as label}
								<div
									class="flex items-center gap-3 rounded-lg border border-[#e8e2d9] bg-white px-4 py-3"
								>
									<span class="h-2 w-2 flex-shrink-0 rounded-full bg-[#6b8f71]"></span>
									<span class="text-sm text-[#3a3632]">{label}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Phase 2: Inventory Management — COMPLETE -->
				<div class="relative flex gap-6 sm:gap-8">
					<div class="relative flex-shrink-0">
						<div
							class="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#6b8f71] shadow-[0_0_0_4px_#f8f6f3,0_0_0_6px_#6b8f7166]"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#fff"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
					</div>
					<div class="flex-1 pb-2">
						<div class="mb-1 flex flex-wrap items-center gap-3">
							<h2 class="font-[Cormorant_Garamond,serif] text-3xl font-bold text-[#1a1714]">
								Phase 2: Inventory Management
							</h2>
							<span
								class="rounded-full bg-[#6b8f71] px-3 py-0.5 text-xs font-semibold tracking-wide text-white"
							>
								COMPLETE
							</span>
						</div>
						<p class="mb-6 text-sm leading-relaxed text-[#7a756e]">
							Track food in your home — pantry, fridge, and freezer — with expiration tracking and
							quick-add workflow.
						</p>

						<div class="grid gap-3 sm:grid-cols-2">
							{#each ['Food item tracking by storage location', 'Tabbed dashboard (Pantry, Fridge, Freezer)', 'Expiration date tracking with status indicators', 'Add, edit, and delete items', 'Trash and restore workflow', 'Quick-add mode for rapid entry', 'AI receipt scanning with bulk add', 'Smart categorization & expiration inference'] as label}
								<div
									class="flex items-center gap-3 rounded-lg border border-[#e8e2d9] bg-white px-4 py-3"
								>
									<span class="h-2 w-2 flex-shrink-0 rounded-full bg-[#6b8f71]"></span>
									<span class="text-sm text-[#3a3632]">{label}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Phase 3: Restock — COMPLETE -->
				<div class="relative flex gap-6 sm:gap-8">
					<div class="relative flex-shrink-0">
						<div
							class="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#6b8f71] shadow-[0_0_0_4px_#f8f6f3,0_0_0_6px_#6b8f7166]"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#fff"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
					</div>
					<div class="flex-1 pb-2">
						<div class="mb-1 flex flex-wrap items-center gap-3">
							<h2 class="font-[Cormorant_Garamond,serif] text-3xl font-bold text-[#1a1714]">
								Phase 3: Restock
							</h2>
							<span
								class="rounded-full bg-[#6b8f71] px-3 py-0.5 text-xs font-semibold tracking-wide text-white"
							>
								COMPLETE
							</span>
						</div>
						<p class="mb-6 text-sm leading-relaxed text-[#7a756e]">
							Know what needs replacing — automatic restock suggestions based on expiration, with a
							check-off workflow and store links.
						</p>

						<div class="grid gap-3 sm:grid-cols-2">
							{#each ['Expiration-based restock suggestions', 'Restock checklist UI', 'Check-off with trash old / replace flow', 'Walmart shopping links', 'Configurable expiration rules'] as label}
								<div
									class="flex items-center gap-3 rounded-lg border border-[#e8e2d9] bg-white px-4 py-3"
								>
									<span class="h-2 w-2 flex-shrink-0 rounded-full bg-[#6b8f71]"></span>
									<span class="text-sm text-[#3a3632]">{label}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Phase 4: Recipes — COMPLETE -->
				<div class="relative flex gap-6 sm:gap-8">
					<div class="relative flex-shrink-0">
						<div
							class="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#6b8f71] shadow-[0_0_0_4px_#f8f6f3,0_0_0_6px_#6b8f7166]"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#fff"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
					</div>
					<div class="flex-1 pb-2">
						<div class="mb-1 flex flex-wrap items-center gap-3">
							<h2 class="font-[Cormorant_Garamond,serif] text-3xl font-bold text-[#1a1714]">
								Phase 4: Recipes
							</h2>
							<span
								class="rounded-full bg-[#6b8f71] px-3 py-0.5 text-xs font-semibold tracking-wide text-white"
							>
								COMPLETE
							</span>
						</div>
						<p class="mb-6 text-sm leading-relaxed text-[#7a756e]">
							Save recipes, scan them from photos, and see which ones you can cook right now based
							on what's in your kitchen.
						</p>

						<div class="grid gap-3 sm:grid-cols-2">
							{#each ['AI recipe scanning from photos', 'Batch multi-recipe photo upload', 'Recipe editing & ingredient management', 'Ingredient matching against inventory', 'Cook-readiness indicators', 'Duplicate recipe detection'] as label}
								<div
									class="flex items-center gap-3 rounded-lg border border-[#e8e2d9] bg-white px-4 py-3"
								>
									<span class="h-2 w-2 flex-shrink-0 rounded-full bg-[#6b8f71]"></span>
									<span class="text-sm text-[#3a3632]">{label}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Phase 5: AI Assistant — NEXT -->
				<div class="relative flex gap-6 sm:gap-8">
					<div class="relative flex-shrink-0">
						<div
							class="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#c4a46a40] bg-[#f8f6f3]"
						>
							<div class="h-2.5 w-2.5 rounded-full bg-[#c4a46a40]"></div>
						</div>
					</div>
					<div class="flex-1 pb-2">
						<div class="mb-1 flex flex-wrap items-center gap-3">
							<h2 class="font-[Cormorant_Garamond,serif] text-3xl font-bold text-[#3a3632]">
								Phase 5: AI Assistant
							</h2>
							<span
								class="rounded-full border border-[#c4a46a40] px-3 py-0.5 text-xs font-semibold tracking-wide text-[#8a8279]"
							>
								NEXT
							</span>
						</div>
						<p class="text-sm leading-relaxed text-[#7a756e]">
							An AI assistant grounded in your household context — not a generic chatbot. Features
							TBD.
						</p>
					</div>
				</div>

				<!-- Phase 6: MCP & Integrations -->
				<div class="relative flex gap-6 sm:gap-8">
					<div class="relative flex-shrink-0">
						<div
							class="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#c4a46a26] bg-[#f8f6f3]"
						>
							<div class="h-2.5 w-2.5 rounded-full bg-[#c4a46a26]"></div>
						</div>
					</div>
					<div class="flex-1 pb-2">
						<div class="mb-4">
							<h2 class="font-[Cormorant_Garamond,serif] text-3xl font-bold text-[#5a5248]">
								Phase 6: MCP & Integrations
							</h2>
						</div>
						<p class="text-sm leading-relaxed text-[#8a8279]">
							Open KeptNow to the tools and services you already use. Features TBD.
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Legend -->
		<div class="mt-16 flex flex-wrap items-center gap-6 border-t border-[#e8e2d9] pt-8">
			<span class="text-xs font-semibold tracking-[0.15em] text-[#8a8279]">LEGEND</span>
			<div class="flex items-center gap-2">
				<span class="h-2 w-2 rounded-full bg-[#6b8f71]"></span>
				<span class="text-xs text-[#5a5248]">Live</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="h-2 w-2 rounded-full bg-[#d0ccc7]"></span>
				<span class="text-xs text-[#5a5248]">TBD</span>
			</div>
		</div>
	</div>
</section>

<!-- CTA -->
<section class="bg-[#1a1714] px-6 py-20 text-center">
	<div class="mx-auto max-w-xl">
		<h2 class="mb-4 font-[Cormorant_Garamond,serif] text-3xl font-bold text-[#f0e6d3]">
			Want to influence what gets built next?
		</h2>
		<p class="mb-8 text-base leading-relaxed text-[#9a9088]">
			Early access members help shape the roadmap. Sign up and tell us what matters most to your
			household.
		</p>
		<a
			href="/login"
			class="inline-block rounded-lg bg-[#c4a46a] px-8 py-3.5 text-sm font-semibold tracking-wide text-[#1a1714] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a]"
		>
			Get Started — It's Free
		</a>
	</div>
</section>
