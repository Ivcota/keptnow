export type ExpirationStatus = 'fresh' | 'expiring-soon' | 'expired';

export interface ExpirationConfig {
	expiringThresholdDays: number;
}

export const DEFAULT_EXPIRATION_CONFIG: ExpirationConfig = {
	expiringThresholdDays: 3
};

export const EXPIRING_SOON_THRESHOLD_DAYS = DEFAULT_EXPIRATION_CONFIG.expiringThresholdDays;

export function getExpirationStatus(
	expirationDate: Date,
	now: Date = new Date(),
	config: ExpirationConfig = DEFAULT_EXPIRATION_CONFIG
): ExpirationStatus {
	const msPerDay = 24 * 60 * 60 * 1000;
	const daysUntilExpiry = (expirationDate.getTime() - now.getTime()) / msPerDay;

	if (daysUntilExpiry < 0) {
		return 'expired';
	}
	if (daysUntilExpiry <= config.expiringThresholdDays) {
		return 'expiring-soon';
	}
	return 'fresh';
}
