<script lang="ts">
	let newTask = $state('');
	let activeNav = $state('today');

	const navItems = [
		{ id: 'all', label: 'All Tasks', icon: 'grid' },
		{ id: 'today', label: 'Today', icon: 'sun' },
		{ id: 'upcoming', label: 'Upcoming', icon: 'calendar' },
		{ id: 'completed', label: 'Completed', icon: 'check' }
	];

	const priorityTask = {
		category: 'MEAL PREP',
		title: 'Prepare Weekly Meal Plan',
		description:
			'Review pantry inventory, plan meals for the week, and build a consolidated grocery list. Sunday batch cooking starts at 2 PM.',
		due: 'Today, 11:00 AM'
	};

	const todayTasks = [
		{
			category: 'CLEANING',
			title: 'Deep Clean Kitchen',
			description: 'Degrease stovetop, wipe down cabinets, clean out refrigerator.',
			due: '1:00 PM'
		},
		{
			category: 'ERRANDS',
			title: 'Grocery Run',
			description: 'Pick up produce, dairy, and pantry staples from the weekly list.',
			due: '3:30 PM'
		},
		{
			category: 'LAUNDRY',
			title: 'Wash & Fold Linens',
			description: 'Strip beds, wash sheets and towels on hot. Fold and return by evening.',
			due: '5:00 PM'
		}
	];

	const stats = { pending: 3, done: 2, overdue: 1 };

	function handleAdd() {
		if (newTask.trim()) {
			newTask = '';
		}
	}

	const iconPaths: Record<string, string> = {
		grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
		sun: 'M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M12 6a6 6 0 100 12 6 6 0 000-12z',
		calendar:
			'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
		check: 'M20 6L9 17l-5-5'
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

<div class="dashboard min-h-screen bg-[#1a1714] font-[Nunito_Sans,sans-serif]">
	<!-- NAV BAR -->
	<nav class="sticky top-0 z-50 border-b border-[#c4a46a26] bg-[#211f1b]">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
			<h1 class="font-[Cormorant_Garamond,serif] text-xl font-bold tracking-wide text-[#c4a46a]">
				KeptNow
			</h1>
			<div class="flex items-center gap-1">
				{#each navItems as item}
					<button
						class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200
							{activeNav === item.id
							? 'bg-[#c4a46a1a] font-semibold text-[#c4a46a]'
							: 'text-[#8a8279] hover:bg-[#c4a46a0d] hover:text-[#9a9088]'}"
						onclick={() => (activeNav = item.id)}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d={iconPaths[item.icon]} />
						</svg>
						<span class="hidden sm:inline">{item.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</nav>

	<!-- STATS BAR -->
	<div class="border-b border-[#c4a46a14] bg-[#1e1c18]">
		<div class="mx-auto flex max-w-5xl items-center gap-6 px-6 py-2.5">
			<span class="text-xs tracking-[0.15em] text-[#6b6560]">STATUS</span>
			<div class="flex items-center gap-4 text-sm text-[#8a8279]">
				<span class="flex items-center gap-1.5">
					<span class="inline-block h-2 w-2 rounded-full bg-[#c4a46a]"></span>
					{stats.pending} pending
				</span>
				<span class="text-[#3a3632]">|</span>
				<span class="flex items-center gap-1.5">
					<span class="inline-block h-2 w-2 rounded-full bg-[#6b8f71]"></span>
					{stats.done} done
				</span>
				<span class="text-[#3a3632]">|</span>
				<span class="flex items-center gap-1.5">
					<span class="inline-block h-2 w-2 rounded-full bg-[#a0584e]"></span>
					{stats.overdue} overdue
				</span>
			</div>
		</div>
	</div>

	<main class="mx-auto max-w-5xl px-6 py-10">
		<!-- PRIORITY HERO -->
		<section class="mb-12">
			<div
				class="relative overflow-hidden rounded-2xl border border-[#c4a46a33] bg-gradient-to-br from-[#2a2520] via-[#1e1c18] to-[#252018] p-8 sm:p-10"
			>
				<!-- Decorative corner accents -->
				<div
					class="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[radial-gradient(circle,#c4a46a_0%,transparent_70%)] opacity-15"
				></div>
				<div
					class="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-[radial-gradient(circle,#c4a46a_0%,transparent_70%)] opacity-8"
				></div>

				<span class="mb-3 inline-block text-xs font-semibold tracking-[0.2em] text-[#c4a46a]">
					{priorityTask.category}
				</span>
				<h2
					class="mb-3 font-[Cormorant_Garamond,serif] text-3xl font-bold leading-tight text-[#f0e6d3] sm:text-4xl"
				>
					{priorityTask.title}
				</h2>
				<p class="mb-6 max-w-xl text-base leading-relaxed text-[#9a9088]">
					{priorityTask.description}
				</p>
				<div class="flex items-center gap-4">
					<button
						class="rounded-lg bg-[#c4a46a] px-5 py-2.5 text-sm font-semibold tracking-wide text-[#1a1714] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a]"
					>
						Start Now
					</button>
					<span class="text-sm text-[#6b6560]">
						Due {priorityTask.due}
					</span>
				</div>
			</div>
		</section>

		<!-- TODAY'S TASKS -->
		<section class="mb-12">
			<div class="mb-6 flex items-end justify-between">
				<h3 class="font-[Cormorant_Garamond,serif] text-2xl font-bold text-[#f0e6d3]">
					Today's Tasks
				</h3>
				<button class="text-sm text-[#c4a46a] transition-colors duration-200 hover:text-[#d4b87a]">
					See All
				</button>
			</div>

			<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{#each todayTasks as task}
					<article
						class="rounded-xl border border-[#c4a46a1a] bg-[#211f1b] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#c4a46a4d] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
					>
						<span class="mb-3 inline-block text-xs font-semibold tracking-[0.15em] text-[#8a7a5a]">
							{task.category}
						</span>
						<h4 class="mb-2 font-[Cormorant_Garamond,serif] text-lg font-bold text-[#e8ddd0]">
							{task.title}
						</h4>
						<p class="mb-4 text-sm leading-relaxed text-[#7a756e]">
							{task.description}
						</p>
						<div class="flex items-center justify-between">
							<span class="text-xs text-[#5a5650]">Due {task.due}</span>
							<button
								class="flex h-7 w-7 items-center justify-center rounded-full border border-[#c4a46a40] text-[#6b6560] transition-all duration-200 hover:border-[#6b8f71] hover:bg-[#6b8f7126] hover:text-[#6b8f71]"
								aria-label="Mark as complete"
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
								>
									<path d="M20 6L9 17l-5-5" />
								</svg>
							</button>
						</div>
					</article>
				{/each}
			</div>
		</section>

		<!-- DIVIDER -->
		<hr class="mb-10 border-t border-[#c4a46a1a]" />

		<!-- QUICK ADD -->
		<section>
			<h3 class="mb-4 font-[Cormorant_Garamond,serif] text-lg font-bold text-[#f0e6d3]">
				Quick Add
			</h3>
			<div class="flex gap-3">
				<input
					type="text"
					bind:value={newTask}
					placeholder="What needs doing?"
					class="flex-1 rounded-lg border border-[#c4a46a26] bg-[#211f1b] px-4 py-3 text-sm text-[#e8ddd0] outline-none transition-all duration-200 placeholder:tracking-wide placeholder:text-[#6b6560] focus:border-[#c4a46a66] focus:shadow-[0_0_0_3px_rgba(196,164,106,0.08)]"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleAdd();
					}}
				/>
				<button
					class="rounded-lg bg-[#c4a46a] px-6 py-3 text-sm font-semibold tracking-wide text-[#1a1714] transition-all duration-200 hover:bg-[#d4b87a]"
					onclick={handleAdd}
				>
					Add Task
				</button>
			</div>
		</section>
	</main>
</div>
