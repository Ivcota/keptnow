<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
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

<div class="flex min-h-screen flex-col bg-[#f8f6f3] font-[Nunito_Sans,sans-serif]">
	<!-- Nav -->
	<nav class="border-b border-[#e8e2d9] bg-white">
		<div class="mx-auto flex max-w-5xl items-center px-6 py-4">
			<div class="flex items-center gap-3">
				<a
					href={resolve('/demo')}
					class="rounded-lg border border-[#ddd6cc] bg-white px-2.5 py-1.5 text-sm text-[#8a8279] shadow-sm transition-all duration-200 hover:bg-[#f0ebe4] hover:text-[#3a3632]"
				>
					&larr; Demos
				</a>
				<h1 class="font-[Cormorant_Garamond,serif] text-xl font-bold tracking-wide text-[#1a1714]">
					KeptNow
				</h1>
			</div>
		</div>
	</nav>

	<main class="mx-auto w-full max-w-5xl px-6 py-10">
		<!-- Hero -->
		<div
			class="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1714] via-[#252018] to-[#2a2520] p-8 sm:p-10"
		>
			<div
				class="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[radial-gradient(circle,#c4a46a_0%,transparent_70%)] opacity-15"
			></div>
			<div
				class="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-[radial-gradient(circle,#c4a46a_0%,transparent_70%)] opacity-10"
			></div>
			<span class="mb-3 inline-block text-xs font-semibold tracking-[0.2em] text-[#c4a46a]">
				TASKS
			</span>
			<h2 class="mb-3 font-[Cormorant_Garamond,serif] text-3xl font-bold leading-tight text-[#f0e6d3] sm:text-4xl">
				Your tasks
			</h2>
			<p class="max-w-xl text-base leading-relaxed text-[#9a9088]">
				{data.tasks.length === 0
					? 'Nothing on the list yet. Add your first task below.'
					: `${data.tasks.filter((t) => !t.completedAt).length} active, ${data.tasks.filter((t) => t.completedAt).length} completed`}
			</p>
		</div>

		<!-- Task list -->
		{#if data.tasks.length > 0}
			<section class="mb-10">
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.tasks as task (task.id)}
						<article
							class="rounded-xl border bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
								{task.completedAt
								? 'border-[#e8e2d9] opacity-60'
								: 'border-[#e8e2d9] hover:border-[#c4a46a66]'}"
						>
							<div class="mb-2 flex items-start justify-between gap-2">
								<h3
									class="font-[Cormorant_Garamond,serif] text-lg font-bold
										{task.completedAt ? 'text-[#8a8279] line-through' : 'text-[#1a1714]'}"
								>
									{task.title}
								</h3>
							</div>
							<p class="mb-4 text-xs font-medium tracking-[0.1em] text-[#8a8279]">
								PRIORITY {task.priority}
							</p>

							<div class="flex items-center justify-end gap-2">
								<!-- Complete toggle -->
								<form method="post" action="?/complete" use:enhance>
									<input type="hidden" name="id" value={task.id} />
									<button
										type="submit"
										aria-label={task.completedAt ? 'Mark as incomplete' : 'Mark as complete'}
										class="flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200
											{task.completedAt
											? 'border-[#6b8f71] bg-[#6b8f7118] text-[#6b8f71]'
											: 'border-[#ddd6cc] text-[#8a8279] hover:border-[#6b8f71] hover:bg-[#6b8f710d] hover:text-[#6b8f71]'}"
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
										class="flex h-8 w-8 items-center justify-center rounded-full border border-[#ddd6cc] text-[#8a8279] transition-all duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500"
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
			</section>
		{/if}

		<!-- Quick Add -->
		<section class="rounded-xl border border-[#e8e2d9] bg-white p-6 sm:p-8">
			<h3 class="mb-4 font-[Cormorant_Garamond,serif] text-lg font-bold text-[#1a1714]">
				Quick Add
			</h3>
			<form method="post" action="?/create" use:enhance class="flex flex-col gap-4">
				<div class="flex gap-3">
					<div class="flex flex-1 flex-col gap-1.5">
						<label for="title" class="text-sm font-medium text-[#3a3632]">Title</label>
						<input
							id="title"
							type="text"
							name="title"
							required
							placeholder="What needs doing?"
							class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] placeholder:text-[#b5aea4] shadow-sm outline-none transition-all duration-200 focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
						/>
					</div>
					<div class="flex w-24 flex-col gap-1.5">
						<label for="priority" class="text-sm font-medium text-[#3a3632]">Priority</label>
						<input
							id="priority"
							type="number"
							name="priority"
							value="1"
							min="1"
							class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm outline-none transition-all duration-200 focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
						/>
					</div>
				</div>
				<div class="flex items-center gap-4">
					<button
						type="submit"
						class="rounded-lg bg-[#c4a46a] px-5 py-2.5 text-sm font-semibold tracking-wide text-[#1a1714] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a] hover:shadow-md active:translate-y-0"
					>
						Add Task
					</button>
					{#if form?.message}
						<p class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-600">
							{form.message}
						</p>
					{/if}
				</div>
			</form>
		</section>
	</main>
</div>
