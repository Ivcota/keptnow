<script lang="ts">
	import { browser } from '$app/environment';

	let show = $state(false);

	const DISMISS_KEY = 'keptnow-ios-install-dismissed';

	function isIOSSafari(): boolean {
		if (!browser) return false;
		const ua = navigator.userAgent;
		const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		const isStandalone = ('standalone' in navigator && (navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches;
		// Only show in Safari (not in-app browsers like Chrome on iOS)
		const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
		return isIOS && isSafari && !isStandalone;
	}

	$effect(() => {
		if (browser) {
			const dismissed = localStorage.getItem(DISMISS_KEY);
			if (!dismissed && isIOSSafari()) {
				show = true;
			}
		}
	});

	function dismiss() {
		show = false;
		localStorage.setItem(DISMISS_KEY, Date.now().toString());
	}
</script>

{#if show}
	<div class="fixed bottom-0 left-0 right-0 z-[9999] p-4 pb-6">
		<div
			class="relative mx-auto max-w-sm rounded-2xl border border-[#e8e2d9] bg-white p-4 shadow-lg"
		>
			<button
				type="button"
				class="absolute top-2 right-2 p-1 text-[#b0a090] hover:text-[#5c4a2a]"
				onclick={dismiss}
				aria-label="Dismiss"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>

			<p class="pr-6 text-sm font-semibold text-[#1a1714]">Install KeptNow</p>
			<p class="mt-1 text-xs text-[#6b6560]">
				Tap the
				<svg class="inline-block h-4 w-4 align-text-bottom text-[#007AFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
					<polyline points="16 6 12 2 8 6" />
					<line x1="12" y1="2" x2="12" y2="15" />
				</svg>
				share button, then select <strong>"Add to Home Screen"</strong>.
			</p>

			<!-- Small arrow pointing down to Safari toolbar -->
			<div class="mt-2 flex justify-center">
				<svg class="h-4 w-4 text-[#b0a090]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</div>
		</div>
	</div>
{/if}
