<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = false,
		ondismiss,
		children
	}: {
		open?: boolean;
		ondismiss?: () => void;
		children?: Snippet;
	} = $props();
</script>

{#if open}
	<!-- Overlay -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-black/40"
		onclick={ondismiss}
		aria-hidden="true"
	></div>

	<!-- Sheet -->
	<div
		class="sheet fixed right-0 bottom-0 left-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl"
		role="dialog"
		aria-modal="true"
	>
		<!-- Drag handle -->
		<div class="flex justify-center pt-3 pb-1">
			<div class="h-1 w-10 rounded-full bg-[#e8e2d9]"></div>
		</div>
		{@render children?.()}
	</div>
{/if}

<style>
	.sheet {
		animation: slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
	}

	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
</style>
