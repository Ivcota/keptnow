import { Effect } from 'effect';
import type { FoodItem } from './food-item.js';
import type { ExpirationConfig } from './expiration.js';
import { getExpirationStatus } from './expiration.js';
import { RestockConfigError } from './errors.js';

export interface RestockItem {
	foodItem: FoodItem;
	expirationStatus: 'expired' | 'expiring-soon';
	walmartUrl: string;
}

export function getRestockItems(
	items: FoodItem[],
	config: ExpirationConfig,
	now: Date = new Date()
): Effect.Effect<RestockItem[], RestockConfigError> {
	return Effect.gen(function* () {
		if (config.expiringThresholdDays < 0) {
			yield* Effect.fail(
				new RestockConfigError({ message: 'expiringThresholdDays must be non-negative' })
			);
		}

		const restockItems: RestockItem[] = [];

		for (const item of items) {
			if (item.expirationDate === null) continue;

			const status = getExpirationStatus(item.expirationDate, now, config);
			if (status === 'expired' || status === 'expiring-soon') {
				restockItems.push({
					foodItem: item,
					expirationStatus: status,
					walmartUrl: `https://www.walmart.com/search?q=${encodeURIComponent(item.name)}`
				});
			}
		}

		restockItems.sort((a, b) => {
			if (a.expirationStatus === b.expirationStatus) return 0;
			return a.expirationStatus === 'expired' ? -1 : 1;
		});

		return restockItems;
	});
}
