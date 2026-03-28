<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Nunito+Sans:wght@300;400;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="min-h-screen bg-[#1a1714] font-[Nunito_Sans,sans-serif]">
	<!-- HEADER -->
	<nav class="sticky top-0 z-50 border-b border-[#c4a46a26] bg-[#211f1b]">
		<div class="mx-auto flex max-w-5xl items-center px-6 py-3">
			<h1 class="font-[Cormorant_Garamond,serif] text-xl font-bold tracking-wide text-[#c4a46a]">
				Home Maker
			</h1>
		</div>
	</nav>

	<main class="mx-auto max-w-5xl px-6 py-10">
		<!-- TASK LIST -->
		<section class="mb-12">
			<h2 class="mb-6 font-[Cormorant_Garamond,serif] text-2xl font-bold text-[#f0e6d3]">
				Tasks
			</h2>

			{#if data.tasks.length === 0}
				<p class="text-sm text-[#6b6560]">No tasks yet. Add one below.</p>
			{:else}
				<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.tasks as task (task.id)}
						<article
							class="rounded-xl border bg-[#211f1b] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]
								{task.completedAt
								? 'border-[#c4a46a0d] opacity-50'
								: 'border-[#c4a46a1a] hover:border-[#c4a46a4d]'}"
						>
							<div class="mb-2 flex items-start justify-between gap-2">
								<h3
									class="font-[Cormorant_Garamond,serif] text-lg font-bold
										{task.completedAt ? 'text-[#7a756e] line-through' : 'text-[#e8ddd0]'}"
								>
									{task.title}
								</h3>
							</div>
							<p class="mb-4 text-xs text-[#5a5650]">Priority: {task.priority}</p>

							<div class="flex items-center justify-end gap-2">
								<!-- Complete toggle -->
								<form method="post" action="?/complete" use:enhance>
									<input type="hidden" name="id" value={task.id} />
									<button
										type="submit"
										aria-label={task.completedAt ? 'Mark as incomplete' : 'Mark as complete'}
										class="flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-200
											{task.completedAt
											? 'border-[#6b8f71] bg-[#6b8f7126] text-[#6b8f71]'
											: 'border-[#c4a46a40] text-[#6b6560] hover:border-[#6b8f71] hover:bg-[#6b8f7126] hover:text-[#6b8f71]'}"
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
											<path d="M20 6L9 17l-5-5" />
										</svg>
									</button>
								</form>

								<!-- Remove -->
								<form method="post" action="?/remove" use:enhance>
									<input type="hidden" name="id" value={task.id} />
									<button
										type="submit"
										aria-label="Remove task"
										class="flex h-7 w-7 items-center justify-center rounded-full border border-[#c4a46a26] text-[#6b6560] transition-all duration-200 hover:border-[#a0584e66] hover:bg-[#a0584e1a] hover:text-[#a0584e]"
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
								</form>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<hr class="mb-10 border-t border-[#c4a46a1a]" />

		<!-- QUICK ADD -->
		<section>
			<h3 class="mb-4 font-[Cormorant_Garamond,serif] text-lg font-bold text-[#f0e6d3]">
				Quick Add
			</h3>
			<form method="post" action="?/create" use:enhance class="flex flex-col gap-4">
				<div class="flex gap-3">
					<label class="flex flex-1 flex-col gap-1">
						<span class="text-xs tracking-[0.1em] text-[#6b6560]">TITLE</span>
						<input
							type="text"
							name="title"
							required
							placeholder="What needs doing?"
							class="flex-1 rounded-lg border border-[#c4a46a26] bg-[#211f1b] px-4 py-3 text-sm text-[#e8ddd0] outline-none transition-all duration-200 placeholder:text-[#6b6560] focus:border-[#c4a46a66] focus:shadow-[0_0_0_3px_rgba(196,164,106,0.08)]"
						/>
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-xs tracking-[0.1em] text-[#6b6560]">PRIORITY</span>
						<input
							type="number"
							name="priority"
							value="1"
							min="1"
							class="w-24 rounded-lg border border-[#c4a46a26] bg-[#211f1b] px-4 py-3 text-sm text-[#e8ddd0] outline-none transition-all duration-200 focus:border-[#c4a46a66] focus:shadow-[0_0_0_3px_rgba(196,164,106,0.08)]"
						/>
					</label>
				</div>
				<div class="flex items-center gap-4">
					<button
						type="submit"
						class="rounded-lg bg-[#c4a46a] px-6 py-3 text-sm font-semibold tracking-wide text-[#1a1714] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a]"
					>
						Add Task
					</button>
					{#if form?.message}
						<p class="text-sm text-[#a0584e]">{form.message}</p>
					{/if}
				</div>
			</form>
		</section>
	</main>
</div>
