<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<h1 class="mb-4 text-2xl font-bold">Tasks</h1>

<form method="post" use:enhance class="mb-8 flex flex-col gap-3">
	<label class="flex flex-col gap-1">
		Title
		<input
			type="text"
			name="title"
			required
			class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
	</label>
	<label class="flex flex-col gap-1">
		Priority
		<input
			type="number"
			name="priority"
			value="1"
			min="1"
			class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
	</label>
	<button
		type="submit"
		class="w-fit rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
	>
		Add Task
	</button>
	{#if form?.message}
		<p class="text-red-500">{form.message}</p>
	{/if}
</form>

<ul class="flex flex-col gap-2">
	{#each data.tasks as task (task.id)}
		<li class="rounded-md border border-gray-200 px-4 py-2">
			<span class="font-medium">{task.title}</span>
			<span class="ml-2 text-sm text-gray-500">priority: {task.priority}</span>
		</li>
	{/each}
</ul>
