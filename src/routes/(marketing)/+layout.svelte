<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col bg-[#f8f6f3] font-[Nunito_Sans,sans-serif]">
	<!-- STICKY NAV -->
	<header class="sticky top-0 z-50 border-b border-[#c4a46a33] bg-[#f8f6f3]/95 backdrop-blur-sm">
		<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a
				href="/"
				class="font-[Cormorant_Garamond,serif] text-2xl font-bold tracking-wide text-[#1a1714] transition-colors hover:text-[#c4a46a]"
			>
				Home Maker Assist
			</a>
			<div class="flex items-center gap-6">
				<a
					href="/"
					class="text-sm font-medium text-[#4a4540] transition-colors hover:text-[#c4a46a]"
				>
					Home
				</a>
				<a
					href="/about"
					class="text-sm font-medium text-[#4a4540] transition-colors hover:text-[#c4a46a]"
				>
					About
				</a>
				<a
					href="/roadmap"
					class="text-sm font-medium text-[#4a4540] transition-colors hover:text-[#c4a46a]"
				>
					Roadmap
				</a>
				<a
					href="/demo/better-auth/login"
					class="rounded-lg bg-[#c4a46a] px-5 py-2 text-sm font-semibold tracking-wide text-[#1a1714] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d4b87a]"
				>
					Get Started
				</a>
			</div>
		</nav>
	</header>

	<!-- PAGE CONTENT -->
	<main class="flex-1">
		{@render children()}
	</main>

	<!-- FOOTER -->
	<footer class="border-t border-[#c4a46a33] bg-[#1a1714] py-10">
		<div class="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
			<p class="text-sm text-[#6b6560]">
				&copy; {new Date().getFullYear()} Home Maker Assist. All rights reserved.
			</p>
			<div class="flex items-center gap-6">
				<a href="/" class="text-sm text-[#8a8279] transition-colors hover:text-[#c4a46a]">
					Home
				</a>
				<a href="/about" class="text-sm text-[#8a8279] transition-colors hover:text-[#c4a46a]">
					About
				</a>
				<a href="/roadmap" class="text-sm text-[#8a8279] transition-colors hover:text-[#c4a46a]">
					Roadmap
				</a>
			</div>
		</div>
	</footer>
</div>
