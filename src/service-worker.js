import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;

// Assets to cache on install: built JS/CSS + static files
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}
	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Skip cross-origin requests
	if (url.origin !== self.location.origin) return;

	// Skip API requests — always go to network
	if (url.pathname.startsWith('/api/')) return;

	async function respond() {
		const cache = await caches.open(CACHE);

		// Cache-first for pre-cached assets (build + static files)
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
		}

		// Network-first for everything else
		try {
			const response = await fetch(event.request);
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch {
			// Offline: return cached version if available
			const cached = await cache.match(event.request);
			if (cached) return cached;

			// Offline fallback for navigation requests
			if (event.request.mode === 'navigate') {
				const offline = await cache.match('/offline.html');
				if (offline) return offline;
			}

			return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
		}
	}

	event.respondWith(respond());
});
