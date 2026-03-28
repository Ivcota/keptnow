<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<div class="flex min-h-screen flex-col bg-[#f8f6f3] font-[Nunito_Sans,sans-serif]">
	<AppHeader user={data.user} />
	{@render children()}
</div>
